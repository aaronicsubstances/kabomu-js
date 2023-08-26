import { Readable, Writable } from "stream";

import { QuasiHttpRequestProcessingError } from "./errors";
import { ICancellableTimeoutPromiseInternal, IQuasiHttpBody } from "./types";
import * as IOUtils from "../common/IOUtils";
import { createPendingPromise, whenAnyPromiseSettles } from "../common/MiscUtilsInternal";
import { createChunkDecodingCustomReader } from "./chunkedtransfer/ChunkDecodingCustomReader";
import { createContentLengthEnforcingCustomReader } from "../common/ContentLengthEnforcingCustomReader";
import { createChunkEncodingCustomWriter } from "./chunkedtransfer/ChunkEncodingCustomWriter";
import { ByteBufferBody } from "./entitybody/ByteBufferBody";
import { LambdaBasedQuasiHttpBody } from "./entitybody/LambdaBasedQuasiHttpBody";
import { parseInt32 } from "../common/ByteUtils";
import { getBodyReader } from "./entitybody/EntityBodyUtils";

export function determineEffectiveNonZeroIntegerOption(
        preferred: number | undefined,
        fallback1: number | undefined,
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
        preferred: number | undefined,
        fallback1: number | undefined,
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
        preferred: Map<string, any> | undefined,
        fallback: Map<string, any> | undefined) {
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
        preferred: boolean | undefined,
        fallback1: boolean | undefined, 
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

export async function createEquivalentOfUnknownBodyInMemory(
        body: IQuasiHttpBody,
        bodyBufferingLimit: number | undefined) {
    // Assume that body is completely unknown, and as such has nothing
    // to do with chunk transfer protocol, or have no need for
    // content length enforcement.
    const reader = getBodyReader(body);

    // now read in entirety of body into memory
    const inMemBuffer = await IOUtils.readAllBytes(reader, bodyBufferingLimit);
    return new ByteBufferBody(inMemBuffer);
}

export async function transferBodyToTransport(
        writer: Writable,
        maxChunkSize: number | undefined,
        body: IQuasiHttpBody,
        contentLength: number | undefined) {
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
        contentLength: number | undefined,
        releaseFunc: (() => Promise<void>) | undefined,
        maxChunkSize: number | undefined,
        bufferingEnabled: boolean | undefined,
        bodyBufferingSizeLimit: number | undefined)
        : Promise<IQuasiHttpBody | undefined> {
    if (!contentLength) {
        return undefined;
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
        workPromise: Promise<T>,
        timeoutPromise: Promise<any> | undefined,
        cancellationPromise: Promise<any> | undefined) {
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

export function createCancellableTimeoutPromise(
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
    const pendingPromise = createPendingPromise<void>()
    const timeoutId = setTimeout(() => {
        const timeoutError = new QuasiHttpRequestProcessingError(
            timeoutMsg,
            QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT);
        pendingPromise.reject(timeoutError);
    }, timeoutMillis);
    let cancelled = false;
    const cancellationHandle: ICancellableTimeoutPromiseInternal = {
        promise: pendingPromise.promise,
        isCancellationRequested() {
            return cancelled
        },
        cancel() {
            clearTimeout(timeoutId);
            pendingPromise.resolve();
            cancelled = true;
        }
    }
    return cancellationHandle
}
