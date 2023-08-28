import { Readable } from "stream";

import { CustomIOError } from "./errors";
import { parseInt48 } from "./MiscUtils";

const generate = async function*(wrappedReader: Readable, expectedLength: number) {
    let bytesLeftToRead = expectedLength;
    if (!bytesLeftToRead) {
        // if bytes left to read is zero,
        // leave it to Readable.from() result to decide
        // on whether or not to go ahead and call backing reader
        // (e.g. so that any error in backing reader can be thrown).
    }
    for await (const chunk of wrappedReader) {
        if (bytesLeftToRead < 0) {
            yield chunk;
        }
        else if (bytesLeftToRead >= chunk.length) {
            yield chunk;
            bytesLeftToRead -= chunk.length;
            if (!bytesLeftToRead) {
                break;
            }
        }
        else {
            const numRead = Number(bytesLeftToRead);
            yield chunk.subarray(0, numRead);
            wrappedReader.unshift(chunk.subarray(numRead,
                chunk.length));
            bytesLeftToRead = 0;
            break;
        }
    }
    // if end of read is encountered, ensure that all
    // requested bytes have been read.
    if (bytesLeftToRead > 0) {
        throw CustomIOError.createContentLengthNotSatisfiedError(
                expectedLength, bytesLeftToRead);
    }
}

/**
 * Wraps another readable stream to ensure a given amount of bytes are read.
 * @param wrappedReader the backing reader
 * @param expectedLength the expected number of bytes to guarantee or assert.
 * Can be negative to indicate that the all remaining bytes in the backing reader
 * should be returned
 * @returns a stream decorating the reader argument
 */
export function createContentLengthEnforcingCustomReader(
        wrappedReader: Readable, expectedLength: number) {
    if (!wrappedReader) {
        throw new Error("wrappedReader argument is null");
    }
    return Readable.from(generate(wrappedReader, 
        parseInt48(expectedLength)));
}