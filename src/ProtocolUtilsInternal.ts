import { Readable, Writable } from "stream";
import { pipeline } from "stream/promises";
import {
    bytesToString,
    parseInt32,
    parseInt48,
    stringToBytes
} from "./MiscUtilsInternal";
import * as QuasiHttpUtils from "./QuasiHttpUtils";
import * as IOUtilsInternal from "./IOUtilsInternal"
import * as CsvUtils from "./CsvUtils"
import * as TlvUtils from "./tlv/TlvUtils";
import {
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    QuasiHttpConnection
} from "./types";
import {
    ExpectationViolationError,
    MissingDependencyError,
    QuasiHttpError
} from "./errors";
import { DefaultQuasiHttpResponse } from "./DefaultQuasiHttpResponse";
import { DefaultQuasiHttpRequest } from "./DefaultQuasiHttpRequest";

export async function wrapTimeoutPromise(
        timeoutPromise: Promise<boolean>,
        forClient: boolean) {
    const timeoutMsg = forClient ? "send timeout" : "receive timeout";
    if (await timeoutPromise) {
        throw new QuasiHttpError(timeoutMsg,
            QuasiHttpError.REASON_CODE_TIMEOUT);
    }
}

export function validateHttpHeaderSection(isResponse: boolean,
        csv: Array<string[]>) {
    if (!csv.length) {
        throw new ExpectationViolationError(
            "expected csv to contain at least the special header")
    }
    const specialHeader = csv[0]
    if (specialHeader.length !== 4) {
        throw new ExpectationViolationError(
            "expected special header to have 4 values " +
            `instead of ${specialHeader.length}`)
    }
    for (let i = 0; i < specialHeader.length; i++) {
        const item = specialHeader[i]
        if (!containsOnlyPrintableAsciiChars(item, isResponse && i === 2)) {
            throw new QuasiHttpError(
                `quasi http ${(isResponse ? "status" : "request")} line ` +
                "field contains spaces, newlines or " +
                "non-printable ASCII characters: " +
                item,
                QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
        }
    }
    for (let i = 1; i < csv.length; i++) {
        const row = csv[i]
        if (row.length < 2) {
            throw new ExpectationViolationError(
                "expected row to have at least 2 values " +
                `instead of ${row.length}`)
        }
        const headerName = row[0];
        if (!containsOnlyHeaderNameChars(headerName)) {
            throw new QuasiHttpError(
                "quasi http header name contains characters " +
                "other than hyphen and English alphabets: " +
                headerName,
                QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
        }
        for (let j = 1; j < row.length; j++) {
            const headerValue = row[j];
            if (!containsOnlyPrintableAsciiChars(headerValue,
                    true)) {
                throw new QuasiHttpError(
                    "quasi http header value contains newlines or " +
                    "non-printable ASCII characters: " + headerValue,
                    QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
            }
        }
    }
}

export function containsOnlyHeaderNameChars(v: string) {
    for (let i = 0; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if (c >= 48 && c < 58) {
            // digits.
        }
        else if (c >= 65 && c < 91) {
            // upper case
        }
        else if (c >= 97 && c < 123) {
            // lower case
        }
        else if (c === 45) {
            // hyphen
        }
        else {
            return false;
        }
    }
    return true;
}

export function containsOnlyPrintableAsciiChars(v: string,
        allowSpace: boolean) {
    for (let i = 0; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if (c < 32 || c > 126) {
            return false;
        }
        if (!allowSpace && c === 32) {
            return false;
        }
    }
    return true;
}

export function encodeQuasiHttpHeaders(isResponse: boolean,
        reqOrStatusLine: string[],
        remainingHeaders?: Map<string, string[]>) {
    if (!reqOrStatusLine) {
        throw new Error("reqOrStatusLine argument is null")
    }
    const csv = new Array<string[]>();
    const specialHeader = new Array<string>()
    for (const v of reqOrStatusLine) {
        specialHeader.push(stringifyPossibleNull(v))
    }
    csv.push(specialHeader)
    if (remainingHeaders) {
        for (let [header, values] of remainingHeaders) {
            header = stringifyPossibleNull(header)
            if (!header) {
                throw new QuasiHttpError(
                    "quasi http header name cannot be empty",
                    QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
            }
            // allow string values not inside an array.
            if (typeof values === "string") {
                values = [values]
            }
            if (!values || !values.length) {
                continue;
            }
            const headerRow = new Array<string>();
            headerRow.push(header);
            for (let v of values) {
                v = stringifyPossibleNull(v)
                if (!v) {
                    throw new QuasiHttpError(
                        "quasi http header value cannot be empty",
                        QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
                }
                headerRow.push(v);
            }
            csv.push(headerRow);
        }
    }

    validateHttpHeaderSection(isResponse, csv);

    const serialized = stringToBytes(
        CsvUtils.serialize(csv));
    return serialized;
}

function stringifyPossibleNull(s: any) {
    return (s === null || typeof s === "undefined") ? "" : `${s}`;
}

export function decodeQuasiHttpHeaders(
        isResponse: boolean,
        buffer: Buffer,
        headersReceiver: Map<string, string[]>) {
    let csv: Array<string[]>;
    try {
        csv = CsvUtils.deserialize(bytesToString(
            buffer))
    }
    catch (e) {
        throw new QuasiHttpError(
            `invalid quasi http headers`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e });
    }
    if (!csv.length) {
        throw new QuasiHttpError(
            `invalid quasi http headers`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    const specialHeader = csv[0];
    if (specialHeader.length < 4) {
        throw new QuasiHttpError(
            `invalid quasi http ${(isResponse ? "status" : "request")} line`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
    }
    for (let i = 1; i < csv.length; i++) {
        const headerRow = csv[i];
        if (headerRow.length < 2) {
            continue;
        }
        // merge headers with the same normalized name in different rows.
        const headerName = headerRow[0].toLowerCase()
        if (!headersReceiver.has(headerName)) {
            headersReceiver.set(headerName, [])
        }
        const headerValue = headerRow.slice(1);
        headersReceiver.get(headerName)!.push(...headerValue);
    }
    return specialHeader;
}

export async function writeQuasiHttpHeaders(
        isResponse: boolean,
        dest: Writable,
        reqOrStatusLine: string[],
        remainingHeaders: Map<string, string[]> | undefined,
        maxHeadersSize?: number) {
    const encodedHeaders = encodeQuasiHttpHeaders(isResponse,
        reqOrStatusLine,
        remainingHeaders)
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = QuasiHttpUtils.DEFAULT_MAX_HEADERS_SIZE;
    }

    // finally check that byte count of csv doesn't exceed limit.
    if (encodedHeaders.length > maxHeadersSize) {
        throw new QuasiHttpError(
            "quasi http headers exceed " +
            `max size (${encodedHeaders.length} > ${maxHeadersSize})`,
            QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
    }

    const encodedHeadersReadable = Readable.from((function*() {
        yield TlvUtils.encodeTagAndLength(
            TlvUtils.TAG_FOR_QUASI_HTTP_HEADERS,
            encodedHeaders.length)
        yield encodedHeaders
    })());
    await pipeline(encodedHeadersReadable, dest, {
        end: false
    });
}

export async function readQuasiHttpHeaders(
        isResponse: boolean,
        src: Readable,
        headersReceiver: Map<string, string[]>,
        maxHeadersSize?: number) {
    const encodedTag = await IOUtilsInternal.readBytesFully(src,
        4);
    const tag = TlvUtils.decodeTag(encodedTag, 0);
    if (tag !== TlvUtils.TAG_FOR_QUASI_HTTP_HEADERS) {
        throw new QuasiHttpError(
            `unexpected quasi http headers tag: ${tag}`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
    }
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = QuasiHttpUtils.DEFAULT_MAX_HEADERS_SIZE;
    }
    const encodedLen = await IOUtilsInternal.readBytesFully(src,
        4);
    const headersSize = TlvUtils.decodeLength(encodedLen, 0);
    if (headersSize > maxHeadersSize) {
        throw new QuasiHttpError(
            "quasi http headers exceed " +
            `max size (${headersSize} > ${maxHeadersSize})`,
            QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
    }
    const encodedHeaders = await IOUtilsInternal.readBytesFully(
        src, headersSize);
    return decodeQuasiHttpHeaders(isResponse, encodedHeaders,
        headersReceiver);
}

export async function writeEntityToTransport(
        isResponse: boolean,
        entity: any,
        writableStream: Writable | undefined,
        connection: QuasiHttpConnection) {
    if (!writableStream) {
        throw new MissingDependencyError(
            "no writable stream found for transport")
    }
    let body: Readable | undefined;
    let contentLength = 0;
    let reqOrStatusLine: any
    let headers: Map<string, string[]> | undefined
    if (isResponse) {
        const response = entity as IQuasiHttpResponse
        headers = response.headers
        body = response.body
        contentLength = response.contentLength || 0
        reqOrStatusLine = [
            response.httpVersion,
            response.statusCode || 0,
            response.httpStatusMessage,
            contentLength
        ]
    }
    else {
        const request = entity as IQuasiHttpRequest
        headers = request.headers
        body = request.body
        contentLength = request.contentLength || 0
        reqOrStatusLine = [
            request.httpMethod,
            request.target,
            request.httpVersion,
            contentLength
        ]
    }
    // treat content lengths totally separate from body
    // due to how HEAD method works.
    await writeQuasiHttpHeaders(isResponse,
        writableStream, reqOrStatusLine, headers,
        connection.processingOptions?.maxHeadersSize)
    if (!body) {
        // don't proceed, even if content length is not zero.
        return;
    }
    if (contentLength > 0) {
        // don't enforce positive content lengths when writing out
        // quasi http bodies
        await pipeline(body, writableStream, {
            end: false
        })
    }
    else {
        // proceed, even if content length is 0.
        const encodedBody = TlvUtils.createTlvEncodingReadableStream(
            body, TlvUtils.TAG_FOR_QUASI_HTTP_BODY_CHUNK)
        await pipeline(encodedBody, writableStream, {
            end: false
        })
    }
}

export async function readEntityFromTransport(
        isResponse: boolean,
        readableStream: Readable | undefined,
        connection: QuasiHttpConnection)
        : Promise<IQuasiHttpRequest | IQuasiHttpResponse> {
    if (!readableStream) {
        throw new MissingDependencyError(
            "no readable stream found for transport");
    }
    const headersReceiver = new Map<string, string[]>()
    const reqOrStatusLine = await readQuasiHttpHeaders(
        isResponse,
        readableStream,
        headersReceiver,
        connection.processingOptions?.maxHeadersSize)
    let contentLength = 0;
    try {
        contentLength = parseInt48(reqOrStatusLine[3])
    }
    catch (e) {
        throw new QuasiHttpError(
            `invalid quasi http ${(isResponse ? "response" : "request")} content length`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e })
    }
    let body: Readable | undefined
    if (contentLength) {
        if (contentLength > 0) {
            body = TlvUtils.createContentLengthEnforcingStream(
                readableStream, contentLength)
        }
        else {
            body = TlvUtils.createTlvDecodingReadableStream(
                readableStream,
                TlvUtils.TAG_FOR_QUASI_HTTP_BODY_CHUNK,
                TlvUtils.TAG_FOR_QUASI_HTTP_BODY_CHUNK_EXT)
        }
    }
    if (isResponse) {
        const response = new DefaultQuasiHttpResponse()
        response.httpVersion = reqOrStatusLine[0]
        try {
            response.statusCode = parseInt32(
                reqOrStatusLine[1])
        }
        catch (e) {
            throw new QuasiHttpError(
                "invalid quasi http response status code",
                QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
                { cause: e })
        }
        response.httpStatusMessage = reqOrStatusLine[2]
        response.contentLength = contentLength
        response.headers = headersReceiver
        if (body) {
            const bodySizeLimit = connection.processingOptions?.maxResponseBodySize
            if (!bodySizeLimit || bodySizeLimit > 0) {
                body = TlvUtils.createMaxLengthEnforcingStream(body,
                    bodySizeLimit)
            }
            // can't implement response buffering
            // due to how HEAD method works.
        }
        response.body = body
        return response
    }
    else {
        const request = new DefaultQuasiHttpRequest({
            environment: connection.environment
        })
        request.httpMethod = reqOrStatusLine[0]
        request.target = reqOrStatusLine[1]
        request.httpVersion = reqOrStatusLine[2]
        request.contentLength = contentLength
        request.headers = headersReceiver
        request.body = body
        return request
    }
}