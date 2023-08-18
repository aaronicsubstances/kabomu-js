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

/**
 * Performs writes on behalf of a writable stream
 * @param writer writable stream
 * @param data source buffer of bytes to write
 * @param offset starting position in buffer to start fetching
 * bytes to write out
 * @param length number of bytes to write
 */
export async function writeBytes(writer: Writable, data: Buffer,
        offset: number, length: number) {
    if (!writer) {
        throw new Error("writer argument is null");
    }
    await new Promise<void>((resolve, reject)=> {
        const dataToUse =
            offset <= 0 && length >= data.length ?
                data :
                data.subarray(offset, offset + length);
        writer.write(dataToUse, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * Performs reads on behalf of a readable stream
 * @param reader readable stream
 * @param data destination buffer into which bytes read will be saved
 * @param offset starting position in buffer to start saving read bytes
 * @param length number of bytes to read
 * @returns a promise whose result will be the number of bytes actually read, which
 * depending of the kind of reader may be less than the number of bytes requested.
 */
export async function readBytes(reader: Readable, data: Buffer,
        offset: number, length: number) {
    if (!reader) {
        throw new Error("reader argument is null");
    }
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
                // Remove the 'readable' listener before unshifting.
                reader.removeListener('readable', readableCb);
                const bytesRead = Math.min(length, chunk.length);
                if (bytesRead < chunk.length) {
                    reader.unshift(chunk.subarray(
                        bytesRead, chunk.length));
                }
                chunk.copy(data, offset, 0, bytesRead);
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
 * a buffer. An error occurs if insufficient bytes exist in
 * stream to fill the buffer.
 * @param reader source of bytes to read
 * @param data destination buffer
 * @param offset start position in buffer to fill form
 * @param length number of bytes to read. Failure to obtain this
 * number of bytes will result in an error
 */
export async function readBytesFully(reader: Readable, data: Buffer,
        offset: number, length: number): Promise<void> {
    while (true) {
        const bytesRead = await readBytes(reader, data, offset, length);

        if (bytesRead < length) {
            if (bytesRead <= 0) {
                throw new CustomIOError("unexpected end of read");
            }
            offset += bytesRead;
            length -= bytesRead;
        }
        else {
            break;
        }
    }
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
 * @param readBufferSize The size in bytes of the temporary read
 * buffer to use. Can pass zero to use default value.
 * @returns A promise whose result is an in-memory buffer which has
 * all of the remaining data in the stream argument.
 */
export async function readAllBytes(reader: Readable, bufferingLimit = 0,
        readBufferSize = 0): Promise<Buffer> {
    if (!bufferingLimit) {
        bufferingLimit = DefaultDataBufferLimit;
    }
    if (!readBufferSize || readBufferSize < 0) {
        readBufferSize = DefaultReadBufferSize;
    }
    const chunks = new Array<Buffer>();

    const readBuffer = Buffer.allocUnsafeSlow(readBufferSize);
    let totalBytesRead = 0;

    while (true) {
        let bytesToRead = readBufferSize;
        if (bufferingLimit >= 0) {
            bytesToRead = Math.min(bytesToRead, bufferingLimit - totalBytesRead);
        }
        // force a read of 1 byte if there are no more bytes to read into memory stream buffer
        // but still remember that no bytes was expected.
        let expectedEndOfRead = false;
        if (!bytesToRead) {
            bytesToRead = 1;
            expectedEndOfRead = true;
        }
        const bytesRead = await readBytes(reader, readBuffer, 0, bytesToRead);
        if (bytesRead > 0) {
            if (expectedEndOfRead) {
                throw CustomIOError.createDataBufferLimitExceededError(
                    bufferingLimit);
            }
            chunks.push(readBuffer.subarray(0, bytesRead));
            if (bufferingLimit >= 0) {
                totalBytesRead += bytesRead;
            }
        }
        else {
            break;
        }
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

export async function endWrites(writer: Writable) {
    const p = finished(writer);
    writer.end();
    await p;
}
