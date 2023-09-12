import { PipelineOptions, Readable, Writable, finished } from "stream";
import { pipeline } from "stream/promises";
import { KabomuIOError, ExpectationViolationError } from "./errors";
import {
    IBlankChequePromise,
    QuasiHttpProcessingOptions
} from "./types";

/**
 * The limit of data buffering when reading byte streams into memory. Equal to 128 MB.
 */
export const DEFAULT_DATA_BUFFER_LIMIT = 134_217_728;

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DEFAULT_READ_BUFFER_SIZE = 8192;

export function createBlankChequePromise<T>() {
    const blankCheque = {
    } as IBlankChequePromise<T>
    blankCheque.promise = new Promise<T>((resolve, reject) => {
        blankCheque.resolve = resolve
        blankCheque.reject = reject
    })
    return blankCheque;
}

/**
 * Reads bytes from a stream as much as possible, until
 * either desired number of bytes are obtained, stream
 * is exhausted, or an error is encountered.
 * @param stream source readable byte stream
 * @param count maximum number of bytes to read
 * @param abortSignal 
 */
export async function tryReadBytesFully(
        stream: Readable, count: number,
        abortSignal?: AbortSignal): Promise<Buffer> {
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return.
    abortSignal?.throwIfAborted();

    const successIndicator = new AbortController();
    const chunks = new Array<Buffer>();
    let totalBytesRead = 0;
    const onReadable = () => {
        abortSignal?.throwIfAborted()
        let chunk: Buffer | null;
        while ((chunk = stream.read()) !== null) {
            if (totalBytesRead + chunk.length < count) {
                chunks.push(chunk);
                totalBytesRead += chunk.length;
            }
            else {
                let outstanding: Buffer | undefined;
                if (totalBytesRead + chunk.length === count) {
                    chunks.push(chunk);
                    totalBytesRead += chunk.length;
                }
                else {
                    const bytesLeft = count - totalBytesRead;
                    totalBytesRead += bytesLeft;
                    chunks.push(chunk.subarray(0, bytesLeft));
                    outstanding = chunk.subarray(bytesLeft);
                }
                // Remove the 'readable' listener before unshifting.
                stream.removeListener("readable", onReadable)
                if (outstanding) {
                    stream.unshift(outstanding);
                }
                successIndicator.abort();
                break;
            }
        }
    }
    stream.on("readable", onReadable);
    
    const options = {
        readable: false,
        signal: successIndicator.signal
    };
    const blankCheque = createBlankChequePromise<Buffer>()
    const cleanup = finished(stream, options, (err) => {
        cleanup();
        stream.removeListener("readable", onReadable)
        if (err) {
            if (successIndicator.signal.aborted) {
                // no problem, treat as success
            }
            else {
                blankCheque.reject(err)
                return;
            }
        }
        if (totalBytesRead > count) {
            blankCheque.reject(new ExpectationViolationError(
                "total bytes read exceeded requested number " +
                `${totalBytesRead} > ${count}`));
        }
        else {
            const result = Buffer.concat(chunks);
            blankCheque.resolve(result);
        }
    });
    return await blankCheque.promise;
}

export async function readBytesFully(
        stream: Readable, count: number,
        abortSignal?: AbortSignal): Promise<Buffer> {
    const data = await tryReadBytesFully(stream,
        count, abortSignal)
    if (data.length !== count) {
        throw KabomuIOError.createEndOfReadError();
    }
    return data;
}

export async function readAllBytesUpToGivenLimit(
        stream: Readable,
        bufferingLimit: number, abortSignal?: AbortSignal) {
    if (!bufferingLimit || bufferingLimit < 0) {
        bufferingLimit = DEFAULT_DATA_BUFFER_LIMIT;
    }
    const allBytes = await tryReadBytesFully(
        stream, bufferingLimit, abortSignal)
    if (allBytes.length === bufferingLimit) {
        // force a read of 1 byte
        const extra = await tryReadBytesFully(stream, 1,
            abortSignal);
        if (extra.length) {
            return undefined
        }
    }
    return allBytes;
}

export async function readAllBytes(stream: Readable,
        abortSignal?: AbortSignal) {
    const chunks = new Array<Buffer>()
    const writer = new Writable({
        write(chunk, encoding, callback) {
            chunks.push(chunk)
            callback()
        }
    })
    await copyBytes(stream, writer, abortSignal);
    return Buffer.concat(chunks)
}

