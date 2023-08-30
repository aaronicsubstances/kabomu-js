import {
    FinishedOptions,
    Readable,
    Writable, 
    finished
} from "stream";

import { CustomIOError } from "./errors";
import { createBlankChequePromise } from "./MiscUtils";

/**
 * The limit of data buffering when reading byte streams into memory. Equal to 128 MB.
 */
export const DEFAULT_DATA_BUFFER_LIMIT = 134_217_728;

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DEFAULT_READ_BUFFER_SIZE = 8192;

function createNonBufferChunkError(chunk: any) {
    const chunkType = typeof chunk;
    return new CustomIOError(
        "expected Buffer chunks but got chunk of type " +
        chunkType)
}

/**
 * Performs writes on behalf of a writable stream
 * @param writer writable stream
 * @param data source buffer
 */
export async function writeBytes(writer: Writable, data: Buffer) {
    if (!writer) {
        throw new Error("writer argument is null");
    }
    // allow zero-byte writes to proceed to the
    // stream, rather than just return.
    const controller = new AbortController();
    const finishedOptions: FinishedOptions = {
        signal: controller.signal
    };
    const pendingWriteCompletion = createBlankChequePromise<void>()
    // attach an error handler, without which
    // an unhandled exception may occur.
    const ev = (e: any) => {
        // do nothing.
    }
    writer.once("error", ev);
    finished(writer, finishedOptions, err => {
        if (controller.signal.aborted) {
            return;
        }
        if (err) {
            pendingWriteCompletion.reject(err);
        }
        else {
            pendingWriteCompletion.reject(
                new CustomIOError("end of write"));
        }
    });
    writer.write(data, err => {
        if (err) {
            pendingWriteCompletion.reject(err)
        }
        else {
            pendingWriteCompletion.resolve()
        }

        // free finished callback
        controller.abort()
    })
    await pendingWriteCompletion.promise;
    // only here can we really remove error
    // listener to prevent unhandled errors
    writer.removeListener("error", ev);
}

async function readSomeBytes(reader: Readable,
        data: Buffer, readFully: boolean)
        : Promise<number> {
    if (!reader) {
        throw new Error("reader argument is null");
    }
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return.
    const controller = new AbortController();
    const finishedOptions: FinishedOptions = {
        signal: controller.signal
    };
    const pendingReadCompletion = createBlankChequePromise<number>()
    // attach an error handler, without which
    // an unhandled exception may occur.
    const ev = (e: any) => {
        pendingReadCompletion.reject(e)
    }
    reader.once("error", ev);
    finished(reader, finishedOptions, err => {
        // just in case readableCb is never called
        reader.removeListener("readable", readableCb);
        if (controller.signal.aborted) {
            return;
        }
        if (err) {
            pendingReadCompletion.reject(err);
        }
        else {
            if (readFully && data.length > 0) {
                pendingReadCompletion.reject(
                    new CustomIOError("unexpected end of read"))
            }
            pendingReadCompletion.resolve(0);
        }
    });
    let bytesWritten = 0
    const readableCb = function() {
        let chunk: Buffer | null = null
        while (true) {
            chunk = reader.read()
            if (chunk === null) {
                return;
            }

            if (!Buffer.isBuffer(chunk)) {
                reader.removeListener('readable', readableCb);
                reader.destroy(createNonBufferChunkError(chunk))
                return;
            }

            if (!readFully) {
                break;
            }

            if (bytesWritten + chunk.length >= data.length) {
                break;
            }

            chunk.copy(data, bytesWritten)
            bytesWritten += chunk.length
            continue;
        }

        // Remove the 'readable' listener before any unshifting.
        reader.removeListener('readable', readableCb);

        const bytesLeft = Math.min(data.length - bytesWritten,
            chunk.length);
        if (bytesLeft < chunk.length) {
            reader.unshift(chunk.subarray(
                bytesLeft, chunk.length));
        }
        if (bytesLeft) {
            chunk.copy(data, bytesWritten, 0, bytesLeft);
        }

        // free finished callback
        controller.abort();

        // give time for any incoming error event
        // to take effect.
        setImmediate(() => {
            pendingReadCompletion.resolve(bytesLeft)
        });
    };
    reader.on("readable", readableCb);
    const result = await pendingReadCompletion.promise;
    // if successful, remove error listener;
    // else leave it to prevent unhandled errors
    reader.removeListener("error", ev);
    return result;
}

