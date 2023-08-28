import { Readable, Writable } from "stream";
import * as ByteUtils from "../../common/ByteUtils";
import * as CsvUtils from "../../common/CsvUtils";
import * as IOUtils from "../../common/IOUtils";
import * as MiscUtils from "../../common/MiscUtils";
import { ChunkDecodingError, ChunkEncodingError } from "../errors";
import {
    LeadChunk,
    IQuasiHttpRequest,
    IQuasiHttpResponse
} from "../types";


/**
 * Constant used internally to indicate the number of bytes used to encode the length
 * of a lead or subsequent chunk, which is 3.
 */
const lengthOfEncodedChunkLength = 3;

/**
 * Contains helper functions for implementing the custom chunked transfer
 * protocol used by the Kabomu libary.
 */
export class CustomChunkedTransferCodec {

    /**
     * Current version of standard chunk serialization format.
     */
    static readonly VERSION_01 = 1;

    /**
     * The default value of max chunk size used by quasi http servers and clients.
     * Equal to 8,192 bytes.
     */
    static readonly DEFAULT_MAX_CHUNK_SIZE = 8192;

    /**
     * The maximum value of a max chunk size that can be tolerated during chunk decoding even if it
     * exceeds the value used for sending. Equal to 65,536 bytes.
     * 
     * Practically this means that communicating parties can safely send chunks not exceeding 64KB without
     * fear of rejection and without prior negotiation. Beyond 64KB however, communicating parties must have
     * some prior negotiation (manual or automated) on max chunk sizes, or else chunks may be rejected
     * by receivers as too large.
     */
    static readonly DEFAULT_MAX_CHUNK_SIZE_LIMIT = 65_536;

    /**
     * Constant which communicates the largest chunk size possible with the standard chunk transfer 
     * implementation in the Kabomu library, and that is currently almost equal to
     * the largest signed integer that can fit into 3 bytes.
     */
    static readonly HARD_MAX_CHUNK_SIZE_LIMIT = 8_388_500;