export async function copyBytes(
        inputStream: Readable,
        outputStream: Writable,
        abortSignal?: AbortSignal) {
    const options: PipelineOptions = {
        signal: abortSignal,
        end: false
    }
    await pipeline(inputStream, outputStream, options);
}

/**
 * Parses a string (or verifies a number)
 * as a valid 48-bit signed integer
 * (else an error occurs).
 * @param input the string to parse which Can be surrounded by
 * whitespace (or number to verify) 
 * @returns verified 48-bit integer
 */
export function parseInt48(input: any) {
    if (!["string", "number", "bigint"].includes(typeof input) ||
            (typeof input === "string" && /^\s*$/.test(input))) {
        throw new Error("invalid 48-bit integer: " + input)
    }
    const n = Number(input)
    if (Number.isNaN(n) || !Number.isInteger(n) ||
            n < -140_737_488_355_328 || n > 140_737_488_355_327) {
        throw new Error("invalid 48-bit integer: " + input)
    }
    return n
}

/**
 * Parses a string (or verifies a number)
 * as a valid 48-bit signed integer
 * (else an error occurs).
 * @param input the string to parse (or number to verify) 
 * @returns verified 48-bit integer
 */
export function parseInt32(input: any) {
    let n = 0;
    try {
        n = parseInt48(input);
    }
    catch {
        throw new Error("invalid 32-bit integer: " + input);
    }
    if (n < -2_147_483_648 || n > 2_147_483_647) {
        throw new Error("invalid 32-bit integer: " + input);
    }
    return n;
}

export function bytesToString(data: Buffer) {
    return data.toString();
}

export function stringToBytes(str: string) {
    return Buffer.from(str);
}

export function _getByteCount(str: string) {
    return Buffer.byteLength(str, "utf-8")
}

export function mergeProcessingOptions(
        preferred: QuasiHttpProcessingOptions | undefined,
        fallback: QuasiHttpProcessingOptions | undefined) {
    if (!preferred || !fallback) {
        return preferred || fallback
    }
    const mergedOptions: QuasiHttpProcessingOptions = {}
    mergedOptions.timeoutMillis =
        _determineEffectiveNonZeroIntegerOption(
            preferred?.timeoutMillis,
            fallback?.timeoutMillis,
            0);

    mergedOptions.extraConnectivityParams =
        _determineEffectiveOptions(
            preferred?.extraConnectivityParams,
            fallback?.extraConnectivityParams);

    mergedOptions.responseBufferingEnabled =
        _determineEffectiveBooleanOption(
            preferred?.responseBufferingEnabled,
            fallback?.responseBufferingEnabled,
            true);

    mergedOptions.maxHeadersSize =
        _determineEffectivePositiveIntegerOption(
            preferred?.maxHeadersSize,
            fallback?.maxHeadersSize,
            0);

    mergedOptions.responseBodyBufferingSizeLimit =
        _determineEffectivePositiveIntegerOption(
            preferred?.responseBodyBufferingSizeLimit,
            fallback?.responseBodyBufferingSizeLimit,
            0);

    return mergedOptions;
}

export function _determineEffectiveNonZeroIntegerOption(
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

export function _determineEffectivePositiveIntegerOption(
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

export function _determineEffectiveOptions(
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

export function _determineEffectiveBooleanOption(
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

export async function completeMainPromise<T>(
        mainPromise: Promise<T>,
        ...cancellationPromises: Array<Promise<any> | undefined>) {
    if (!mainPromise) {
        throw new Error("mainPromise argument is null");
    }

    // ignore null promises and successful results from
    // promises other than work promise.
    let promises = new Array<any>()
    for (var p of cancellationPromises) {
        if (p) {
            promises.push(p)
        }
    }
    promises.push(mainPromise)
    while (promises.length > 1) {
        const firstPromise = promises[await whenAnyPromiseSettles(
            promises)]
        if (firstPromise === mainPromise) {
            break;
        }
        await firstPromise; // let any exceptions bubble up.
        promises = promises.filter(p => p !== firstPromise);
    }
    return await mainPromise;
}

export async function whenAnyPromiseSettles(q: any[]) {
    return await new Promise<number>((resolve) => {
        for (let i = 0; i < q.length; i++) {
            const p = q[i]
            p.finally(() => resolve(i))
        }
    })
}