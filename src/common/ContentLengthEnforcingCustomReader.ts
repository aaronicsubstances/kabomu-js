import { CustomIOError } from "./errors";
import { parseInt48 } from "./MiscUtils";
import * as IOUtils from "./IOUtils"
import { customReaderSymbol } from "./types";

const generate = function(wrappedReader: any, expectedLength: number) {
    let bytesLeftToRead = expectedLength
    let endOfReadError: any
    const readAsync = async function(count: number) {
        if (endOfReadError) {
            throw endOfReadError;
        }

        if (bytesLeftToRead < 0) {
            return await IOUtils.readBytes(wrappedReader, count);
        }

        const bytesToRead = Math.min(bytesLeftToRead, count);

        // if bytes to read is zero at this stage,
        // go ahead and call backing reader
        // (e.g. so that any error in backing reader can be thrown),
        // unless the length requested is positive.
        let chunk: Buffer | undefined;
        if (bytesToRead > 0 || !count) {
            chunk = await IOUtils.readBytes(wrappedReader, bytesToRead);
        }

        if (chunk) {
            bytesLeftToRead -= chunk.length
        }

        // if end of read is encountered, ensure that all
        // requested bytes have been read.
        const endOfRead = bytesToRead > 0 && !chunk
        if (endOfRead && bytesLeftToRead > 0) {
            endOfReadError = CustomIOError.createContentLengthNotSatisfiedError(
                expectedLength, bytesLeftToRead);
            throw endOfReadError
        }
        return chunk;
    }
    return {
        [customReaderSymbol]: readAsync
    }
}

/**
 * Wraps another readable stream to ensure a given amount of bytes are read.
 * @param wrappedReader the backing reader. Must be acceptable by
 * IOUtils.readBytes() function.
 * @param expectedLength the expected number of bytes to guarantee or assert.
 * Can be negative to indicate that the all remaining bytes in the backing reader
 * should be returned
 * @returns a stream decorating the reader argument
 */
export function createContentLengthEnforcingCustomReader(
        wrappedReader: any, expectedLength: number) {
    if (!wrappedReader) {
        throw new Error("wrappedReader argument is null");
    }
    return generate(wrappedReader, parseInt48(expectedLength));
}