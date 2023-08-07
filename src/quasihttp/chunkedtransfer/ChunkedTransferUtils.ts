import { Readable, Writable } from "stream"
import * as ByteUtils from "../../common/ByteUtils"
import * as IOUtils from "../../common/IOUtils"
import { LeadChunk } from "./LeadChunk"
import { ChunkDecodingError } from "../errors"

export const DefaultMaxChunkSize = IOUtils.DefaultReadBufferSize

export const DefaultMaxChunkSizeLimit = 65_536

export const LengthOfEncodedChunkLength = 3

export const HardMaxChunkSizeLimit = 1 << 8 * LengthOfEncodedChunkLength - 1 - 1

export async function _encodeSubsequentChunkHeader(
        chunkDataLength: number, writer: Writable, bufferToUse: Buffer):
        Promise<void> {
    ByteUtils.serializeUpToInt64BigEndian(
        BigInt(chunkDataLength + 2), bufferToUse, 0,
        LengthOfEncodedChunkLength)
    bufferToUse[LengthOfEncodedChunkLength] = LeadChunk.Version01
    bufferToUse[LengthOfEncodedChunkLength + 1] = 0 // flags.
    await IOUtils.writeBytesFully(writer, bufferToUse, 0, LengthOfEncodedChunkLength + 2)
}

export async function _decodeSubsequentChunkHeader(
        reader: Readable, bufferToUse: Buffer, maxChunkSize: number):
        Promise<number> {
    try {
        await IOUtils.readBytesFully(reader, bufferToUse, 0,
            LengthOfEncodedChunkLength + 2)
        const chunkLen = Number(ByteUtils.deserializeUpToInt64BigEndian(bufferToUse,
            0, LengthOfEncodedChunkLength, true))
        validateChunkLength(chunkLen, maxChunkSize)

        const version = bufferToUse[LengthOfEncodedChunkLength]
        //const flags = bufferToUse[LengthOfEncodedChunkLength+1]
        if (!version) {
            throw new Error("version not set")
        }
        const chunkDataLen = chunkLen - 2
        return chunkDataLen
    }
    catch (e) {
        throw new ChunkDecodingError("Error encountered while " +
            "decoding a subsequent chunk header", { cause: e })
    }
}

export async function readLeadChunk(reader: Readable, maxChunkSize = 0):
        Promise<LeadChunk | null> {
    if (!reader) {
        throw new Error("reader argument is null")
    }
    if (!maxChunkSize || maxChunkSize < 0) {
        maxChunkSize = DefaultMaxChunkSize
    }
    let chunkBytes: Buffer | undefined
    try {
        const encodedLength = Buffer.allocUnsafe(LengthOfEncodedChunkLength)
        if (await IOUtils.readBytes(reader, encodedLength, 0, 1) <= 0) {
            return null
        }
        await IOUtils.readBytesFully(reader, encodedLength, 1,
            encodedLength.length - 1)
        const chunkLen = Number(ByteUtils.deserializeUpToInt64BigEndian(encodedLength, 0,
            encodedLength.length, true))
        validateChunkLength(chunkLen, maxChunkSize)
        chunkBytes = Buffer.allocUnsafe(chunkLen)
    }
    catch (e) {
        throw new ChunkDecodingError("Failed to decode quasi http headers while " +
            "decoding a chunk header", { cause: e})
    }

    try {
        await IOUtils.readBytesFully(reader, chunkBytes, 0,
            chunkBytes.length)
    }
    catch (e) {
        throw new ChunkDecodingError("Failed to decode quasi http headers while " +
            "reading in chunk data", { cause: e})
    }

    try
    {
        const chunk = LeadChunk.deserialize(chunkBytes, 0, chunkBytes.length)
        return chunk
    }
    catch (e) {
        throw new ChunkDecodingError("Encountered invalid chunk of quasi http headers",
            { cause: e})
    }
}

function validateChunkLength(chunkLen: number, maxChunkSize: number) {
    if (chunkLen < 0) {
        throw new Error(`received negative chunk size of ${chunkLen}`)
    }
    if (chunkLen > DefaultMaxChunkSizeLimit && chunkLen > maxChunkSize) {
        throw new Error(
            `received chunk size of {chunkLen} exceeds` +
            ` default limit on max chunk size (${DefaultMaxChunkSizeLimit})` +
            ` as well as maximum configured chunk size of ${maxChunkSize}`)
    }
}

export async function writeLeadChunk(writer: Writable, chunk: LeadChunk,
        maxChunkSize = 0): Promise<void> {
    if (!writer) {
        throw new Error("writer argument is null")
    }
    if (!maxChunkSize || maxChunkSize < 0) {
        maxChunkSize = DefaultMaxChunkSize
    }
    chunk.updateSerializedRepresentation()
    const byteCount = chunk.calculateSizeInBytesOfSerializedRepresentation()
    if (byteCount > maxChunkSize) {
        throw new Error(`headers larger than max chunk size of ${maxChunkSize}`)
    }
    if (byteCount > HardMaxChunkSizeLimit) {
        throw new Error(`headers larger than max chunk size limit of ${HardMaxChunkSizeLimit}`)
    }
    const encodedLength = Buffer.allocUnsafe(LengthOfEncodedChunkLength)
    ByteUtils.serializeUpToInt64BigEndian(BigInt(byteCount), encodedLength, 0,
        encodedLength.length)
    await IOUtils.writeBytesFully(writer, encodedLength, 0, encodedLength.length)
    await chunk.writeOutSerializedRepresentation(writer)
}
