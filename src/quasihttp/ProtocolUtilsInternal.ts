import { QuasiHttpRequestProcessingError } from "./errors";
import { IQuasiHttpBody } from "./types";
import * as IOUtils from "../common/IOUtils";
import * as EntityBodyUtils from "./entitybody/EntityBodyUtils";

function parseIntExactly(input: any) {
    const n = Number(input);
    if (Number.isNaN(n)) {
        throw new Error("wrong input number: " + input);
    }
    return n;
}

export function determineEffectiveNonZeroIntegerOption(
        preferred: number | null, fallback1: number | null,
        defaultValue: number) {
    if (preferred !== null && typeof preferred !== "undefined") {
        const effectiveValue = Number(preferred);
        if (effectiveValue) {
            return effectiveValue;
        }
    }
    if (fallback1 !== null && typeof fallback1 !== "undefined") {
        const effectiveValue = Number(fallback1);
        if (effectiveValue) {
            return effectiveValue;
        }
    }
    return parseIntExactly(defaultValue);
}

export function determineEffectivePositiveIntegerOption(
        preferred: number | null, fallback1: number | null,
        defaultValue: number) {
    if (preferred !== null && typeof preferred !== "undefined") {
        const effectiveValue = Number(preferred);
        if (!Number.isNaN(effectiveValue) && effectiveValue > 0) {
            return effectiveValue;
        }
    }
    if (fallback1 !== null && typeof fallback1 !== "undefined") {
        const effectiveValue = Number(fallback1);
        if (!Number.isNaN(effectiveValue) && effectiveValue > 0) {
            return effectiveValue;
        }
    }
    return parseIntExactly(defaultValue);
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
        environment: Map<string, any>, key: string) {
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
    // Assume that body is completely unknown,and as such has nothing
    // to do with chunk transfer protocol
    let reader = EntityBodyUtils.asReader(body);

    // but still enforce the content length. even if zero,
    // still pass it on
    const contentLength = body.contentLength;
    if (contentLength >= 0) {
        reader = new ContentLengthEnforcingCustomReader(reader,
            contentLength);
    }

    // now read in entirety of body into memory
    const inMemBuffer = await IOUtils.readAllBytes(reader, bodyBufferingLimit);
    
    // finally maintain content length for the sake of tests.
    const bufferedBody = new ByteBufferBody(inMemBuffer);
    bufferedBody.contentLength = contentLength;
    return bufferedBody;
}

export async function transferBodyToTransport(
    writer: any, maxChunkSize: number, body: IQuasiHttpBody) {
    const contentLength = body?.contentLength ?? 0;
    if (!body || !contentLength) {
        return;
    }
    if (contentLength < 0) {
        var chunkWriter = new ChunkEncodingCustomWriter(writer, maxChunkSize);
        await body.writeBytesTo(chunkWriter);
        // important for chunked transfer to write out final empty chunk
        await chunkWriter.endWrites();
    }
    else {
        await body.writeBytesTo(writer);
    }
}

export async function createBodyFromTransport(
        reader: any,
        contentLength: BigInt,
        releaseFunc: () => Promise<void> | null,
        maxChunkSize: number,
        bufferingEnabled: boolean,
        bodyBufferingSizeLimit: number) {
    if (!contentLength) {
        return null;
    }

    if (contentLength < BigInt(0)) {
        reader = new ChunkDecodingCustomReader(reader,
            maxChunkSize);
    }
    else {
        reader = new ContentLengthEnforcingCustomReader(reader,
            contentLength);
    }
    if (bufferingEnabled) {
        const inMemBuffer = await IOUtils.readAllBytes(
            reader, bodyBufferingSizeLimit);
        const bufferedBody = new ByteBufferBody(inMemBuffer);
        bufferedBody.ContentLength = contentLength;
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
        workPromise: Promise<T>, timeoutPromise: Promise<T>,
        cancellationPromise: Promise<T>) {
    if (!workPromise) {
        throw new Error("received null workPromise argument");
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
        const [firstTask] = await Promise.race(
            promises.map(p => p.then(() => [p])));
        if (firstTask === workPromise) {
            break;
        }
        await firstTask; // let any exceptions bubble up.
        promises = promises.filter(p => p !== firstTask);
    }
    return await workPromise;
}

export function createTimeoutPromise<T>(
        timeoutMillis: number, timeoutMsg: string) {
    if (!timeoutMillis || timeoutMillis <= 0) {
        return [null, null];
    }
    let _resolve: any, _reject: any;
    const timeoutPromise = new Promise<T>((resolve, reject) => {
        _resolve = resolve;
        _reject = reject;
    });
    const timeoutId = setTimeout(() => {
        const timeoutError = new QuasiHttpRequestProcessingError(timeoutMsg);
        timeoutError.reasonCode = QuasiHttpRequestProcessingError.ReasonCodeTimeout;
        _reject(timeoutError);
    }, timeoutMillis);
    const cancellationHandle = {
        cancel() {
            clearTimeout(timeoutId);
            _resolve();
        }
    }
    return [timeoutPromise, cancellationHandle];
}