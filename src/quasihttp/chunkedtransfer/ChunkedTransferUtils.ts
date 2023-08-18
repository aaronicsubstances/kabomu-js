import { Readable, Writable } from "stream";
import * as ByteUtils from "../../common/ByteUtils";
import * as IOUtils from "../../common/IOUtils";
import { LeadChunk } from "./LeadChunk";
import { ChunkDecodingError } from "../errors";

export class ChunkedTransferUtils {

    /**
     * The default value of max chunk size used by quasi http servers and clients.
     * Equal to 8,192 bytes.
     */
    static readonly DefaultMaxChunkSize = 8192;

    /**
     * The maximum value of a max chunk size that can be tolerated during chunk decoding even if it
     * exceeds the value used for sending. Equal to 65,536 bytes.
     * 
     * Practically this means that communicating parties can safely send chunks not exceeding 64KB without
     * fear of rejection and without prior negotiation. Beyond 64KB however, communicating parties must have
     * some prior negotiation (manual or automated) on max chunk sizes, or else chunks may be rejected
     * by receivers as too large.
     */
    static readonly DefaultMaxChunkSizeLimit = 65_536;

    /**
     * Constant used internally to indicate the number of bytes used to encode the length
     * of a lead or subsequent chunk, which is 3.
     */
    static readonly LengthOfEncodedChunkLength = 3;

    /**
     * Constant which communicates the largest chunk size possible with the standard chunk transfer 
     * implementation in the Kabomu library, and that is currently the largest
     * signed integer that can fit into 3 bytes.
     */
    static readonly HardMaxChunkSizeLimit = 8_388_607;

    private _headerBuffer = Buffer.allocUnsafeSlow(
        ChunkedTransferUtils.LengthOfEncodedChunkLength + 2);

    async encodeSubsequentChunkV1Header(
            chunkDataLength: number, writer: Writable) {
        if (!writer) {
            throw new Error("writer argument is null");
        }
        ByteUtils.serializeUpToInt32BigEndian(
            chunkDataLength + 2, this._headerBuffer, 0,
            ChunkedTransferUtils.LengthOfEncodedChunkLength)
        this._headerBuffer[ChunkedTransferUtils.LengthOfEncodedChunkLength] =
            LeadChunk.Version01
        this._headerBuffer[ChunkedTransferUtils.LengthOfEncodedChunkLength + 1] = 0 // flags.
        await IOUtils.writeBytes(writer, this._headerBuffer, 0,
            ChunkedTransferUtils.LengthOfEncodedChunkLength + 2)
    }

    async decodeSubsequentChunkV1Header(maxChunkSize: number,
            bufferToUse: Buffer | null, reader: Readable | null) {
        try {
            if (!bufferToUse) {
                bufferToUse = this._headerBuffer;
                if (!reader) {
                    throw new Error("reader argument is null if " +
                        "bufferToUse argument is null");
                }
                await IOUtils.readBytesFully(reader, bufferToUse, 0,
                    ChunkedTransferUtils.LengthOfEncodedChunkLength + 2);
            }
            const chunkLen = ByteUtils.deserializeUpToInt32BigEndian(bufferToUse,
                0, ChunkedTransferUtils.LengthOfEncodedChunkLength, true);
            validateChunkLength(chunkLen, maxChunkSize);

            const version = bufferToUse[ChunkedTransferUtils.LengthOfEncodedChunkLength];
            //const flags = bufferToUse[ChunkedTransferUtils.LengthOfEncodedChunkLength+1];
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

    static async readLeadChunk(reader: Readable, maxChunkSize = 0) {
        if (!reader) {
            throw new Error("reader argument is null");
        }
        if (!maxChunkSize || maxChunkSize < 0) {
            maxChunkSize = ChunkedTransferUtils.DefaultMaxChunkSize;
        }
        let chunkBytes: Buffer | undefined;
        try {
            const encodedLength = Buffer.allocUnsafeSlow(
                ChunkedTransferUtils.LengthOfEncodedChunkLength);
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

    static async writeLeadChunk(writer: Writable, chunk: LeadChunk,
            maxChunkSize = 0) {
        if (!writer) {
            throw new Error("writer argument is null");
        }
        if (!maxChunkSize || maxChunkSize < 0) {
            maxChunkSize = ChunkedTransferUtils.DefaultMaxChunkSize;
        }
        chunk.updateSerializedRepresentation();
        const byteCount = chunk.calculateSizeInBytesOfSerializedRepresentation();
        if (byteCount > maxChunkSize) {
            throw new Error(`headers larger than max chunk size of ${maxChunkSize}`);
        }
        if (byteCount > ChunkedTransferUtils.HardMaxChunkSizeLimit) {
            throw new Error(`headers larger than max chunk size limit of ` +
                `${ChunkedTransferUtils.HardMaxChunkSizeLimit}`);
        }
        const encodedLength = Buffer.allocUnsafeSlow(ChunkedTransferUtils.LengthOfEncodedChunkLength);
        ByteUtils.serializeUpToInt32BigEndian(byteCount, encodedLength, 0,
            encodedLength.length);
        await IOUtils.writeBytes(writer, encodedLength, 0, encodedLength.length);
        await chunk.writeOutSerializedRepresentation(writer);
    }
}

function validateChunkLength(chunkLen: number, maxChunkSize: number) {
    if (chunkLen < 0) {
        throw new Error(`received negative chunk size of ${chunkLen}`);
    }
    if (chunkLen > ChunkedTransferUtils.DefaultMaxChunkSizeLimit &&
            chunkLen > maxChunkSize) {
        throw new Error(
            `received chunk size of {chunkLen} exceeds` +
            ` default limit on max chunk size (${ChunkedTransferUtils.DefaultMaxChunkSizeLimit})` +
            ` as well as maximum configured chunk size of ${maxChunkSize}`);
    }
}
