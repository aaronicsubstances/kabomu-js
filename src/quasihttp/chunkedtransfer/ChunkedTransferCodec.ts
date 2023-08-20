import { Readable, Writable } from "stream";
import * as ByteUtils from "../../common/ByteUtils";
import * as CsvUtils from "../../common/CsvUtils";
import * as IOUtils from "../../common/IOUtils";
import { ChunkDecodingError } from "../errors";
import {
    LeadChunk,
    IQuasiHttpRequest,
    IQuasiHttpResponse
} from "../types";

/**
 * Contains helper functions for implementing the custom chunked transfer
 * protocol used by the Kabomu libary.
 */
export class ChunkedTransferCodec {

    /**
     * Current version of standard chunk serialization format.
     */
    static readonly Version01 = 1;

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

    private _csvDataPrefix?: Buffer;
    private _csvData?: Array<string[]>;
    private _defaultBufferUsedForDecoding = Buffer.alloc(
        ChunkedTransferCodec.LengthOfEncodedChunkLength + 2)

    /**
     * Encodes a subsequent chunk header to a writable stream.
     * @param chunkDataLength the number of bytes of the
     * chunk data section which will follow the header.
     * @param writer destination stream of encoded subsequent chunk header
     */
    async encodeSubsequentChunkV1Header(
            chunkDataLength: number, writer: Writable) {
        if (!writer) {
            throw new Error("writer argument is null");
        }
        // NB: cannot store buffer as an instance property
        // just in case it is stored by writer.
        const buffer = Buffer.allocUnsafeSlow(
            ChunkedTransferCodec.LengthOfEncodedChunkLength + 2);
        ByteUtils.serializeUpToInt32BigEndian(
            chunkDataLength + 2, buffer, 0,
            ChunkedTransferCodec.LengthOfEncodedChunkLength)
        buffer[ChunkedTransferCodec.LengthOfEncodedChunkLength] =
            ChunkedTransferCodec.Version01
        buffer[ChunkedTransferCodec.LengthOfEncodedChunkLength + 1] = 0 // flags.
        await IOUtils.writeBytes(writer, buffer, 0,
            buffer.length)
    }

