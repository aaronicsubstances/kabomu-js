import { Readable, Writable } from "stream";
import { CustomIOError } from "./errors";

/**
 * The limit of data buffering when reading byte streams into memory. Equal to 128 MB.
 */
export const DefaultDataBufferLimit = 134_217_728;

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DefaultReadBufferSize = 8192;

export async function readBytes(reader: Readable, data: Buffer,
        offset: number, length: number): Promise<number> {
    const p = new Promise<number>((resolve, reject) => {
        const onError = function(err: any) {
            reader.removeListener('readable', onReadable);
            reader.removeListener('end', onEnd);
            reject(err);
        };
        const onEnd = function() {
            reader.removeListener('readable', onReadable);
            reader.removeListener('error', onError);
            resolve(0);
        };
        const onReadable = function() {
            const chunk = reader.read() as Buffer | null;
            if (chunk !== null) {
                // Remove the 'readable' listener before unshifting.
                reader.removeListener('readable', onReadable);
                reader.removeListener('end', onEnd);
                const bytesRead = Math.min(length, chunk.length);
                if (bytesRead < chunk.length) {
                    reader.unshift(chunk.subarray(
                        bytesRead, chunk.length));
                }
                chunk.copy(data, offset, 0, bytesRead);
                reader.removeListener('error', onError);
                resolve(bytesRead);
            }
        };
        reader.on("readable", onReadable);
        reader.once("end", onEnd);
        reader.once("error", onError);
    })
    return await p;
}

export async function writeBytes(writer: Writable, data: Buffer,
        offset: number, length: number) {
    await new Promise<void>((resolve, reject)=> {
        const writeCb = (err: any) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        };
        const repeater = function() {
            if (!writer.write(data.subarray(offset, offset + length), writeCb)) {
                writer.once("drain", repeater);
            }
        }
        repeater();
    });
}

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

export async function copyBytes(reader: Readable, writer: Writable) {
    await new Promise<void>((resolve, reject) => {
        const onError = function(err: any) {
            reader.removeListener('end', onEnd);
            reject(err);
        };
        const onEnd = function() {
            reader.removeListener('error', onError);
            resolve();
        };
        reader.pipe(writer, { end: false });
        reader.once("end", onEnd);
        reader.once("error", onError);
    });
}

export async function endWrites(writer: Writable) {
    new Promise<void>((resolve, reject) => {
        writer.end((err: any) => {
            if (err) {
                reject(err)
            }
            else {
                resolve()
            }
        });
    });
}
