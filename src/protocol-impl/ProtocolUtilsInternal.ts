import { Readable } from "stream";
import * as MiscUtils from "../MiscUtils";
import * as QuasiHttpCodec from "./QuasiHttpCodec";
import {
    createContentLengthEnforcingStream
} from ".";
import {
    IQuasiHttpResponse,
    QuasiHttpProcessingOptions
} from "../types";
import {
    ExpectationViolationError,
    QuasiHttpError
} from "../errors";

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

export function encodeBodyToTransport(isResponse: boolean,
        contentLength: number | undefined,
        body: Readable | undefined) {
    if (!contentLength) {
        return undefined;
    }
    if (!isResponse && contentLength < 0) {
        return undefined;
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

export async function decodeResponseBodyFromTransport(
        response: IQuasiHttpResponse,
        environment: Map<string, any> | undefined,
        processingOptions: QuasiHttpProcessingOptions | undefined,
        abortSignal?: AbortSignal) {
    const contentLength = response.contentLength
    if (!contentLength) {
        response.body = undefined
        return false;
    }
    let responseStreamingEnabled = processingOptions?.responseBufferingEnabled
    if (typeof responseStreamingEnabled === "undefined" ||
            responseStreamingEnabled === null) {
        responseStreamingEnabled = false;
    }
    else {
        responseStreamingEnabled = !responseStreamingEnabled
    }
    if (getEnvVarAsBoolean(environment, 
            QuasiHttpCodec.ENV_KEY_SKIP_RES_BODY_DECODING)) {
        return responseStreamingEnabled
    }
    if (!response.body) {
        throw new QuasiHttpError("no response body");
    }
    if (responseStreamingEnabled) {
        if (contentLength > 0) {
            response.body = createContentLengthEnforcingStream(
                response.body, contentLength)
        }
        return true
    }
    let bufferingLimit = processingOptions?.responseBodyBufferingSizeLimit
    if (!bufferingLimit || bufferingLimit < 0) {
        bufferingLimit = MiscUtils.DEFAULT_DATA_BUFFER_LIMIT
    }
    const body = response.body
    if (!body) {
        throw new ExpectationViolationError(
            "expected non-null response body")
    }
    if (contentLength < 0) {
        const buffer = await MiscUtils.readAllBytesUpToGivenLimit(
            body, bufferingLimit, abortSignal);
        if (!buffer) {
            throw new QuasiHttpError(
                "response body of indeterminate length exceeds buffering limit of " +
                `${bufferingLimit} bytes`,
                QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED);
        }
        response.body = Readable.from(buffer);
    }
    else {
        if (contentLength > bufferingLimit) {
            throw new QuasiHttpError(
                "response body length exceeds buffering limit " +
                `(${contentLength} > ${bufferingLimit})`,
                QuasiHttpError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED)
        }
        const buffer = await MiscUtils.readBytesFully(body,
            contentLength, abortSignal)
        response.body = Readable.from(buffer)
    }
    return false
}
