import { Readable } from "stream";
import { CustomIOError } from "./errors";

const generate = async function*(wrappedReader: Readable, expectedLength: bigint) {
    let bytesLeftToRead = expectedLength;
    if (!bytesLeftToRead) {
        return;
    }
    for await (const chunk of wrappedReader) {
        if (bytesLeftToRead < 0) {
            yield chunk;
        }
        else if (bytesLeftToRead >= chunk.length) {
            yield chunk;
            bytesLeftToRead -= chunk.length;
            if (bytesLeftToRead === BigInt(0)) {
                break;
            }
        }
        else {
            const numRead = Number(bytesLeftToRead);
            yield Buffer.from(chunk.buffer, 0, numRead);
            wrappedReader.unshift(Buffer.from(chunk.buffer, numRead,
                chunk.length - numRead));
            bytesLeftToRead = BigInt(0);
            break;
        }
    }
    if (bytesLeftToRead > 0) {
        throw CustomIOError.createContentLengthNotSatisfiedError(
                expectedLength, bytesLeftToRead);
    }
}

export function createContentLengthEnforcingCustomReader(
        wrappedReader: Readable, expectedLength: bigint) {
    return Readable.from(generate(wrappedReader, expectedLength));
}