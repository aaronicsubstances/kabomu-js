import * as QuasiHttpUtils from "../QuasiHttpUtils";
import * as MiscUtilsInternal from "../MiscUtilsInternal"
import * as IOUtilsInternal from "../IOUtilsInternal"
import * as CsvUtils from "../CsvUtils"
import * as TlvUtils from "./TlvUtils"
import {
    QuasiHttpError
} from "../errors";
import { Readable, Writable } from "stream";
import { pipeline } from "stream/promises";

export const TAG_FOR_HEADERS = 0x71683031;

export const TAG_FOR_BODY = 0x71623031;

function stringifyPossibleNull(s: any) {
    return (s === null || typeof s === "undefined") ? "" : `${s}`;
}

/**
 * Serializes quasi http request or response headers.
 * @param reqOrStatusLine request or response status line
 * @param remainingHeaders headers after request or status line
 * @returns serialized representation of quasi http headers
 */
export function encodeQuasiHttpHeaders(
        reqOrStatusLine: string[],
        remainingHeaders?: Map<string, string[]>) {
    const csv = new Array<string[]>();
    const specialHeader = new Array<string>()
    for (const v of reqOrStatusLine) {
        specialHeader.push(stringifyPossibleNull(v))
    }
    csv.push(specialHeader)
    if (remainingHeaders) {
        for (let [header, values] of remainingHeaders) {
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

    const serialized = MiscUtilsInternal.stringToBytes(
        CsvUtils.serialize(csv));
    return serialized;
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
        csv = CsvUtils.deserialize(MiscUtilsInternal.bytesToString(
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
        // merge headers with the same name in different rows.
        const headerName = headerRow[0]
        if (!headersReceiver.has(headerName)) {
            headersReceiver.set(headerName, [])
        }
        const headerValue = headerRow.slice(1);
        headersReceiver.get(headerName)!.push(...headerValue);
    }
    return specialHeader;
}

export async function writeQuasiHttpHeaders(
        dest: Writable,
        reqOrStatusLine: string[],
        remainingHeaders: Map<string, string[]> | undefined,
        maxHeadersSize?: number,
        abortSignal?: AbortSignal) {
    const encodedHeaders = encodeQuasiHttpHeaders(reqOrStatusLine,
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
            TAG_FOR_HEADERS, encodedHeaders.length)
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
    await TlvUtils.readExpectedTagOnly(src, TAG_FOR_HEADERS,
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