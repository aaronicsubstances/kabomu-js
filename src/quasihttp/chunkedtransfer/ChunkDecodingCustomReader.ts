import { CustomChunkedTransferCodec } from "./CustomChunkedTransferCodec";
import { ChunkDecodingError } from "../errors";
import * as IOUtils from "../../common/IOUtils";
import { customReaderSymbol } from "../../common";

/**
 * Constructs an instance of the standard chunk decoder of byte streams
 * in the Kabomu library.
 * Receives a reader and assumes it consists of
 * an unknown number of one or more chunks, in which the last chunk has
 * zero data length and all the previous ones have non-empty data.
 * @param wrappedReader the source stream of bytes to decode. Must be
 * acceptable by IOUtils.readBytes() function.
 * @returns a readable stream wrapper for decoding subsequent chunks (ie not lead chunks)
 * from the provided underlying stream
 */
export function createChunkDecodingCustomReader(wrappedReader: any) {
    if (!wrappedReader) {
        throw new Error("wrappedReader argument is null");
    }
    return generate(wrappedReader);
}

function generate(wrappedReader: any) {
    const decoder = new CustomChunkedTransferCodec();
    let lastChunkSeen = false
    let chunkDataLenRem = 0
    const readAsync = async function(count: number) {
        // once empty data chunk is seen, return 0 for all subsequent reads.
        if (lastChunkSeen) {
            return undefined;
        }

        if (!chunkDataLenRem) {
            chunkDataLenRem = await decoder.decodeSubsequentChunkV1Header(
                wrappedReader);
            if (chunkDataLenRem === 0) {
                lastChunkSeen = true;
                return undefined;
            }
        }

        const bytesToRead = Math.min(chunkDataLenRem, count);
        let chunk;
        try {
            chunk = await IOUtils.readBytesFully(wrappedReader,
                bytesToRead);
        }
        catch (e) {
            throw new ChunkDecodingError("Failed to decode quasi http body while " +
                "reading in chunk data", { cause: e });
        }
        chunkDataLenRem -= bytesToRead;

        return chunk;
    }
    return {
        [customReaderSymbol]: readAsync
    }
}
