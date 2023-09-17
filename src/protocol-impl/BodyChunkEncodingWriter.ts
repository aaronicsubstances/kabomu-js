import * as MiscUtilsInternal from "../MiscUtilsInternal"
import { ExpectationViolationError } from "../errors";
import * as QuasiHttpCodec from "./QuasiHttpCodec"

export const LENGTH_OF_ENCODED_BODY_CHUNK_LENGTH = 10;

const MAX_BODY_CHUNK_LENGTH = 1_000_000_000;

/**
 * The standard encoder of quasi http body chunks on the fly
 * in accordance with the quasi web protocol
 * defined in the Kabomu library, to any destination
 * represented by a function which consumes byte chunks.
 */
export class BodyChunkEncodingWriter {

    static _encodeBodyChunkV1Header(length: number) {
        if (length < 0) {
            throw new ExpectationViolationError(
                `length argument is negative: ${length}`);
        }
        if (length > MAX_BODY_CHUNK_LENGTH) {
            throw new ExpectationViolationError(
                `length argument is too large: ${length}`);
        }
        const serializedHeader = QuasiHttpCodec._PROTOCOL_VERSION_01 + "," +
            `${length}`.padStart(LENGTH_OF_ENCODED_BODY_CHUNK_LENGTH, '0');
        return MiscUtilsInternal.stringToBytes(serializedHeader);
    }

    generateEndBodyChunk() {
        const header = BodyChunkEncodingWriter._encodeBodyChunkV1Header(0);
        return header;
    }

    *generateBodyChunks(data: Buffer) {
        if (!data) {
            throw new Error("data argument is null");
        }
        let offset = 0;
        while (offset < data.length) {
            const nextChunkLength = Math.min(data.length - offset,
                MAX_BODY_CHUNK_LENGTH);
            const header = BodyChunkEncodingWriter._encodeBodyChunkV1Header(
                nextChunkLength);
            yield header;
            yield data.subarray(offset, offset + nextChunkLength);
            offset += nextChunkLength;
        }
    }
}