import { Readable } from "stream";
import * as MiscUtils from "../MiscUtils"
import * as CsvUtils from "../CsvUtils"
import {
    QuasiHttpError
} from "../errors";
import {
    IQuasiHttpRequest, IQuasiHttpResponse
} from "../types";

/**
 *  Request environment variable for local server endpoint.
 */
export const ENV_KEY_LOCAL_PEER_ENDPOINT = "kabomu.local_peer_endpoint";

/**
 *  Request environment variable for remote client endpoint.
 */
export const ENV_KEY_REMOTE_PEER_ENDPOINT = "kabomu.remote_peer_endpoint";

/**
 * Request environment variable for the transport instance from
 * which a request was received.
 */
export const ENV_KEY_TRANSPORT_INSTANCE = "kabomu.transport";

/**
 * Request environment variable for the connection from which a
 * request was received.
 */
export const ENV_KEY_CONNECTION = "kabomu.connection";

/**
 * Environment variable for indicating that a request or response
 * should not be sent at all. Intended
 * for use in responding to fire and forget requests, as well as
 * cases where request or response has been sent already by other
 * means.
 */
export const ENV_KEY_SKIP_SENDING = "kabomu.skip_sending";

/**
 * Environment variable indicating that the response body 
 * received from transport should be returned to client without
 * any decoding applied.
 */
export const ENV_KEY_SKIP_RES_BODY_DECODING = "kabomu.skip_res_body_decoding";

export const METHOD_CONNECT = "CONNECT";
export const METHOD_DELETE = "DELETE";
export const METHOD_GET = "GET";
export const METHOD_HEAD = "HEAD";
export const METHOD_OPTIONS = "OPTIONS";
export const METHOD_PATCH = "PATCH";
export const METHOD_POST = "POST";
export const METHOD_PUT = "PUT";
export const METHOD_TRACE = "TRACE";

/**
 * 200 OK
 */
export const STATUS_CODE_OK = 200;

/**
 * 400 Bad Request
 */
export const STATUS_CODE_CLIENT_ERROR_BAD_REQUEST = 400;

/**
 * 401 Unauthorized
 */
export const STATUS_CODE_CLIENT_ERROR_UNAUTHORIZED = 401;

/**
 * 403 Forbidden
 */
export const STATUS_CODE_CLIENT_ERROR_FORBIDDEN = 403;

/**
 * 404 Not Found
 */
export const STATUS_CODE_CLIENT_ERROR_NOT_FOUND = 404;

/**
 * 405 Method Not Allowed
 */
export const STATUS_CODE_CLIENT_ERROR_METHOD_NOT_ALLOWED = 405;

/**
 * 413 Payload Too Large
 */
export const STATUS_CODE_CLIENT_ERROR_PAYLOAD_TOO_LARGE = 413;

/**
 * 414 URI Too Long
 */
export const STATUS_CODE_CLIENT_ERROR_URI_TOO_LONG = 414;

/**
 * 415 Unsupported Media Type
 */
export const STATUS_CODE_CLIENT_ERROR_UNSUPPORTED_MEDIA_TYPE = 415;

/**
 * 422 Unprocessable Entity
 */
export const STATUS_CODE_CLIENT_ERROR_UNPROCESSABLE_ENTITY = 422;

/**
 * 429 Too Many Requests
 */
export const STATUS_CODE_CLIENT_ERROR_TOO_MANY_REQUESTS = 429;

/**
 * 500 Internal Server Error
 */
export const STATUS_CODE_SERVER_ERROR = 500;

/**
 * The default value of maximum size of headers in a request or response.
 */
export const DEFAULT_MAX_HEADERS_SIZE = 8_192;

/**
 * The maximum possible size that headers in a request or response
 * cannot exceed.
 */
const hardLimitOnMaxHeadersSize = 999_999;

/**
 * This field gives a number of which all header sizes are
 * an integral multiple of.
 */
const headerChunkSize = 512;

/**
 * First version of quasi web protocol.
 */
export const PROTOCOL_VERSION_01 = "01";

function stringifyPossibleNull(s: any) {
    return (s === null || typeof s === "undefined") ? "" : `${s}`;
}

export function encodeRequestHeaders(
        reqHeaders: IQuasiHttpRequest,
        maxHeadersSize?: number) {
    if (!reqHeaders) {
        throw new Error("reqHeaders argument is null");
    }
    const uniqueRow = [
        stringifyPossibleNull(reqHeaders.httpMethod),
        stringifyPossibleNull(reqHeaders.target),
        stringifyPossibleNull(reqHeaders.httpVersion),
        stringifyPossibleNull(reqHeaders.contentLength || 0)
    ]
    return encodeRemainingHeaders(uniqueRow,
        reqHeaders?.headers, maxHeadersSize)
}

export function encodeResponseHeaders(
        resHeaders: IQuasiHttpResponse,
        maxHeadersSize?: number) {
    if (!resHeaders) {
        throw new Error("resHeaders argument is null");
    }
    const uniqueRow = [
        stringifyPossibleNull(resHeaders.statusCode || 0),
        stringifyPossibleNull(resHeaders.httpStatusMessage),
        stringifyPossibleNull(resHeaders.httpVersion),
        stringifyPossibleNull(resHeaders.contentLength || 0)
    ]
    return encodeRemainingHeaders(uniqueRow,
        resHeaders?.headers, maxHeadersSize)
}

