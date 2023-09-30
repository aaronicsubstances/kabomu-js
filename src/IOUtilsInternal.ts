import { Readable, finished } from "stream";
import {
    ExpectationViolationError,
    KabomuIOError
} from "./errors";
import { createBlankChequePromise } from "./MiscUtilsInternal";

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DEFAULT_READ_BUFFER_SIZE = 8192;

export function createNonBufferChunkError(chunk: any) {
    const chunkType = typeof chunk;
    return new KabomuIOError(
        "expected Buffer chunks but got chunk of type " +
        chunkType)
}

/**
 * Reads bytes from a stream as much as possible, until
 * either desired number of bytes are obtained, stream
 * is exhausted, or an error is encountered.
 * @param stream source readable byte stream
 * @param count maximum number of bytes to read
 * @param abortSignal 
 */
export async function tryReadBytesFully(
        stream: Readable, count: number,
        abortSignal?: AbortSignal): Promise<Buffer> {
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return.
    abortSignal?.throwIfAborted();

    const successIndicator = new AbortController();
    const chunks = new Array<Buffer>();
    let totalBytesRead = 0;
    const onReadable = () => {
        abortSignal?.throwIfAborted()
        let chunk: Buffer | null;
        while ((chunk = stream.read()) !== null) {
            if (!Buffer.isBuffer(chunk)) {
                stream.destroy(createNonBufferChunkError(chunk))
                return;
            }

            if (totalBytesRead + chunk.length < count) {
                chunks.push(chunk);
                totalBytesRead += chunk.length;
            }
            else {
                let outstanding: Buffer | undefined;
                if (totalBytesRead + chunk.length === count) {
                    chunks.push(chunk);
                    totalBytesRead += chunk.length;
                }
                else {
                    const bytesLeft = count - totalBytesRead;
                    totalBytesRead += bytesLeft;
                    chunks.push(chunk.subarray(0, bytesLeft));
                    outstanding = chunk.subarray(bytesLeft);
                }
                // Remove the 'readable' listener before unshifting.
                stream.removeListener("readable", onReadable)
                if (outstanding) {
                    stream.unshift(outstanding);
                }
                successIndicator.abort();
                break;
            }
        }
    }
    stream.on("readable", onReadable);
    
    const options = {
        signal: successIndicator.signal
    };
    const blankCheque = createBlankChequePromise<Buffer>()
    const cleanup = finished(stream, options, (err) => {
        cleanup();
        stream.removeListener("readable", onReadable)
        if (err) {
            if (successIndicator.signal.aborted) {
                // no problem, treat as success
            }
            else {
                blankCheque.reject(err)
                return;
            }
        }
        if (totalBytesRead > count) {
            blankCheque.reject(new ExpectationViolationError(
                "total bytes read exceeded requested number " +
                `${totalBytesRead} > ${count}`));
        }
        else {
            const result = Buffer.concat(chunks);
            blankCheque.resolve(result);
        }
    });
    return await blankCheque.promise;
}

export async function readBytesFully(
        stream: Readable, count: number,
        abortSignal?: AbortSignal): Promise<Buffer> {
    const data = await tryReadBytesFully(stream,
        count, abortSignal)
    if (data.length !== count) {
        throw KabomuIOError._createEndOfReadError();
    }
    return data;
}