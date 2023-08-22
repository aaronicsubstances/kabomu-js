import { Readable, Writable } from "stream";

import { QuasiHttpRequestProcessingError } from "./errors";
import { ICancellablePromiseInternal, IPendingPromiseInternal, IQuasiHttpBody } from "./types";
import * as IOUtils from "../common/IOUtils";
import { whenAnyPromiseSettles } from "../common/MiscUtilsInternal";
import { createChunkDecodingCustomReader } from "./chunkedtransfer/ChunkDecodingCustomReader";
import { createContentLengthEnforcingCustomReader } from "../common/ContentLengthEnforcingCustomReader";
import { createChunkEncodingCustomWriter } from "./chunkedtransfer/ChunkEncodingCustomWriter";
import { ByteBufferBody } from "./entitybody/ByteBufferBody";
import { LambdaBasedQuasiHttpBody } from "./entitybody/LambdaBasedQuasiHttpBody";
import { parseInt32 } from "../common/ByteUtils";
import { getBodyReader } from "./entitybody/EntityBodyUtils";

export function determineEffectiveNonZeroIntegerOption(
        preferred: number | null, fallback1: number | null,
        defaultValue: number) {
    return parseInt32((function() {
        if (preferred) {
            return preferred;
        }
        if (fallback1) {
            return fallback1;
        }
        return defaultValue;
    })());
}

export function determineEffectivePositiveIntegerOption(
        preferred: number | null, fallback1: number | null,
        defaultValue: number) {
    if (preferred) {
        const effectiveValue = parseInt32(preferred)
        if (effectiveValue > 0) {
            return effectiveValue
        }
    }
    if (fallback1) {
        const effectiveValue = parseInt32(fallback1)
        if (effectiveValue > 0) {
            return effectiveValue
        }
    }
    return parseInt32(defaultValue);
}

export function determineEffectiveOptions(
        preferred?: Map<string, any> | null,
        fallback?: Map<string, any> | null) {
    const dest = new Map<string, any>();
    // since we want preferred options to overwrite fallback options,
    // set fallback options first.
    if (fallback) {
        for (const item of fallback) {
            dest.set(item[0], item[1]);
        }
    }
    if (preferred) {
        for (const item of preferred) {
            dest.set(item[0], item[1]);
        }
    }
    return dest;
}

export function determineEffectiveBooleanOption(
        preferred: boolean | null, fallback1: boolean | null, 
        defaultValue: boolean) {
    if (preferred !== null && typeof preferred !== "undefined") {
        return !!preferred;
    }
    if (fallback1 !== null && typeof fallback1 !== "undefined") {
        return !!fallback1;
    }
    return !!defaultValue;
}

export function getEnvVarAsBoolean(
        environment: Map<string, any> | null | undefined,
        key: string) {
    if (environment && environment.has(key)) {
        const value = environment.get(key);
        if (value !== null && typeof value !== "undefined") {
            return !!value;
        }
    }
    return null;
}

export async function createEquivalentOfUnknownBodyInMemory(
        body: IQuasiHttpBody, bodyBufferingLimit: number) {
    // Assume that body is completely unknown, and as such has nothing
    // to do with chunk transfer protocol, or have no need for
    // content length enforcement.
    const reader = getBodyReader(body);

    // now read in entirety of body into memory
    const inMemBuffer = await IOUtils.readAllBytes(reader, bodyBufferingLimit);
    return new ByteBufferBody(inMemBuffer);
}

export async function transferBodyToTransport(
        writer: Writable, maxChunkSize: number,
        body: IQuasiHttpBody,
        contentLength: number | null | undefined) {
    if (!contentLength) {
        return;
    }
    if (contentLength < 0) {
        const chunkWriter = createChunkEncodingCustomWriter(writer, maxChunkSize);
        await body.writeBytesTo(chunkWriter);
        // important for chunked transfer to write out final empty chunk
        await IOUtils.endWrites(chunkWriter);
    }
    else {
        await body.writeBytesTo(writer);
    }
}

export async function createBodyFromTransport(
        reader: Readable,
        contentLength: number | null | undefined,
        releaseFunc: (() => Promise<void>) | null,
        maxChunkSize: number,
        bufferingEnabled: boolean,
        bodyBufferingSizeLimit: number) {
    if (!contentLength) {
        return null;
    }

    if (contentLength < 0) {
        reader = createChunkDecodingCustomReader(reader,
            maxChunkSize);
    }
    else {
        reader = createContentLengthEnforcingCustomReader(reader,
            contentLength);
    }
    if (bufferingEnabled) {
        const inMemBuffer = await IOUtils.readAllBytes(
            reader, bodyBufferingSizeLimit);
        const bufferedBody = new ByteBufferBody(inMemBuffer);
        bufferedBody.contentLength = contentLength;
        return bufferedBody;
    }
    else {
        const unbuffered = new LambdaBasedQuasiHttpBody();
        unbuffered.contentLength = contentLength;
        unbuffered.readerFunc = () => reader;
        unbuffered.releaseFunc = releaseFunc;
        return unbuffered;
    }
}

export async function completeRequestProcessing<T>(
        workPromise: Promise<T>, timeoutPromise: Promise<T> | null,
        cancellationPromise: Promise<T> | null) {
    if (!workPromise) {
        throw new Error("workPromise argument is null");
    }

    // ignore null promises and successful results from
    // promises other than work promise.
    let promises = [ workPromise ];
    if (timeoutPromise) {
        promises.push(timeoutPromise);
    }
    if (cancellationPromise) {
        promises.push(cancellationPromise);
    }
    while (promises.length > 1) {
        const firstPromise = promises[await whenAnyPromiseSettles(
            promises)]
        if (firstPromise === workPromise) {
            break;
        }
        await firstPromise; // let any exceptions bubble up.
        promises = promises.filter(p => p !== firstPromise);
    }
    return await workPromise;
}

export function createCancellableTimeoutPromise<T>(
        timeoutMillis: number, timeoutMsg: string) {
    if (!timeoutMillis || timeoutMillis <= 0) {
        return {
            isCancellationRequested() {
                return false
            },
            cancel() {
                
            },
        } as ICancellablePromiseInternal<T>
    }
    const pendingPromise = createPendingPromise<T>()
    const timeoutId = setTimeout(() => {
        const timeoutError = new QuasiHttpRequestProcessingError(
            timeoutMsg,
            QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT);
        pendingPromise.reject(timeoutError);
    }, timeoutMillis);
    let cancelled = false;
    const cancellationHandle: ICancellablePromiseInternal<T> = {
        promise: pendingPromise.promise,
        isCancellationRequested() {
            return cancelled
        },
        cancel() {
            clearTimeout(timeoutId);
            pendingPromise.resolve(null as T);
            cancelled = true;
        }
    }
    return cancellationHandle
}

export function createPendingPromise<T>() {
    const pendingPromise = {
    } as IPendingPromiseInternal<T>
    pendingPromise.promise = new Promise<T>((resolve, reject) => {
        pendingPromise.resolve = resolve
        pendingPromise.reject = reject
    })
    return pendingPromise;
}
