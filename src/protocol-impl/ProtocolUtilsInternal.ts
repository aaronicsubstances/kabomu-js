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
    QuasiHttpRequestProcessingError
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
    return createContentLengthEnforcingStream(body, contentLength);
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
    if (responseStreamingEnabled) {
        if (contentLength > 0) {
            response.body = createContentLengthEnforcingStream(
                response.body, contentLength)
        }
        return true
    }
    let bufferingLimit = processingOptions?.responseBodyBufferingSizeLimit
    if (!bufferingLimit || bufferingLimit < 0) {
        bufferingLimit = QuasiHttpCodec.DEFAULT_DATA_BUFFER_LIMIT
    }
    const body = response.body
    if (!body) {
        throw new ExpectationViolationError(
            "expected non-null response body")
    }
    if (contentLength < 0) {
        response.body = await QuasiHttpCodec.readAllBytes(
            body, bufferingLimit, abortSignal);
    }
    else {
        if (contentLength > bufferingLimit) {
            throw new QuasiHttpRequestProcessingError(
                "response body length exceeds buffering limit " +
                `(${contentLength} > ${bufferingLimit})`,
                QuasiHttpRequestProcessingError.REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED)
        }
        const buffer = await MiscUtils.readBytesFully(body,
            contentLength, abortSignal)
        response.body = Readable.from(buffer)
    }
    return false
}

/*export function createCancellableTimeoutPromise(
        timeoutMillis: number, timeoutMsg: string) {
    if (!timeoutMillis || timeoutMillis <= 0) {
        return {
            isCancellationRequested() {
                return false
            },
            cancel() {
                
            },
        } as ICancellableTimeoutPromiseInternal
    }
    const blankChequePromise = createBlankChequePromise<void>()
    const timeoutId = setTimeout(() => {
        const timeoutError = new QuasiHttpRequestProcessingError(
            timeoutMsg,
            QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT);
        blankChequePromise.reject(timeoutError);
    }, timeoutMillis);
    let cancelled = false;
    const cancellationHandle: ICancellableTimeoutPromiseInternal = {
        promise: blankChequePromise.promise,
        isCancellationRequested() {
            return cancelled
        },
        cancel() {
            clearTimeout(timeoutId);
            blankChequePromise.resolve();
            cancelled = true;
        }
    }
    return cancellationHandle
}*/
