import { Readable } from "stream";
import { KabomuIOError } from "../errors";
import * as IOUtilsInternal from "../IOUtilsInternal";
import * as MiscUtilsInternal from "../MiscUtilsInternal";

const generateContentChunksForEnforcingContentLength = 
    async function*(backingStream: Readable, contentLength: number) {
        let bytesLeft = contentLength
        while (true) {
            const bytesToRead = Math.min(
                bytesLeft,
                IOUtilsInternal.DEFAULT_READ_BUFFER_SIZE)
            const chunk = await IOUtilsInternal.tryReadBytesFully(
                backingStream, bytesToRead)
            if (!chunk.length) {
                break
            }
            yield chunk
            bytesLeft -= chunk.length
            if (!bytesLeft) {
                break
            }
            if (chunk.length < bytesToRead) {
                break
            }
        }
        if (bytesLeft > 0) {
            throw KabomuIOError.createContentLengthNotSatisfiedError(
                contentLength, bytesLeft)
        }
    }

/**
 * Wraps another readable stream to ensure a given amount of bytes are read.
 * @param backingStream the source stream.
 * @param contentLength the expected number of bytes to guarantee or assert.
 * @returns a stream for enforcing any supplied content length
 */
export function createContentLengthEnforcingStream(
        backingStream: Readable,
        contentLength: number) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    contentLength = MiscUtilsInternal.parseInt48(contentLength);
    if (contentLength < 0) {
        throw new Error(
            `content length cannot be negative: ${contentLength}`)
    }
    return Readable.from(
        generateContentChunksForEnforcingContentLength(backingStream,
            contentLength));
}