/**
 * Performs reads on behalf of a readable stream
 * @param reader readable stream
 * @param data destination buffer
 * @returns a promise whose result will be the number of bytes actually read, which
 * depending of the kind of reader may be less than the destination buffer size.
 */
export async function readBytes(reader: Readable, data: Buffer) {
    return await readSomeBytes(reader, data, false);
}

/**
 * Reads in data from a readable stream in order to completely fill
 * a buffer. An error occurs if an insufficient amount of bytes exist in
 * stream to fill the buffer.
 * @param reader source of bytes to read
 * @param data destination buffer to fill
 */
export async function readBytesFully(reader: Readable,
        data: Buffer): Promise<void> {
    await readSomeBytes(reader, data, true);
}

/**
 * Reads in all of a readable stream's data
 * into memory.
 * 
 * One can specify a maximum size beyond which an error will be
 * thrown if there is more data after that limit.
 * @param reader the source of data to read 
 * @param bufferingLimit indicates the maximum size in bytes of the
 * resulting in-memory buffer. Can pass zero to use a default value.
 * Can also pass a negative value which will ignore imposing a maximum
 * size.
 * @returns A promise whose result is an in-memory buffer which has
 * all of the remaining data in the stream argument.
 */
export async function readAllBytes(reader: Readable,
        bufferingLimit = 0): Promise<Buffer> {
    if (!bufferingLimit) {
        bufferingLimit = DEFAULT_DATA_BUFFER_LIMIT;
    }
    const chunks = new Array<Buffer>();
    if (bufferingLimit < 0) {
        await copyBytes(reader, new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk);
                cb();
            }
        }));
        return Buffer.concat(chunks);
    }
    
    let totalBytesRead = 0;
    for await (const chunk of reader) {
        if (bufferingLimit >= 0) {
            totalBytesRead += chunk.length;
            if (totalBytesRead > bufferingLimit) {
                throw CustomIOError.createDataBufferLimitExceededError(
                    bufferingLimit);
            }
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/**
 * Copies all bytes from a stream into another stream
 * @param reader source of data being transferred
 * @param writer destination of data being transferred
 */
export async function copyBytes(reader: Readable, writer: Writable) {
    if (!reader) {
        throw new Error("reader argument is null")
    }
    if (!writer) {
        throw new Error("writer argument is null")
    }
    // use of reader.pipe(writer) didn't work for us
    // since we were unable to determine the end of
    // writing for some of the custom writables
    // used in the library.
    // also, was not able to avoid errors with troublesome
    // writers even if reader is empty
    /*const p = createBlankChequePromise<void>()
    pump(reader, writer, e => {
        if (e) {
            p.reject(e)
        }
        p.resolve()
    })
    await p
    return*/
    while (true) {
        // NB: cannot allocate buffer once outside loop
        // because it may be stored by writer.
        const readBuffer = Buffer.alloc(DEFAULT_READ_BUFFER_SIZE)
        const bytesRead = await readBytes(
            reader, readBuffer)
        if (bytesRead > 0) {
            await writeBytes(writer,
                readBuffer.subarray(0, bytesRead))
        }
        else {
            break
        }
    }
}

/**
 * Calls end() on a writable stream and waits for it
 * to take effect or throws an error if the stream is
 * in an error state (e.g. has been destroyed with error).
 * @param writer writable stream
 */
export async function endWrites(writer: Writable) {
    const pending = createBlankChequePromise<void>()
    // passing these options fixed bug with
    // MemoryBasedTransportConnectionInternal's
    // release() method hanging forever sometimes
    const options: FinishedOptions = {
        readable: false,
        writable: false
    };
    finished(writer, options, err => {
        if (err) {
            pending.reject(err)
        }
        else {
            pending.resolve()
        }
    });
    writer.end();
    await pending.promise;
}