    /**
     * Decodes a subsequent chunk header from a readable stream.
     * 
     * An instance of ChunkDecodingError is thrown if the bytes in the
     * bufferToUse or reader argument, do not represent a valid subsequent
     * chunk header in version 1 format.
     * @param bufferToUse optional buffer to use as temporary
     * storage during decoding. Must be at least 5 bytes long.
     * @param reader source stream of bytes representing subsequent
     * chunk header. Must be specified if bufferToUse argument is null.
     * @param maxChunkSize the maximum allowable size of the subsequent chunk to be decoded.
     * NB: This parameter imposes a maximum only on lead chunks exceeding 64KB in size. Can
     * pass zero to use default value.
     * @returns a promise whose result will be the number of bytes in the
     * data following the decoded header.
     */
    async decodeSubsequentChunkV1Header(
            bufferToUse: Buffer | null, reader: Readable | null,
            maxChunkSize = 0) {
        if (!maxChunkSize || maxChunkSize <= 0) {
            maxChunkSize = ChunkedTransferCodec.DefaultMaxChunkSize;
        }
        if (!bufferToUse && !reader) {
            throw new Error("reader arg cannot be null if " +
                "bufferToUse argument is null");
        }
        try {
            if (!bufferToUse) {
                bufferToUse = this._defaultBufferUsedForDecoding;
                await IOUtils.readBytesFully(reader!, bufferToUse, 0,
                    ChunkedTransferCodec.LengthOfEncodedChunkLength + 2);
            }
            const chunkLen = ByteUtils.deserializeUpToInt32BigEndian(bufferToUse,
                0, ChunkedTransferCodec.LengthOfEncodedChunkLength, true);
            validateChunkLength(chunkLen, maxChunkSize);

            const version = bufferToUse[ChunkedTransferCodec.LengthOfEncodedChunkLength];
            //const flags = bufferToUse[ChunkedTransferCodec.LengthOfEncodedChunkLength+1];
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

    /**
     * Helper function for reading quasi http headers. Quasi http headers are encoded
     * as the leading chunk before any subsequent chunk representing part of the data of an http body.
     * Hence quasi http headers are decoded in the same way as http body data chunks.
     * 
     * An instance of ChunkDecodingError is thrown if data from reader could not be decoded
     * into a valid lead chunk.
     * @param reader the source to read from
     * @param maxChunkSize the maximum allowable size of the lead chunk to be decoded; effectively this
     * determines the maximum combined size of quasi http headers to be decoded. NB: This parameter
     * imposes a maximum only on lead chunks exceeding 64KB in size. Can
     * pass zero to use default value.
     * @returns promise whose result is a decoded lead chunk.
     */
    async readLeadChunk(reader: Readable, maxChunkSize = 0) {
        if (!reader) {
            throw new Error("reader argument is null");
        }
        if (!maxChunkSize || maxChunkSize <= 0) {
            maxChunkSize = ChunkedTransferCodec.DefaultMaxChunkSize;
        }
        let chunkBytes: Buffer | undefined;
        try {
            const encodedLength = Buffer.allocUnsafeSlow(
                ChunkedTransferCodec.LengthOfEncodedChunkLength);
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
            const chunk = ChunkedTransferCodec._deserialize(chunkBytes, 0, chunkBytes.length);
            return chunk;
        }
        catch (e) {
            throw new ChunkDecodingError("Encountered invalid chunk of quasi http headers",
                { cause: e});
        }
    }

    /**
     * Helper function for writing out quasi http headers. Quasi http headers are encoded
     * as the leading chunk before any subsequent chunk representing part of the data of an http body.
     * 
     * @param writer the destination stream to write to
     * @param chunk the lead chunk containing http headers to be written
     * @param maxChunkSize the maximum size of the lead chunk. Can
     * pass zero to use default value. An error is thrown if the size of the data 
     * in the chunk argument is larger than the maxChunkSize argument, or is larger than value of
     * HardMaxChunkSizeLimit constant of this class.
     */
    async writeLeadChunk(writer: Writable, chunk: LeadChunk,
            maxChunkSize = 0) {
        if (!writer) {
            throw new Error("writer argument is null");
        }
        if (!maxChunkSize || maxChunkSize <= 0) {
            maxChunkSize = ChunkedTransferCodec.DefaultMaxChunkSize;
        }
        this._updateSerializedRepresentation(chunk);
        const byteCount = this._calculateSizeInBytesOfSerializedRepresentation();
        if (byteCount > maxChunkSize) {
            throw new Error(`headers larger than max chunk size of ${maxChunkSize}`);
        }
        if (byteCount > ChunkedTransferCodec.HardMaxChunkSizeLimit) {
            throw new Error(`headers larger than max chunk size limit of ` +
                `${ChunkedTransferCodec.HardMaxChunkSizeLimit}`);
        }
        const encodedLength = Buffer.allocUnsafeSlow(ChunkedTransferCodec.LengthOfEncodedChunkLength);
        ByteUtils.serializeUpToInt32BigEndian(byteCount, encodedLength, 0,
            encodedLength.length);
        await IOUtils.writeBytes(writer, encodedLength, 0, encodedLength.length);
        await this._writeOutSerializedRepresentation(writer);
    }

    static updateRequest(request: IQuasiHttpRequest,
            chunk: LeadChunk) {
        request.method = chunk.method;
        request.target = chunk.requestTarget;
        request.headers = chunk.headers;
        request.httpVersion = chunk.httpVersion;
    }

    static updateResponse(response: IQuasiHttpResponse,
            chunk: LeadChunk) {
        response.statusCode = chunk.statusCode ?? 0;
        response.httpStatusMessage = chunk.httpStatusMessage;
        response.headers = chunk.headers;
        response.httpVersion = chunk.httpVersion;
    }

    static createFromRequest(request: IQuasiHttpRequest) {
        const chunk: LeadChunk = {
            version: ChunkedTransferCodec.Version01,
            method: request.method,
            requestTarget: request.target,
            headers: request.headers,
            httpVersion: request.httpVersion
        };
        const requestBody = request.body;
        if (requestBody)
        {
            chunk.contentLength = requestBody.contentLength;
        }
        return chunk;
    }

    static createFromResponse(response: IQuasiHttpResponse) {
        const chunk: LeadChunk = {
            version: ChunkedTransferCodec.Version01,
            statusCode: response.statusCode,
            httpStatusMessage: response.httpStatusMessage,
            headers: response.headers,
            httpVersion: response.httpVersion
        };
        const responseBody = response.body;
        if (responseBody) {
            chunk.contentLength = responseBody.contentLength;
        }
        return chunk;
    }

    /**
     * Serializes the structure into an internal representation. The serialization format version must be set, or
     * else deserialization will fail later on. Also headers without values will be skipped.
     */
    _updateSerializedRepresentation(chunk: LeadChunk) {
        this._csvDataPrefix = Buffer.from([
            chunk.version ?? ChunkedTransferCodec.Version01,
            chunk.flags ?? 0]);

        const csvData = new Array<string[]>();
        this._csvData = csvData;
        const specialHeaderRow = new Array<any>();
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.requestTarget));
        specialHeaderRow.push(stringifyPossibleNull(chunk.requestTarget));
        specialHeaderRow.push(stringifyPossibleNull(chunk.statusCode ?? 0));
        specialHeaderRow.push(stringifyPossibleNull(chunk.contentLength ?? 0));
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.method));
        specialHeaderRow.push(stringifyPossibleNull(chunk.method));
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.httpVersion));
        specialHeaderRow.push(stringifyPossibleNull(chunk.httpVersion));
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.httpStatusMessage));
        specialHeaderRow.push(stringifyPossibleNull(chunk.httpStatusMessage));
        csvData.push(specialHeaderRow);
        const headers = chunk.headers;
        if (headers) {
            for (const [header, values] of headers) {
                if (!values.length) {
                    continue;
                }
                const headerRow = new Array<string>();
                headerRow.push(stringifyPossibleNull(header));
                for (const v of values) {
                    headerRow.push(stringifyPossibleNull(v));
                }
                csvData.push(headerRow);
            }
        }
    }

    /**
     * Gets the size of the serialized representation saved internally
     * by calling the updateSerializedRepresentation() method of
     * this class.
     * @returns size of serialized representation
     */
    _calculateSizeInBytesOfSerializedRepresentation(): number {
        const csvDataPrefix = this._csvDataPrefix;
        const csvData = this._csvData;
        if (!csvDataPrefix || !csvData) {
            throw new Error("missing serialized representation");
        }
        let desiredSize = csvDataPrefix.length;
        for (const row of csvData) {
            let addCommaSeparator = false;
            for (const value of row) {
                if (addCommaSeparator) {
                    desiredSize++;
                }
                desiredSize += calculateSizeInBytesOfEscapedValue(value);
                addCommaSeparator = true;
            }
            desiredSize++; // for newline
        }
        return desiredSize;
    }

    /**
     * Transfers the serialized representation generated internally by 
     * calling the updateSerializedRepresentation() method of this class
     * to a stream.
     * @param writer the destination stream of the bytes to be written
     */
    async _writeOutSerializedRepresentation(writer: Writable): Promise<void> {
        const csvDataPrefix = this._csvDataPrefix;
        const csvData = this._csvData;
        if (!csvDataPrefix || !csvData) {
            throw new Error("missing serialized representation");
        }
        await IOUtils.writeBytes(writer, csvDataPrefix, 0, csvDataPrefix.length);
        await CsvUtils.serializeTo(csvData, writer);
    }

    /**
     * Deserializes the structure from byte buffer. The serialization format version must be present.
     * Also headers without values will be skipped.
     * @param data the source byte buffer
     * @param offset the start decoding position in data
     * @param length the number of bytes to deserialize
     * @returns deserialized lead chunk structure
     */
    static _deserialize(data: Buffer, offset: number, length: number): LeadChunk {
        if (!data) {
            throw new Error("data argument is null");
        }
        if (!ByteUtils.isValidByteBufferSlice(data, offset, length)) {
            throw new Error("invalid payload");
        }

        if (length < 10) {
            throw new Error("too small to be a valid lead chunk");
        }

        const instance: LeadChunk = {
            version: data[offset]
        };
        if (!instance.version)
        {
            throw new Error("version not set");
        }
        instance.flags = data[offset + 1];

        const csv = ByteUtils.bytesToString(data, offset + 2, length - 2);
        const csvData = CsvUtils.deserialize(csv);
        if (!csvData.length) {
            throw new Error("invalid lead chunk");
        }
        const specialHeader = csvData[0];
        if (specialHeader.length < 10) {
            throw new Error("invalid special header");
        }
        if (specialHeader[0] !== "0") {
            instance.requestTarget = specialHeader[1];
        }
        instance.statusCode = parseIntExactly(specialHeader[2]);
        instance.contentLength = BigInt(specialHeader[3]);
        if (specialHeader[4] !== "0") {
            instance.method = specialHeader[5];
        }
        if (specialHeader[6] !== "0") {
            instance.httpVersion = specialHeader[7];
        }
        if (specialHeader[8] !== "0") {
            instance.httpStatusMessage = specialHeader[9];
        }
        for (let i = 1; i < csvData.length; i++) {
            const headerRow = csvData[i];
            if (headerRow.length < 2) {
                continue;
            }
            const headerValue = headerRow.slice(1);
            let headers = instance.headers;
            if (!headers) {
                instance.headers = headers = new Map<string, string[]>(); 
            }
            headers.set(headerRow[0], headerValue);
        }

        return instance;
    }
}