function encodeRemainingHeaders(uniqueRow: string[],
        headers?: Map<string, string[]>,
        maxHeadersSize?: number) {
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = DEFAULT_MAX_HEADERS_SIZE;
    }
    const csv = new Array<string[]>();
    csv.push([PROTOCOL_VERSION_01]);
    csv.push(uniqueRow);
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
            csv.push(headerRow);
        }
    }

    // ensure there are no new lines in csv items
    if (csv.some(row => row.some(item => item.indexOf("\n") != -1 ||
            item.indexOf("\r") != -1))) {
        throw new QuasiHttpError(
            "quasi http headers cannot contain newlines",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
    }

    // add at least two line feeds to ensure byte count
    // is multiple of header chunk size.
    let serialized = CsvUtils.serialize(csv);
    let effectiveByteCount = MiscUtils._getByteCount(serialized);
    let lfCount = Math.ceil(effectiveByteCount /
        headerChunkSize) * headerChunkSize -
        effectiveByteCount;
    if (lfCount < 2) {
        lfCount += headerChunkSize;
    }
    serialized += "".padEnd(lfCount, "\n");
    effectiveByteCount += lfCount;

    // finally check that byte count of csv doesn't exceed limit.
    if (effectiveByteCount > maxHeadersSize) {
        throw new QuasiHttpError(
            "quasi http headers exceed " +
            `max size (${effectiveByteCount} > ${maxHeadersSize})`,
            QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
    }
    if (effectiveByteCount > hardLimitOnMaxHeadersSize) {
        throw new QuasiHttpError(
            "quasi http headers too " +
            `large (${effectiveByteCount} > ${hardLimitOnMaxHeadersSize})`,
            QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
    }
    return MiscUtils.stringToBytes(serialized);
}

export function decodeRequestHeaders(
        encodedCsv: Array<Buffer>, request: IQuasiHttpRequest) {
    const csv = CsvUtils.deserialize(MiscUtils.bytesToString(
        Buffer.concat(encodedCsv)))
    if (csv.length < 2) {
        throw new QuasiHttpError(
            "invalid encoded quasi http request headers",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    // skip first row.
    const specialHeader = csv[1]
    if (specialHeader.length < 4) {
        throw new QuasiHttpError(
            "invalid encoded quasi http request line",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    request.httpMethod = specialHeader[0]
    request.target = specialHeader[1]
    request.httpVersion = specialHeader[2]
    try {
        request.contentLength = MiscUtils.parseInt48(
            specialHeader[3])
    }
    catch (e) {
        throw new QuasiHttpError(
            "invalid quasi http request content length",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e });
    }
    request.headers = decodeRemainingHeaders(csv)
}

export function decodeResponseHeaders(
        encodedCsv: Array<Buffer>, response: IQuasiHttpResponse) {
    const csv = CsvUtils.deserialize(MiscUtils.bytesToString(
        Buffer.concat(encodedCsv)))
    if (csv.length < 2) {
        throw new QuasiHttpError(
            "invalid encoded quasi http response headers",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    // skip first row.
    const specialHeader = csv[1]
    if (specialHeader.length < 4) {
        throw new QuasiHttpError(
            "invalid encoded quasi http status line",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    try {
        response.statusCode = MiscUtils.parseInt32(
            specialHeader[0])
    }
    catch (e) {
        throw new QuasiHttpError(
            "invalid quasi http response status code",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e });
    }
    response.httpStatusMessage = specialHeader[1]
    response.httpVersion = specialHeader[2]
    try {
        response.contentLength = MiscUtils.parseInt48(
            specialHeader[3])
    }
    catch (e) {
        throw new QuasiHttpError(
            "invalid quasi http response content length",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e });
    }
    response.headers = decodeRemainingHeaders(csv)
}

function decodeRemainingHeaders(csv: Array<string[]>) {
    let headers = new Map<string, string[]>()
    for (let i = 2; i < csv.length; i++) {
        const headerRow = csv[i];
        if (headerRow.length < 2) {
            continue;
        }
        // merge headers with the same name in different rows.
        const headerName = headerRow[0]
        if (!headers.has(headerName)) {
            headers.set(headerName, [])
        }
        const headerValue = headerRow.slice(1);
        headers.get(headerName)!.push(...headerValue);
    }
    return headers
}

export async function readEncodedHeaders(source: Readable,
        encodedHeadersReceiver: Array<Buffer>,
        maxHeadersSize?: number,
        abortSignal?: AbortSignal) {
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = DEFAULT_MAX_HEADERS_SIZE
    }
    let totalBytesRead = 0
    let previousChunkEndsWithLf = false;
    while (true) {
        totalBytesRead += headerChunkSize
        if (totalBytesRead > maxHeadersSize) {
            throw new QuasiHttpError(
                "size of quasi http headers to read exceed " +
                `max size (${totalBytesRead} > ${maxHeadersSize})`,
                QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
        }
        const chunk = await MiscUtils.readBytesFully(source,
            headerChunkSize, abortSignal);
        encodedHeadersReceiver.push(chunk);
        const newline = 10;
        if (previousChunkEndsWithLf && chunk[0] === newline) {
            // done
            break;
        }
        for (let i = 1; i < chunk.length; i++) {
            if (chunk[i] !== newline) {
                continue;
            }
            if (chunk[i - 1] === newline) {
                // done.
                // don't just break, as this will only quit
                // the for loop and leave us in while loop.
                return;
            }
        }
        previousChunkEndsWithLf = chunk[chunk.length - 1] === newline;
    }
}