import { Readable, Writable } from "stream";
import * as ByteUtils from "../../common/ByteUtils";
import * as IOUtils from "../../common/IOUtils";
import { LeadChunk } from "./LeadChunk";
import { ChunkDecodingError } from "../errors";

/**
 * The default value of max chunk size used by quasi http servers and clients.
 * Equal to 8,192 bytes.
 */
export const DefaultMaxChunkSize = 8192;

/**
 * The maximum value of a max chunk size that can be tolerated during chunk decoding even if it
 * exceeds the value used for sending. Equal to 65,536 bytes.
 * 
 * Practically this means that communicating parties can safely send chunks not exceeding 64KB without
 * fear of rejection and without prior negotiation. Beyond 64KB however, communicating parties must have
 * some prior negotiation (manual or automated) on max chunk sizes, or else chunks may be rejected
 * by receivers as too large.
 */
export const DefaultMaxChunkSizeLimit = 65_536;

/**
 * Constant used internally to indicate the number of bytes used to encode the length
 * of a lead or subsequent chunk, which is 3.
 */
const LengthOfEncodedChunkLength = 3;

/**
 * Constant which communicates the largest chunk size possible with the standard chunk transfer 
 * implementation in the Kabomu library, and that is currently the largest
 * signed integer that can fit into 3 bytes.
 */
export const HardMaxChunkSizeLimit = 8_388_607;

export async function encodeSubsequentChunkV1Header(
        chunkDataLength: number, writer: Writable, bufferToUse: Buffer):
        Promise<void> {
    ByteUtils.serializeUpToInt32BigEndian(
        chunkDataLength + 2, bufferToUse, 0,
        LengthOfEncodedChunkLength)
    bufferToUse[LengthOfEncodedChunkLength] = LeadChunk.Version01
    bufferToUse[LengthOfEncodedChunkLength + 1] = 0 // flags.
    await IOUtils.writeBytes(writer, bufferToUse, 0, LengthOfEncodedChunkLength + 2)
}

export async function decodeSubsequentChunkV1Header(
        reader: Readable, bufferToUse: Buffer, maxChunkSize: number):
        Promise<number> {
    try {
        await IOUtils.readBytesFully(reader, bufferToUse, 0,
            LengthOfEncodedChunkLength + 2);
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

export async function readLeadChunk(reader: Readable, maxChunkSize = 0):
        Promise<LeadChunk | null> {
    if (!reader) {
        throw new Error("reader argument is null");
    }
    if (!maxChunkSize || maxChunkSize < 0) {
        maxChunkSize = DefaultMaxChunkSize;
    }
    let chunkBytes: Buffer | undefined;
    try {
        const encodedLength = Buffer.allocUnsafeSlow(LengthOfEncodedChunkLength);
        if (await IOUtils.readBytes(reader, encodedLength, 0, 1) <= 0) {
            return null;
        }
        await IOUtils.readBytesFully(reader, encodedLength, 1,
            encodedLength.length - 1);
        const chunkLen = ByteUtils.deserializeUpToInt32BigEndian(encodedLength, 0,
            encodedLength.length, true);
        validateChunkLength(chunkLen, maxChunkSize);
        chunkBytes = Buffer.allocUnsafeSlow(chunkLen);
    }
    catch (e) {
        throw new ChunkDecodingError("Failed to decode quasi http headers while " +
            "decoding a chunk header", { cause: e});
    }

    try {
        await IOUtils.readBytesFully(reader, chunkBytes, 0,
            chunkBytes.length);
    }
    catch (e) {
        throw new ChunkDecodingError("Failed to decode quasi http headers while " +
            "reading in chunk data", { cause: e});
    }

    try
    {
        const chunk = LeadChunk.deserialize(chunkBytes, 0, chunkBytes.length);
        return chunk;
    }
    catch (e) {
        throw new ChunkDecodingError("Encountered invalid chunk of quasi http headers",
            { cause: e});
    }
}

function validateChunkLength(chunkLen: number, maxChunkSize: number) {
    if (chunkLen < 0) {
        throw new Error(`received negative chunk size of ${chunkLen}`);
    }
    if (chunkLen > DefaultMaxChunkSizeLimit && chunkLen > maxChunkSize) {
        throw new Error(
            `received chunk size of {chunkLen} exceeds` +
            ` default limit on max chunk size (${DefaultMaxChunkSizeLimit})` +
            ` as well as maximum configured chunk size of ${maxChunkSize}`);
    }
}

export async function writeLeadChunk(writer: Writable, chunk: LeadChunk,
        maxChunkSize = 0): Promise<void> {
    if (!writer) {
        throw new Error("writer argument is null");
    }
    if (!maxChunkSize || maxChunkSize < 0) {
        maxChunkSize = DefaultMaxChunkSize;
    }
    chunk.updateSerializedRepresentation();
    const byteCount = chunk.calculateSizeInBytesOfSerializedRepresentation();
    if (byteCount > maxChunkSize) {
        throw new Error(`headers larger than max chunk size of ${maxChunkSize}`);
    }
    if (byteCount > HardMaxChunkSizeLimit) {
        throw new Error(`headers larger than max chunk size limit of ${HardMaxChunkSizeLimit}`);
    }
    const encodedLength = Buffer.allocUnsafeSlow(LengthOfEncodedChunkLength);
    ByteUtils.serializeUpToInt32BigEndian(byteCount, encodedLength, 0,
        encodedLength.length);
    await IOUtils.writeBytes(writer, encodedLength, 0, encodedLength.length);
    await chunk.writeOutSerializedRepresentation(writer);
}