function validateChunkLength(chunkLen: number, maxChunkSize: number) {
    if (chunkLen < 0) {
        throw new Error(`received negative chunk size of ${chunkLen}`);
    }
    if (chunkLen > ChunkedTransferCodec.DefaultMaxChunkSizeLimit &&
            chunkLen > maxChunkSize) {
        throw new Error(
            `received chunk size of ${chunkLen} exceeds` +
            ` default limit on max chunk size (${ChunkedTransferCodec.DefaultMaxChunkSizeLimit})` +
            ` as well as maximum configured chunk size of ${maxChunkSize}`);
    }
}

function makeBooleanZeroOrOne(s: any) {
    return (s === null || s === undefined) ? "0" : "1";
}

function stringifyPossibleNull(s: any) {
    return (s === null || s === undefined) ? "" : `${s}`;
}

function parseIntExactly(input: any) {
    const n = Number(input);
    if (Number.isNaN(n)) {
        throw new Error("wrong input number: " + input);
    }
    return n;
}

function calculateSizeInBytesOfEscapedValue(raw: string) {
    let valueContainsSpecialCharacters = false;
    let doubleQuoteCount = 0;
    for (const c of raw) {
        if (c === ',' || c === '"' || c === '\r' || c === '\n') {
            valueContainsSpecialCharacters = true;
            if (c === '"') {
                doubleQuoteCount++;
            }
        }
    }
    // escape empty strings with two double quotes to resolve ambiguity
    // between an empty row and a row containing an empty string - otherwise both
    // serialize to the same CSV output.
    let desiredSize = Buffer.byteLength(raw);
    if (raw === "" || valueContainsSpecialCharacters) {
        desiredSize += doubleQuoteCount + 2; // for quoting and surrounding double quotes.
    }
    return desiredSize;
}