    private _csvDataPrefix?: Buffer;
    private _csvData?: Array<string[]>;
    private _defaultBufferUsedForDecoding = Buffer.alloc(
        lengthOfEncodedChunkLength + 2)

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
        // because it may be stored by writer.
        const buffer = Buffer.allocUnsafeSlow(
            lengthOfEncodedChunkLength + 2);
        ByteUtils.serializeUpToInt32BigEndian(
            chunkDataLength + 2, buffer, 0,
            lengthOfEncodedChunkLength)
        buffer[lengthOfEncodedChunkLength] =
            CustomChunkedTransferCodec.VERSION_01
        buffer[lengthOfEncodedChunkLength + 1] = 0 // flags.
        await IOUtils.writeBytes(writer, buffer)
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
            bufferToUse: Buffer | undefined,
            reader: Readable | undefined,
            maxChunkSize = 0) {
        if (!maxChunkSize) {
            maxChunkSize = CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT;
        }
        else {
            maxChunkSize = MiscUtils.parseInt32(maxChunkSize);
            if (maxChunkSize < CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT) {
                maxChunkSize = CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT;
            }
        }
        if (!bufferToUse && !reader) {
            throw new Error("reader arg cannot be null if " +
                "bufferToUse argument is null");
        }
        try {
            if (!bufferToUse) {
                bufferToUse = this._defaultBufferUsedForDecoding;
                await IOUtils.readBytesFully(reader!,
                    bufferToUse.subarray(0,
                        lengthOfEncodedChunkLength + 2));
            }
            const chunkLen = ByteUtils.deserializeUpToInt32BigEndian(bufferToUse,
                0, lengthOfEncodedChunkLength, true);
            validateChunkLength(chunkLen, maxChunkSize);

            const version = bufferToUse[lengthOfEncodedChunkLength];
            //const flags = bufferToUse[lengthOfEncodedChunkLength+1];
            if (!version) {
                throw new Error("version not set");
            }
            const chunkDataLen = chunkLen - 2;
            return chunkDataLen;
        }
        catch (e) {
            throw new ChunkDecodingError("Failed to decode quasi http body while " +
                "decoding a chunk header", { cause: e});
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
        if (!maxChunkSize) {
            maxChunkSize = CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT;
        }
        else {
            maxChunkSize = MiscUtils.parseInt32(maxChunkSize);
            if (maxChunkSize < CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT) {
                maxChunkSize = CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT;
            }
        }
        let chunkBytes: Buffer | undefined;
        try {
            const encodedLength = Buffer.allocUnsafeSlow(
                lengthOfEncodedChunkLength);
            if (await IOUtils.readBytes(reader,
                    encodedLength.subarray(0, 1)) <= 0) {
                return undefined;
            }
            await IOUtils.readBytesFully(reader,
                encodedLength.subarray(1, encodedLength.length));
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
            await IOUtils.readBytesFully(reader, chunkBytes);
        }
        catch (e) {
            throw new ChunkDecodingError("Failed to decode quasi http headers while " +
                "reading in chunk data", { cause: e});
        }

        try
        {
            const chunk = CustomChunkedTransferCodec._deserialize(chunkBytes);
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
        if (!maxChunkSize) {
            maxChunkSize = CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE;
        }
        else {
            maxChunkSize = MiscUtils.parseInt32(maxChunkSize);
            if (maxChunkSize <= 0 ||
                    maxChunkSize > CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT) {
                maxChunkSize = CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE;
            }
        }
        this._updateSerializedRepresentation(chunk);
        const byteCount = this._calculateSizeInBytesOfSerializedRepresentation();
        if (byteCount > maxChunkSize) {
            throw new ChunkEncodingError(`quasi http headers exceed ` +
                `max chunk size (${byteCount} > ${maxChunkSize})`);
        }
        const encodedLength = Buffer.allocUnsafeSlow(
            lengthOfEncodedChunkLength);
        ByteUtils.serializeUpToInt32BigEndian(byteCount, encodedLength, 0,
            encodedLength.length);
        await IOUtils.writeBytes(writer, encodedLength);
        await this._writeOutSerializedRepresentation(writer);
    }

    /**
     * Updates a request object with corresponding properties on a
     * lead chunk,
     * in particular: method, target, http version and headers.
     * @param request request instance to be updated
     * @param chunk lead chunk instance which will be used
     * to update request instance
     */
    static updateRequest(request: IQuasiHttpRequest,
            chunk: LeadChunk) {
        request.method = chunk.method;
        request.target = chunk.requestTarget;
        request.headers = chunk.headers;
        request.httpVersion = chunk.httpVersion;
    }

    /**
     * Updates a response object with corresponding properties on a
     * lead chunk,
     * in particular: status code, http status message, http version and headers.
     * @param response response instance to be updated
     * @param chunk lead chunk instance which will be used
     * to update response instance
     */
    static updateResponse(response: IQuasiHttpResponse,
            chunk: LeadChunk) {
        response.statusCode = MiscUtils.parseInt32(
            chunk.statusCode || 0);
        response.httpStatusMessage = chunk.httpStatusMessage;
        response.headers = chunk.headers;
        response.httpVersion = chunk.httpVersion;
    }

    /**
     * Creates a new lead chunk which is initialized
     * with the corresponding properties on request object.
     * @param request request object which will be used
     * to initialize newly created lead chunk.
     * @returns new lead chunk object with version set to v1, and
     * request-related properties initialized
     */
    static createFromRequest(request: IQuasiHttpRequest) {
        const chunk: LeadChunk = {
            version: CustomChunkedTransferCodec.VERSION_01,
            flags: 0,
            method: request.method,
            requestTarget: request.target,
            headers: request.headers,
            httpVersion: request.httpVersion,
            contentLength: 0,
            statusCode: 0 // not really needed except ease writing of test,
                          // to prevent "expected 0 to equal undefined"
        };
        const requestBody = request.body;
        if (requestBody)
        {
            chunk.contentLength = MiscUtils.parseInt48(
                requestBody.contentLength || 0);
        }
        return chunk;
    }

    /**
     * Creates a new lead chunk which is initialized
     * with the corresponding properties on response object.
     * @param response response object which will be used
     * to initialize newly created lead chunk.
     * @returns new lead chunk object with version set to v1, and
     * response-related properties initialized
     */
    static createFromResponse(response: IQuasiHttpResponse) {
        const chunk: LeadChunk = {
            version: CustomChunkedTransferCodec.VERSION_01,
            flags: 0,
            httpStatusMessage: response.httpStatusMessage,
            headers: response.headers,
            httpVersion: response.httpVersion,
            contentLength: 0
        };
        chunk.statusCode = MiscUtils.parseInt32(
            response.statusCode || 0);
        const responseBody = response.body;
        if (responseBody) {
            chunk.contentLength = MiscUtils.parseInt48(
                responseBody.contentLength || 0);
        }
        return chunk;
    }

    /**
     * Serializes the structure into an internal representation. The serialization format version must be set, or
     * else deserialization will fail later on. Also headers without values will be skipped.
     */
    _updateSerializedRepresentation(chunk: LeadChunk) {
        this._csvDataPrefix = Buffer.from([
            chunk.version || CustomChunkedTransferCodec.VERSION_01,
            chunk.flags || 0]);

        const csvData = new Array<string[]>();
        this._csvData = csvData;
        const specialHeaderRow = new Array<any>();
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.requestTarget));
        specialHeaderRow.push(stringifyPossibleNull(chunk.requestTarget));
        specialHeaderRow.push(stringifyPossibleNull(chunk.statusCode || 0));
        specialHeaderRow.push(stringifyPossibleNull(chunk.contentLength || 0));
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.method));
        specialHeaderRow.push(stringifyPossibleNull(chunk.method));
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.httpVersion));
        specialHeaderRow.push(stringifyPossibleNull(chunk.httpVersion));
        specialHeaderRow.push(makeBooleanZeroOrOne(chunk.httpStatusMessage));
        specialHeaderRow.push(stringifyPossibleNull(chunk.httpStatusMessage));
        csvData.push(specialHeaderRow);
        const headers = chunk.headers;
        if (headers) {
            for (let [header, values] of headers) {
                if (typeof values === "string") {
                    values = [values]
                }
                if (!values || !values.length) {
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
        await IOUtils.writeBytes(writer, csvDataPrefix);
        await CsvUtils.serializeTo(csvData, writer);
    }

    /**
     * Deserializes the structure from byte buffer. The serialization format version must be present.
     * Also headers without values will be skipped.
     * @param data the source byte buffer
     * @returns deserialized lead chunk structure
     */
    static _deserialize(data: Buffer): LeadChunk {
        if (!data) {
            throw new Error("data argument is null");
        }

        if (data.length < 10) {
            throw new Error("too small to be a valid lead chunk");
        }

        const instance: LeadChunk = {
            version: data[0]
        };
        if (!instance.version)
        {
            throw new Error("version not set");
        }
        instance.flags = data[1];

        const csv = ByteUtils.bytesToString(
            data.subarray(2, data.length));
        const csvData = CsvUtils.deserialize(csv);
        if (!csvData.length) {
            throw new Error("invalid lead chunk");
        }
        const specialHeader = csvData[0];
        if (specialHeader.length < 10) {
            throw new Error("invalid special header");
        }
        if (specialHeader[0] === "1") {
            instance.requestTarget = specialHeader[1];
        }
        try {
            instance.statusCode = MiscUtils.parseInt32(specialHeader[2]);
        }
        catch {
            throw new Error("invalid status code");
        }
        try {
            instance.contentLength = MiscUtils.parseInt48(specialHeader[3]);
        }
        catch {
            throw new Error("invalid content length");
        }
        if (specialHeader[4] === "1") {
            instance.method = specialHeader[5];
        }
        if (specialHeader[6] === "1") {
            instance.httpVersion = specialHeader[7];
        }
        if (specialHeader[8] === "1") {
            instance.httpStatusMessage = specialHeader[9];
        }
        for (let i = 1; i < csvData.length; i++) {
            const headerRow = csvData[i];
            if (headerRow.length < 2) {
                continue;
            }
            const headerName = headerRow[0]
            const headerValue = headerRow.slice(1);
            let headers = instance.headers;
            if (!headers) {
                instance.headers = headers = new Map<string, string[]>(); 
            }
            if (!headers.has(headerName)) {
                headers.set(headerName, [])
            }
            headers.get(headerName)!.push(...headerValue);
        }

        return instance;
    }
}

function validateChunkLength(chunkLen: number, maxChunkSize: number) {
    if (chunkLen < 0) {
        throw new Error(`encountered negative chunk size of ${chunkLen}`);
    }
    if (chunkLen > CustomChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE_LIMIT &&
            chunkLen > maxChunkSize) {
        throw new Error(
            `encountered chunk size exceeding ` +
            `max chunk size (${chunkLen} > ${maxChunkSize})`);
    }
}

function makeBooleanZeroOrOne(s: any) {
    return (s === null || typeof s === "undefined") ? "0" : "1";
}

function stringifyPossibleNull(s: any) {
    return (s === null || typeof s === "undefined") ? "" : `${s}`;
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

