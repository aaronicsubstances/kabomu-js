import * as QuasiHttpUtils from "../QuasiHttpUtils";
import * as MiscUtilsInternal from "../MiscUtilsInternal"
import * as CsvUtils from "../CsvUtils"
import {
    QuasiHttpError
} from "../errors";
import {
    IQuasiHttpRequest, IQuasiHttpResponse
} from "../types";

/**
 * This field gives a number of which all header sizes are
 * an integral multiple of.
 */
export const _HEADER_CHUNK_SIZE = 512;

/**
 * First version of quasi web protocol.
 */
export const _PROTOCOL_VERSION_01 = "01";

function stringifyPossibleNull(s: any) {
    return (s === null || typeof s === "undefined") ? "" : `${s}`;
}

/**
 * Serializes quasi http request headers.
 * @param reqHeaders source of quasi http request headers
 * @param maxHeadersSize limit on size of serialized result.
 * Can be null or zero for a default value to be used.
 * @returns serialized representation of quasi http request headers
 */
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
        reqHeaders.headers, maxHeadersSize)
}

/**
 * Serializes quasi http response headers.
 * @param resHeaders source of quasi http response headers
 * @param maxHeadersSize limit on size of serialized result.
 * Can be null or zero for a default value to be used.
 * @returns serialized representation of quasi http response headers
 */
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
        resHeaders.headers, maxHeadersSize)
}

function encodeRemainingHeaders(uniqueRow: string[],
        headers?: Map<string, string[]>,
        maxHeadersSize?: number) {
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = QuasiHttpUtils.DEFAULT_MAX_HEADERS_SIZE;
    }
    const csv = new Array<string[]>();
    csv.push([_PROTOCOL_VERSION_01]);
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
    let effectiveByteCount = MiscUtilsInternal.getByteCount(serialized);
    let lfCount = Math.ceil(effectiveByteCount /
        _HEADER_CHUNK_SIZE) * _HEADER_CHUNK_SIZE -
        effectiveByteCount;
    if (lfCount < 2) {
        lfCount += _HEADER_CHUNK_SIZE;
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
    return MiscUtilsInternal.stringToBytes(serialized);
}

/**
 * Deserializes a quasi http request header section.
 * @param buffer source of data to deserialize
 * @param request object whose header-related properties will be
 * set with decoded quasi http request headers
 */
export function decodeRequestHeaders(
        buffer: Buffer, request: IQuasiHttpRequest) {
    if (!request) {
        throw new Error("request argument is null");
    }
    const csv = startDecodeReqOrRes(buffer, false);
    const specialHeader = csv[1];
    if (specialHeader.length < 4) {
        throw new QuasiHttpError(
            "invalid quasi http request line",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    request.httpMethod = specialHeader[0]
    request.target = specialHeader[1]
    request.httpVersion = specialHeader[2]
    try {
        request.contentLength = MiscUtilsInternal.parseInt48(
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

/**
 * Deserializes a quasi http response header section.
 * @param buffer source of data to deserialize
 * @param response object whose header-related properties will be
 * set with decoded quasi http response headers
 */
export function decodeResponseHeaders(
        buffer: Buffer, response: IQuasiHttpResponse) {
    if (!response) {
        throw new Error("response argument is null");
    }
    const csv = startDecodeReqOrRes(buffer, true);
    const specialHeader = csv[1];
    if (specialHeader.length < 4) {
        throw new QuasiHttpError(
            "invalid quasi http status line",
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    try {
        response.statusCode = MiscUtilsInternal.parseInt32(
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
        response.contentLength = MiscUtilsInternal.parseInt48(
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

function startDecodeReqOrRes(buffer: Buffer, isResponse: boolean) {
    if (!buffer) {
        throw new Error("buffer argument is null");
    }
    const tag = isResponse ? "response" : "request";
    let csv: Array<string[]>;
    try {
        csv = CsvUtils.deserialize(MiscUtilsInternal.bytesToString(
            buffer))
    }
    catch (e) {
        throw new QuasiHttpError(
            `invalid quasi http ${tag} headers`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e });
    }
    if (csv.length < 2 || !csv[0].length ||
            csv[0][0] !== _PROTOCOL_VERSION_01) {
        throw new QuasiHttpError(
            `invalid quasi http ${tag} headers`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION);
    }
    return csv;
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