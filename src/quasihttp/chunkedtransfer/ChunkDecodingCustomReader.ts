import { Readable } from "stream";

import { ChunkedTransferUtils } from "./ChunkedTransferUtils";
import { ChunkDecodingError } from "../errors";

const generate = async function*(wrappedReader: Readable, maxChunkSize: number) {
    if (maxChunkSize < ChunkedTransferUtils.DefaultMaxChunkSizeLimit) {
        maxChunkSize = ChunkedTransferUtils.DefaultMaxChunkSizeLimit;
    }
    let chunkDataLenRem = 0;
    const buffered = new Array<Buffer>();
    let data = Buffer.from([]);
    const chunkTransferUtils = new ChunkedTransferUtils();
    for await (const chunk of wrappedReader) {
        if (chunkDataLenRem === 0) {
            buffered.push(chunk);
            const totalLen = buffered.reduce((acc, cur) => acc + cur.length, 0);
            if (totalLen < ChunkedTransferUtils.LengthOfEncodedChunkLength + 2) {
                continue;
            }
            data = Buffer.concat(buffered);
            buffered.length = 0;

            chunkDataLenRem = await chunkTransferUtils.decodeSubsequentChunkV1Header(
                data, null, maxChunkSize);
            const extraDataLen = data.length - ChunkedTransferUtils.LengthOfEncodedChunkLength - 2;
            if (chunkDataLenRem === 0) {                
                if (extraDataLen > 0) {
                    wrappedReader.unshift(data.subarray(
                        ChunkedTransferUtils.LengthOfEncodedChunkLength + 2,
                        data.length));
                }
                break;
            }
            if (extraDataLen > 0) {
                yield data.subarray(
                    ChunkedTransferUtils.LengthOfEncodedChunkLength + 2,
                    data.length);
                chunkDataLenRem -= extraDataLen;
            }
        }
        else {
            if (chunk.length <= chunkDataLenRem) {
                yield chunk;
                chunkDataLenRem -= chunk.length;
            }
            else {
                yield chunk.subarray(0, chunkDataLenRem);
                wrappedReader.unshift(chunk.subarray(chunkDataLenRem,
                    chunk.length));
                chunkDataLenRem = 0;
            }
        }
    }

    // conclusion
    if (chunkDataLenRem == 0 && buffered.length > 0) {
        data = Buffer.concat(buffered);
        chunkDataLenRem = await chunkTransferUtils.decodeSubsequentChunkV1Header(
            data, null, maxChunkSize);
        const extraDataLen = data.length - ChunkedTransferUtils.LengthOfEncodedChunkLength - 2;
        if (chunkDataLenRem === 0) {
            if (extraDataLen > 0) {
                wrappedReader.unshift(data.subarray(
                    ChunkedTransferUtils.LengthOfEncodedChunkLength + 2,
                    data.length));
            }
        }
        else {
            if (extraDataLen > 0) {
                yield data.subarray(
                    ChunkedTransferUtils.LengthOfEncodedChunkLength + 2,
                    data.length);
                chunkDataLenRem -= extraDataLen;
            }
        }
    }
    if (chunkDataLenRem > 0) {
        throw new ChunkDecodingError("unexpected end of read");
    }
}

export function createChunkDecodingCustomReader(
        wrappedReader: Readable, maxChunkSize = 0) {
    return Readable.from(generate(wrappedReader, maxChunkSize));
}
