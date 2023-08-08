import { Writable } from "stream";
import * as ByteUtils from "../../common/ByteUtils";
import * as CsvUtils from "../../common/CsvUtils";
import * as IOUtils from "../../common/IOUtils";
import { IQuasiHttpRequest, IQuasiHttpResponse } from "../types";

export class LeadChunk {
    /**
     * Current version of standard chunk serialization format.
     */
    static readonly Version01 = 1;

    private _csvDataPrefix?: Buffer;
    private _csvData?: Array<string[]>;

    /**
     * Serialization format version.
     */
    version = 0;

    /**
     * Reserved for future use.
     */
    flags = 0;

    /**
     * The equivalent of request target component of HTTP request line.
     */
    requestTarget?: string;

    /**
     * The equivalent of HTTP response status code.
     */
    statusCode = 0;

    contentLength = BigInt(0);

    method?: string;

    httpVersion?: string;

    httpStatusMessage?: string;

    headers?: Map<string, string[]>

    updateSerializedRepresentation() {
        this._csvDataPrefix = Buffer.from([this.version, this.flags]);

        const csvData = new Array<string[]>();
        this._csvData = csvData;
        const specialHeaderRow = new Array<any>();
        specialHeaderRow.push(isNullOrUndefined(this.requestTarget));
        specialHeaderRow.push(this.requestTarget ?? "");
        specialHeaderRow.push(this.statusCode);
        specialHeaderRow.push(this.contentLength);
        specialHeaderRow.push(isNullOrUndefined(this.method));
        specialHeaderRow.push(this.method ?? "");
        specialHeaderRow.push(isNullOrUndefined(this.httpVersion));
        specialHeaderRow.push(this.httpVersion ?? "");
        specialHeaderRow.push(isNullOrUndefined(this.httpStatusMessage));
        specialHeaderRow.push(this.httpStatusMessage ?? "");
        csvData.push(specialHeaderRow);
        const headers = this.headers;
        if (headers) {
            for (const [header, values] of headers) {
                if (!values.length) {
                    continue;
                }
                const headerRow = new Array<string>();
                headerRow.push(header);
                headerRow.push(...values);
                csvData.push(headerRow);
            }
        }
    }

    calculateSizeInBytesOfSerializedRepresentation(): number {
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

    async writeOutSerializedRepresentation(writer: Writable): Promise<void> {
        const csvDataPrefix = this._csvDataPrefix;
        const csvData = this._csvData;
        if (!csvDataPrefix || !csvData) {
            throw new Error("missing serialized representation");
        }
        await IOUtils.writeBytes(writer, csvDataPrefix, 0, csvDataPrefix.length);
        await CsvUtils._serializeTo(csvData, writer);
    }

    static deserialize(data: Buffer, offset: number, length: number): LeadChunk {
        if (!data) {
            throw new Error("data argument is null");
        }
        if (!ByteUtils.isValidByteBufferSlice(data, offset, length)) {
            throw new Error("invalid payload");
        }

        if (length < 10) {
            throw new Error("too small to be a valid lead chunk");
        }

        const instance = new LeadChunk();
        instance.version = data[offset];
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
        instance.statusCode = parseInt(specialHeader[2]);
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

    updateRequest(request: IQuasiHttpRequest) {
        request.method = this.method;
        request.target = this.requestTarget;
        request.headers = this.headers;
        request.httpVersion = this.httpVersion;
    }

    updateResponse(response: IQuasiHttpResponse) {
        response.statusCode = this.statusCode;
        response.httpStatusMessage = this.httpStatusMessage;
        response.headers = this.headers;
        response.httpVersion = this.httpVersion;
    }

    static createFromRequest(request: IQuasiHttpRequest) {
        const chunk = new LeadChunk();
        chunk.version = LeadChunk.Version01;
        chunk.method = request.method;
        chunk.requestTarget = request.target;
        chunk.headers = request.headers;
        chunk.httpVersion = request.httpVersion;
        const requestBody = request.body;
        if (requestBody)
        {
            chunk.contentLength = requestBody.contentLength;
        }
        return chunk;
    }

    static createFromResponse(response: IQuasiHttpResponse) {
        const chunk = new LeadChunk();
        chunk.version = LeadChunk.Version01;
        chunk.statusCode = response.statusCode;
        chunk.httpStatusMessage = response.httpStatusMessage;
        chunk.headers = response.headers;
        chunk.httpVersion = response.httpVersion;
        const responseBody = response.body;
        if (responseBody) {
            chunk.contentLength = responseBody.contentLength;
        }
        return chunk;
    }
}

function isNullOrUndefined(s: any) {
    return (s === null || s === undefined) ? "0" : "1";
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
    let desiredSize = new Blob([raw]).size;
    if (raw === "" || valueContainsSpecialCharacters) {
        desiredSize += doubleQuoteCount + 2; // for quoting and surrounding double quotes.
    }
    return desiredSize;
}
