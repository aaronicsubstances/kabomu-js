import { Readable, Writable } from "stream";
import { pipeline } from "stream/promises";
import {
    bytesToString,
    parseInt32,
    parseInt48,
    stringToBytes
} from "../MiscUtilsInternal";
import * as QuasiHttpUtils from "../QuasiHttpUtils";
import * as IOUtilsInternal from "../IOUtilsInternal"
import * as CsvUtils from "../CsvUtils"
import * as TlvUtils from "./TlvUtils";
import {
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    QuasiHttpConnection
} from "../types";
import {
    ExpectationViolationError,
    MissingDependencyError,
    QuasiHttpError
} from "../errors";
import { DefaultQuasiHttpResponse } from "../DefaultQuasiHttpResponse";
import { DefaultQuasiHttpRequest } from "../DefaultQuasiHttpRequest";

export function getEnvVarAsBoolean(
        environment: Map<string, any> | undefined,
        key: string) {
    if (environment && environment.has(key)) {
        const value = environment.get(key);
        if (value !== null && typeof value !== "undefined") {
            return !!value;
        }
    }
    return undefined;
}

export async function wrapTimeoutPromise(
        timeoutPromise: Promise<boolean> | undefined,
        timeoutMsg: string) {
    if (!timeoutPromise) {
        return;
    }
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
    for (const item of specialHeader) {
        if (!containsOnlyPrintableAsciiChars(item,
                false, false)) {
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
        if (!containsOnlyPrintableAsciiChars(headerName,
                true, false)) {
            throw new QuasiHttpError(
                "quasi http header name contains characters " +
                "other than hyphen and English alphabets: " +
                headerName,
                QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
        }
        for (let j = 1; j < row.length; j++) {
            const headerValue = row[j];
            if (!containsOnlyPrintableAsciiChars(headerValue,
                    false, true)) {
                throw new QuasiHttpError(
                    "quasi http header value contains newlines or " +
                    "non-printable ASCII characters: " + headerValue,
                    QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
            }
        }
    }
}

export function containsOnlyPrintableAsciiChars(v: string,
        safeOnly: boolean, allowSpace: boolean) {
    for (let i = 0; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if (safeOnly) {
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
        else {
            if (c < 32 || c > 126) {
                return false;
            }
            if (!allowSpace && c === 32) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Serializes quasi http request or response headers.
 * @param reqOrStatusLine request or response status line
 * @param remainingHeaders headers after request or status line
 * @returns serialized representation of quasi http headers
 */
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

/**
 * Deserializes a quasi http request or response header section.
 * @param buffer source of data to deserialize
 * @param headersReceiver will be extended with remaining headers found
 * after the request or response line
 * @returns request or response line, ie first row before headers
 * @throws QuasiHttpError if buffer argument contains
 * invalid quasi http request or response headers
 */
export function decodeQuasiHttpHeaders(
        buffer: Buffer,
        headersReceiver: Map<string, string[]>) {
    if (!buffer) {
        throw new Error("buffer argument is null");
    }
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
        maxHeadersSize?: number,
        abortSignal?: AbortSignal) {
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
        yield TlvUtils.encodeTagAndLengthOnly(
            TlvUtils.TAG_FOR_QUASI_HTTP_HEADERS,
            encodedHeaders.length)
        yield encodedHeaders
    })());
    await pipeline(encodedHeadersReadable, dest, {
        end: false,
        signal: abortSignal
    });
}

export async function readQuasiHttpHeaders(
        src: Readable,
        headersReceiver: Map<string, string[]>,
        maxHeadersSize?: number,
        abortSignal?: AbortSignal) {
    await TlvUtils.readExpectedTagOnly(src,
        TlvUtils.TAG_FOR_QUASI_HTTP_HEADERS,
        abortSignal)
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = QuasiHttpUtils.DEFAULT_MAX_HEADERS_SIZE;
    }
    const headersSize = await TlvUtils.readLengthOnly(src, abortSignal)
    if (headersSize > maxHeadersSize) {
        throw new QuasiHttpError(
            "quasi http headers exceed " +
            `max size (${headersSize} > ${maxHeadersSize})`,
            QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
    }
    const encodedHeaders = await IOUtilsInternal.readBytesFully(
        src, headersSize, abortSignal);
    return decodeQuasiHttpHeaders(encodedHeaders,
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
    let contentLength: number | undefined;
    let reqOrStatusLine: any
    let headers: Map<string, string[]> | undefined
    if (isResponse) {
        const response = entity as IQuasiHttpResponse
        headers = response.headers
        body = response.body
        contentLength = response.contentLength
        reqOrStatusLine = [
            response.statusCode || 0,
            response.httpStatusMessage,
            response.httpVersion,
            undefined
        ]
    }
    else {
        const request = entity as IQuasiHttpRequest
        headers = request.headers
        body = request.body
        contentLength = request.contentLength
        reqOrStatusLine = [
            request.httpMethod,
            request.target,
            request.httpVersion,
            undefined
        ]
    }
    // treat content lengths totally separate from body
    // due to how HEAD method works.
    contentLength = contentLength || 0
    reqOrStatusLine[3] = contentLength
    await writeQuasiHttpHeaders(isResponse,
        writableStream, reqOrStatusLine, headers,
        connection.processingOptions?.maxHeadersSize,
        connection.abortSignal)
    if (!body) {
        // don't proceed, even if content length is not zero.
        return;
    }
    if (contentLength > 0) {
        // don't enforce positive content lengths when writing out
        // quasi http bodies
        await pipeline(body, writableStream, {
            end: false,
            signal: connection.abortSignal
        })
    }
    else {
        // proceed, even if content length is 0.
        const encodedBody = TlvUtils.createTlvEncodingReadableStream(
            body, TlvUtils.TAG_FOR_QUASI_HTTP_BODY)
        await pipeline(encodedBody, writableStream, {
            end: false,
            signal: connection.abortSignal
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
        readableStream,
        headersReceiver,
        connection.processingOptions?.maxHeadersSize,
        connection.abortSignal)
    if (reqOrStatusLine.length < 4) {
        throw new QuasiHttpError(
            `invalid quasi http ${(isResponse ? "status" : "request")} line`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
    }
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
                readableStream, TlvUtils.TAG_FOR_QUASI_HTTP_BODY)
        }
    }
    if (isResponse) {
        const response = new DefaultQuasiHttpResponse()
        try {
            response.statusCode = parseInt32(
                reqOrStatusLine[0])
        }
        catch (e) {
            throw new QuasiHttpError(
                "invalid quasi http response status code",
                QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
                { cause: e })
        }
        response.httpStatusMessage = reqOrStatusLine[1]
        response.httpVersion = reqOrStatusLine[2]
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
        request.headers = headersReceiver
        request.body = body
        return request
    }
}