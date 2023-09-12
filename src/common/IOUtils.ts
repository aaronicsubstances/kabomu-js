import {
    FinishedOptions,
    Readable,
    Writable, 
    finished
} from "stream";

import { CustomIOError, ExpectationViolationError } from "../errors";
import { createBlankChequePromise, parseInt32 } from "../MiscUtils";
import { customReaderSymbol, customWriterSymbol } from "./types";

/**
 * The limit of data buffering when reading byte streams into memory. Equal to 128 MB.
 */
export const DEFAULT_DATA_BUFFER_LIMIT = 134_217_728;

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DEFAULT_READ_BUFFER_SIZE = 8192;

export function createNonBufferChunkError(chunk: any) {
    const chunkType = typeof chunk;
    return new CustomIOError(
        "expected Buffer chunks but got chunk of type " +
        chunkType)
}

/**
 * Performs writes on behalf of a writable stream or an
 * object which supports the customWriterSymbol.
 * @param writer instance of stream.Writable or
 * an object which supports the customWriterSymbol.
 * @param data source buffer
 */
export async function writeBytes(writer: any, data: Buffer) {
    if (!writer) {
        throw new Error("writer argument is null");
    }
    // allow zero-byte writes to proceed to the
    // stream, rather than just return.
    if (writer instanceof Writable) {
        // proceed
    }
    else if (writer[customWriterSymbol]) {
        return await writer[customWriterSymbol](data)
    }
    else {
        throw new Error("writer argument does not support the " +
            "customWriterSymbol")
    }
    const writable = writer as Writable;
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
    writable.once("error", ev);
    finished(writable, finishedOptions, err => {
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
    writable.write(data, err => {
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
    writable.removeListener("error", ev);
}

async function readSomeBytes(reader: Readable, 
        count: number, readFully: boolean)
        : Promise<Buffer | undefined> {
    if (!reader) {
        throw new Error("reader argument is null");
    }
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return.
    const controller = new AbortController();
    const finishedOptions: FinishedOptions = {
        signal: controller.signal
    };
    const pendingReadCompletion = createBlankChequePromise<Buffer | undefined>()
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
            if (readFully && count > 0) {
                pendingReadCompletion.reject(
                    new CustomIOError("unexpected end of read"))
            }
            pendingReadCompletion.resolve(readFully ?
                Buffer.alloc(0) : undefined);
        }
    });
    let bytesWritten = 0
    let dataToReturn: Buffer | undefined
    if (readFully) {
        dataToReturn = Buffer.allocUnsafeSlow(count)
    }
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

            if (bytesWritten + chunk.length >= count) {
                break;
            }

            chunk.copy(dataToReturn!, bytesWritten)
            bytesWritten += chunk.length
            continue;
        }

        // Remove the 'readable' listener before any unshifting.
        reader.removeListener('readable', readableCb);

        const bytesLeft = Math.min(count - bytesWritten,
            chunk.length);
        if (bytesLeft < chunk.length) {
            reader.unshift(chunk.subarray(
                bytesLeft, chunk.length));
        }
        if (bytesLeft) {
            if (readFully) {
                chunk.copy(dataToReturn!, bytesWritten, 0, bytesLeft);
            }
            else {
                dataToReturn = chunk
                if (bytesLeft < chunk.length) {
                    dataToReturn = chunk.subarray(0, bytesLeft)
                }
            }
        }

        // free finished callback
        controller.abort();

        // give time for any incoming error event
        // to take effect.
        setImmediate(() => {
            pendingReadCompletion.resolve(dataToReturn)
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
 * @param reader instance of stream.Readable or
 * an object which supports the customReaderSymbol.
 * @param count number of bytes to read
 * @returns a promise whose result will be the number of bytes actually read, which
 * depending of the kind of reader may be less than the size requested.
 */
export async function readBytes(reader: any, count: number) {
    count = parseInt32(count)
    if (count < 0) {
        throw new Error("count argument cannot be negative: " + count)
    }
    return await readSomeBytes(reader, count, false);
}

/**
 * Reads in data from a readable stream in order to completely reach
 * a certain count. An error occurs if an insufficient amount of bytes exist.
 * @param reader source of bytes to read. Must be acceptable by
 * the readBytes() function of this module.
 * @param count exact number of bytes to read.
 */
export async function readBytesFully(reader: any,
        count: number): Promise<Buffer> {
    count = parseInt32(count)
    if (count < 0) {
        throw new Error("count argument cannot be negative: " + count)
    }
    const result = await readSomeBytes(reader, count, true);
    return result!
}

/**
 * Reads in all of a readable stream's data
 * into memory.
 * 
 * One can specify a maximum size beyond which an error will be
 * thrown if there is more data after that limit.
 * @param reader the source of data to read. Must be acceptable
 * by the readBytes() function of this module
 * @param bufferingLimit indicates the maximum size in bytes of the
 * resulting in-memory buffer. Can pass zero to use a default value.
 * Can also pass a negative value which will ignore imposing a maximum
 * size.
 * @returns A promise whose result is an in-memory buffer which has
 * all of the remaining data in the stream argument.
 */
export async function readAllBytes(reader: any,
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

    if (reader instanceof Readable) {
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
    }
    else {
        while (true) {
            let bytesToRead = Math.min(DEFAULT_READ_BUFFER_SIZE,
                bufferingLimit - totalBytesRead);
            // force a read of 1 byte if there are no more bytes to read into memory stream buffer
            // but still remember that no bytes was expected.
            let expectedEndOfRead = false;
            if (bytesToRead === 0) {
                bytesToRead = 1;
                expectedEndOfRead = true;
            }
            const chunk = await readBytes(reader, bytesToRead);
            if (chunk) {
                if (expectedEndOfRead) {
                    throw CustomIOError.createDataBufferLimitExceededError(
                        bufferingLimit);
                }
                chunks.push(chunk);
                totalBytesRead += chunk.length;
            }
            else {
                break;
            }
        }
    }

    return Buffer.concat(chunks);
}

/**
 * Copies all bytes from a stream into another stream
 * @param reader source of data being transferred. Must be
 * acceptable by the readBytes() function of this module.
 * @param writer destination of data being transferred
 * which is acceptable by writeBytes() function.
 */
export async function copyBytes(reader: any, writer: any) {
    if (!reader) {
        throw new Error("reader argument is null")
    }
    if (!writer) {
        throw new Error("writer argument is null")
    }
    while (true) {
        const bytesRead = await readBytes(reader,
            DEFAULT_READ_BUFFER_SIZE)
        if (bytesRead && bytesRead.length > 0) {
            await writeBytes(writer, bytesRead)
        }
        else {
            break
        }
    }
}
