import { Readable } from "stream";

import { ChunkedTransferCodec } from "./ChunkedTransferCodec";
import { ChunkDecodingError } from "../errors";
import * as IOUtils from "../../common/IOUtils";

/**
 * Constructs an instance of the standard chunk decoder of byte streams
 * in the Kabomu library.
 * Receives a reader and assumes it consists of
 * an unknown number of one or more chunks, in which the last chunk has
 * zero data length and all the previous ones have non-empty data.
 * @param wrappedReader the source stream of bytes to decode
 * @param maxChunkSize the maximum allowable size of a chunk seen in the body instance being decoded.
 * NB: values less than 64KB are always accepted, and so this parameter imposes a maximum only on chunks
 * with lengths greater than 64KB.
 * @returns a readable stream wrapper for decoding subsequent chunks (ie not lead chunks)
 * from the provided underlying stream
 */
export function createChunkDecodingCustomReader(
        wrappedReader: Readable, maxChunkSize = 0) {
    if (!wrappedReader) {
        throw new Error("wrappedReader argument is null");
    }
    return Readable.from(generate(wrappedReader, maxChunkSize));
}

async function* generate(wrappedReader: Readable, maxChunkSize: number) {
    const decoder = new ChunkedTransferCodec();
    while (true) {
        const chunkDataLen = await decoder.decodeSubsequentChunkV1Header(
            null, wrappedReader, maxChunkSize);
        if (chunkDataLen === 0) {
            break;
        }
        const chunk = Buffer.alloc(chunkDataLen);
        try {
            await IOUtils.readBytesFully(wrappedReader,
                chunk, 0, chunk.length);
            yield chunk;
        }
        catch (e) {
            throw new ChunkDecodingError("Error encountered while " +
                "decoding a subsequent chunk body", { cause: e });
        }
    }
}
