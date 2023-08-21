import { Readable, Writable, finished as finishedWithCb } from "stream";
import { finished } from "node:stream/promises";

import { CustomIOError } from "./errors";

/**
 * The limit of data buffering when reading byte streams into memory. Equal to 128 MB.
 */
export const DefaultDataBufferLimit = 134_217_728;

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DefaultReadBufferSize = 8192;

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
    await new Promise<void>((resolve, reject)=> {
        const controller = new AbortController();
        const finishedOptions = {
            signal: controller.signal
        };
        finishedWithCb(writer, finishedOptions, err => {
            if (!finishedOptions.signal.aborted) {
                if (err) {
                    reject(err);
                }
                else {
                    reject(new CustomIOError("end of write"));
                }
            }
        });
        writer.write(data, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
            // important to only abort after resolve() or reject()
            controller.abort();
        });
    });
}

/**
 * Performs reads on behalf of a readable stream
 * @param reader readable stream
 * @param data destination buffer
 * @returns a promise whose result will be the number of bytes actually read, which
 * depending of the kind of reader may be less than the destination buffer size.
 */
export async function readBytes(reader: Readable, data: Buffer) {
    if (!reader) {
        throw new Error("reader argument is null");
    }
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return 0.
    return await new Promise<number>((resolve, reject) => {
        const controller = new AbortController();
        const finishedOptions = {
            signal: controller.signal
        };
        let readableCb: any;
        finishedWithCb(reader, finishedOptions, err => {
            reader.removeListener("readable", readableCb);
            if (err && !finishedOptions.signal.aborted) {
                reject(err);
            }
            else {
                resolve(0);
            }
        });
        readableCb = function() {
            const chunk = reader.read() as Buffer | null;
            if (chunk !== null) {
                // Remove the 'readable' listener before any unshifting.
                reader.removeListener('readable', readableCb);
                if (!Buffer.isBuffer(chunk)) {
                    reject(createNonBufferChunkError(chunk))

                    // important to only abort after reject()
                    controller.abort();
                    return;
                }

                const bytesRead = Math.min(data.length, chunk.length);
                if (bytesRead < chunk.length) {
                    if (bytesRead) {
                        reader.unshift(chunk.subarray(
                            bytesRead, chunk.length));
                    }
                    else {
                        reader.unshift(chunk);
                    }
                }
                if (bytesRead) {
                    chunk.copy(data, 0, 0, bytesRead);
                }
                resolve(bytesRead);

                // important to only abort after resolve()
                controller.abort();
            }
        };
        reader.on("readable", readableCb);
    });
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
    if (!reader) {
        throw new Error("reader argument is null");
    }
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return.
    await new Promise<void>((resolve, reject) => {
        const controller = new AbortController();
        const finishedOptions = {
            signal: controller.signal
        };
        let readableCb: any;
        finishedWithCb(reader, finishedOptions, err => {
            reader.removeListener("readable", readableCb);
            if (!finishedOptions.signal.aborted) {
                if (err) {
                    reject(err);
                }
                else {
                    if (data.length > 0) {
                        reject(new CustomIOError("unexpected end of read"));
                    }
                    else {
                        resolve()
                    }
                }
            }
        });
        let bytesWritten = 0;
        readableCb = function() {
            let chunk: Buffer | null;
            while ((chunk = reader.read()) !== null) {
                if (!Buffer.isBuffer(chunk)) {
                    reader.removeListener('readable', readableCb)
                    reject(createNonBufferChunkError(chunk))

                    // important to only abort after reject()
                    controller.abort();
                    break;
                }

                if (bytesWritten + chunk.length < data.length) {
                    chunk.copy(data, bytesWritten);
                    bytesWritten += chunk.length;
                    continue;
                }
                // Remove the 'readable' listener before any unshifting.
                reader.removeListener('readable', readableCb);
                const bytesLeft = data.length - bytesWritten;
                if (bytesLeft < chunk.length) {
                    reader.unshift(chunk.subarray(
                        bytesLeft, chunk.length));
                }
                chunk.copy(data, bytesWritten, 0, bytesLeft);
                resolve();

                // important to only abort after resolve()
                controller.abort();
                break;
            }
        };
        reader.on("readable", readableCb);
    });
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
        bufferingLimit = DefaultDataBufferLimit;
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
    const p = finished(reader);
    reader.pipe(writer, { end: false });
    await p;
}

/**
 * Calls end() on a writable stream and waits for it
 * to take effect or throws an error if the stream is
 * in an error state (e.g. has been destroyed with error).
 * @param writer writable stream
 */
export async function endWrites(writer: Writable) {
    const p = finished(writer);
    writer.end();
    await p;
}
