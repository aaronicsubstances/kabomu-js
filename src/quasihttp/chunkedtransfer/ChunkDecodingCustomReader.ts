import { Readable } from "stream";
import * as ByteUtils from "../../common/ByteUtils";
import * as ChunkedTransferUtils from "./ChunkedTransferUtils";
import { ChunkDecodingError } from "../errors";
import { CustomIOError } from "../../common/errors";

const LengthOfEncodedChunkLength = 3;

function decodeSubsequentChunkV1Header(
        bufferToUse: Buffer, maxChunkSize: number) {
    try {
        const chunkLen = ByteUtils.deserializeUpToInt32BigEndian(bufferToUse,
            0, LengthOfEncodedChunkLength, true);
        validateChunkLength(chunkLen, maxChunkSize);

        const version = bufferToUse[LengthOfEncodedChunkLength];
        //const flags = bufferToUse[LengthOfEncodedChunkLength+1];
        if (!version) {
            throw new Error("version not set");
        }
        const chunkDataLen = chunkLen - 2;
        return chunkDataLen;
    }
    catch (e) {
        throw new ChunkDecodingError("Error encountered while " +
            "decoding a subsequent chunk header", { cause: e });
    }
}

function validateChunkLength(chunkLen: number, maxChunkSize: number) {
    if (chunkLen < 0) {
        throw new Error(`received negative chunk size of ${chunkLen}`);
    }
    if (chunkLen > ChunkedTransferUtils.DefaultMaxChunkSizeLimit && chunkLen > maxChunkSize) {
        throw new Error(
            `received chunk size of {chunkLen} exceeds` +
            ` default limit on max chunk size (${ChunkedTransferUtils.DefaultMaxChunkSizeLimit})` +
            ` as well as maximum configured chunk size of ${maxChunkSize}`);
    }
}

const generate = async function*(wrappedReader: Readable, maxChunkSize: number) {
    if (maxChunkSize < ChunkedTransferUtils.DefaultMaxChunkSizeLimit) {
        maxChunkSize = ChunkedTransferUtils.DefaultMaxChunkSizeLimit;
    }
    let chunkDataLenRem = 0;
    const buffered = new Array<Buffer>();
    let data = Buffer.from([]);
    for await (const chunk of wrappedReader) {
        if (chunkDataLenRem === 0) {
            buffered.push(chunk);
            const totalLen = buffered.reduce((acc, cur) => acc + cur.length, 0);
            if (totalLen < LengthOfEncodedChunkLength + 2) {
                continue;
            }
            data = Buffer.concat(buffered);
            buffered.length = 0;

            chunkDataLenRem = decodeSubsequentChunkV1Header(
                Buffer.from(data.buffer, 0, LengthOfEncodedChunkLength + 2),
                maxChunkSize);
            if (chunkDataLenRem === 0) {                
                if (data.length > LengthOfEncodedChunkLength + 2) {
                    wrappedReader.unshift(Buffer.from(data.buffer,
                        LengthOfEncodedChunkLength + 2,
                        data.length - LengthOfEncodedChunkLength - 2));
                }
                break;
            }
            if (data.length > LengthOfEncodedChunkLength + 2) {
                yield Buffer.from(data.buffer,
                    LengthOfEncodedChunkLength + 2,
                    data.length - LengthOfEncodedChunkLength - 2);
                chunkDataLenRem -= data.length - LengthOfEncodedChunkLength - 2;
            }
        }
        else {
            if (chunk.length <= chunkDataLenRem) {
                yield chunk;
                chunkDataLenRem -= chunk.length;
            }
            else {
                yield Buffer.from(chunk.buffer, 0, chunkDataLenRem);
                wrappedReader.unshift(Buffer.from(chunk.buffer, chunkDataLenRem,
                    chunk.length - chunkDataLenRem));
                chunkDataLenRem = 0;
            }
        }
    }

    // conclusion
    if (chunkDataLenRem == 0 && buffered.length > 0) {
        data = Buffer.concat(buffered);
        chunkDataLenRem = decodeSubsequentChunkV1Header(data,
            maxChunkSize);
        if (chunkDataLenRem === 0) {
            if (data.length > LengthOfEncodedChunkLength + 2) {
                wrappedReader.unshift(Buffer.from(data.buffer,
                    LengthOfEncodedChunkLength + 2,
                    data.length - LengthOfEncodedChunkLength - 2));
            }
        }
        else {
            if (data.length > LengthOfEncodedChunkLength + 2) {
                yield Buffer.from(data.buffer,
                    LengthOfEncodedChunkLength + 2,
                    data.length - LengthOfEncodedChunkLength - 2);
                chunkDataLenRem -= data.length - LengthOfEncodedChunkLength - 2;
            }
        }
    }
    if (chunkDataLenRem > 0) {
        throw new CustomIOError("unexpected end of read");
    }
}

export function createChunkDecodingCustomReader(
        wrappedReader: Readable, maxChunkSize: number) {
    return Readable.from(generate(wrappedReader, maxChunkSize));
}
