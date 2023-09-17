import { Readable } from "stream";
import * as QuasiHttpCodec from "./QuasiHttpCodec";
import * as QuasiHttpUtils from "../QuasiHttpUtils";
import {
    createBodyChunkEncodingStream,
    createContentLengthEnforcingStream
} from "./CustomStreamsInternal";
import {
    IQuasiHttpTransport,
    QuasiHttpConnection
} from "../types";
import {
    ExpectationViolationError,
    QuasiHttpError
} from "../errors";
import {
    DEFAULT_DATA_BUFFER_LIMIT,
    readAllBytesUpToGivenLimit,
    readBytesFully
} from "../IOUtilsInternal";

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
        timeoutPromise: Promise<boolean>,
        timeoutMsg: string) {
    if (!timeoutPromise) {
        return;
    }
    if (await timeoutPromise) {
        throw new QuasiHttpError(timeoutMsg,
            QuasiHttpError.REASON_CODE_TIMEOUT);
    }
}

export function encodeBodyToTransport(isResponse: boolean,
        contentLength: number | undefined,
        body: Readable | undefined) {
    if (!contentLength) {
        return undefined;
    }
    if (!body) {
        const errMsg = isResponse ?
            "no response body" :
            "no request body";
        throw new QuasiHttpError(errMsg);
    }
    if (contentLength < 0) {
        return createBodyChunkEncodingStream(body as any);
    }
    // don't enforce positive content lengths when writing out
    // quasi http bodies
    return body;
}

export function decodeRequestBodyFromTransport(
        contentLength: number | undefined,
        body: Readable | undefined) {
    if (!contentLength) {
        return undefined;
    }
    if (contentLength < 0) {
        return undefined
    }
    if (!body) {
        throw new QuasiHttpError("no request body");
    }
    return createContentLengthEnforcingStream(body,
        contentLength);
}

export function decodeResponseBodyFromTransport(
        contentLength: number | undefined,
        body: Readable | undefined,
        environment: Map<string, any> | undefined,
        responseBufferingEnabled: boolean | undefined) {
    if (!contentLength) {
        return [undefined, false, false];
    }
    let responseStreamingEnabled = false;
    if (typeof responseBufferingEnabled !== "undefined" &&
            responseBufferingEnabled !== null) {
        responseStreamingEnabled = !responseBufferingEnabled
    }
    if (getEnvVarAsBoolean(environment, 
            QuasiHttpUtils.ENV_KEY_SKIP_RES_BODY_DECODING)) {
        return [body, responseStreamingEnabled, false]
    }
    if (!body) {
        throw new QuasiHttpError("no response body");
    }
    if (responseStreamingEnabled) {
        if (contentLength > 0) {
            body = createContentLengthEnforcingStream(
                body, contentLength)
        }
        return [body, true, false];
    }
    return [body, false, true];
}

export async function bufferResponseBody(
        contentLength: number | undefined,
        body: Readable | undefined,
        bufferingSizeLimit: number | undefined,
        abortSignal?: AbortSignal) {
    if (!bufferingSizeLimit || bufferingSizeLimit < 0) {
        bufferingSizeLimit = DEFAULT_DATA_BUFFER_LIMIT;
    }
    if (!contentLength) {
        throw new ExpectationViolationError(
            "expected non-null and non-zero content length");
    }
    if (!body) {
        throw new ExpectationViolationError(
            "expected non-null response body")
    }
    if (contentLength < 0) {
        const buffer = await readAllBytesUpToGivenLimit(
            body, bufferingSizeLimit, abortSignal);
        if (!buffer) {
            throw new QuasiHttpError(
                "response body of indeterminate length exceeds buffering limit of " +
                `${bufferingSizeLimit} bytes`,
                QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
        }
        return Readable.from(buffer);
    }
    else {
        if (contentLength > bufferingSizeLimit) {
            throw new QuasiHttpError(
                "response body length exceeds buffering limit " +
                `(${contentLength} > ${bufferingSizeLimit})`,
                QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED)
        }
        const buffer = await readBytesFully(body,
            contentLength, abortSignal)
        return Readable.from(buffer)
    }
}

export async function readEntityFromTransport(
        isResponse: boolean, transport: IQuasiHttpTransport,
        connection: QuasiHttpConnection) {
    const encodedHeadersReceiver = new Array<Buffer>();
    const body = await transport.read(connection, isResponse,
        encodedHeadersReceiver);
    // either body should be non-null or some byte chunks should be
    // present in receiver list.
    if (!encodedHeadersReceiver.length) {
        if (!body) {
            const errMsg = isResponse ? "no response" : "no request";
            throw new QuasiHttpError(errMsg);
        }
        await readEncodedHeaders(body,
            encodedHeadersReceiver,
            connection.processingOptions?.maxHeadersSize,
            connection.abortSignal);
    }
    const encodedHeaders = Buffer.concat(encodedHeadersReceiver);
    return {
        headers: encodedHeaders,
        body
    };
}

export async function readEncodedHeaders(source: Readable,
        encodedHeadersReceiver: Array<Buffer>,
        maxHeadersSize?: number,
        abortSignal?: AbortSignal) {
    if (!maxHeadersSize || maxHeadersSize < 0) {
        maxHeadersSize = QuasiHttpUtils.DEFAULT_MAX_HEADERS_SIZE
    }
    let totalBytesRead = 0
    let previousChunkEndsWithLf = false;
    let previousChunkEndsWith2Lfs = false;
    while (true) {
        totalBytesRead += QuasiHttpCodec._HEADER_CHUNK_SIZE
        if (totalBytesRead > maxHeadersSize) {
            throw new QuasiHttpError(
                "size of quasi http headers to read exceed " +
                `max size (${totalBytesRead} > ${maxHeadersSize})`,
                QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
        }
        const chunk = await readBytesFully(source,
            QuasiHttpCodec._HEADER_CHUNK_SIZE, abortSignal);
        encodedHeadersReceiver.push(chunk);
        const carriageReturn = 13;
        const newline = 10;
        if (previousChunkEndsWith2Lfs &&
                (chunk[0] === carriageReturn || chunk[0] === newline)) {
            // done
            break;
        }
        if (previousChunkEndsWithLf &&
                (chunk[0] === carriageReturn || chunk[0] === newline) &&
                (chunk[1] === carriageReturn || chunk[1] === newline)) {
            // done
            break;
        }
        for (let i = 2; i < chunk.length; i++) {
            if (chunk[i] !== carriageReturn && chunk[i] !== newline) {
                continue;
            }
            if (chunk[i - 1] !== carriageReturn &&
                    chunk[i - 1] !== newline) {
                continue;
            }
            if (chunk[i - 2] === carriageReturn ||
                    chunk[i - 2] === newline) {
                // done.
                // don't just break, as this will only quit
                // the for loop and leave us in while loop.
                return;
            }
        }
        previousChunkEndsWithLf = 
            chunk[chunk.length - 1] === carriageReturn ||
                chunk[chunk.length - 1] === newline;
        previousChunkEndsWith2Lfs = previousChunkEndsWithLf &&
            (chunk[chunk.length - 1] === carriageReturn ||
                chunk[chunk.length - 1] === newline);
    }
}