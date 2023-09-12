import { Readable, Writable, finished } from "stream";
import { pipeline } from "stream/promises";
import { CustomIOError, ExpectationViolationError } from "./errors";
import {
    IBlankChequePromise,
    QuasiHttpProcessingOptions
} from "./types";

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
 * 
 * @param stream 
 * @param count 
 * @param abortSignal 
 */
export async function tryReadBytesFully(
        stream: Readable, count: number,
        abortSignal?: AbortSignal): Promise<Buffer> {
    // allow zero-byte reads to proceed to touch the
    // stream, rather than just return.
    abortSignal?.throwIfAborted();

    const chunks = new Array<Buffer>();
    let totalBytesRead = 0;

    const successIndicator = new AbortController();
    const options = {
        signal: successIndicator.signal
    };
    const p = createBlankChequePromise<Buffer>()
    const cleanup = finished(stream, options, (err) => {
        cleanup();
        stream.removeListener("readable", onReadable)
        if (err) {
            if (successIndicator.signal.aborted) {
                // no problem, treat as success
            }
            else {
                p.reject(err)
                return;
            }
        }
        if (totalBytesRead > count) {
            throw new ExpectationViolationError(
                "total bytes read exceeded requested number " +
                `${totalBytesRead} > ${count}`);
        }
        const result = Buffer.concat(chunks);
        p.resolve(result);
    });
    const onReadable = () => {
        abortSignal?.throwIfAborted()
        let chunk: Buffer | null;
        while ((chunk = stream.read()) !== null) {
            if (chunk === null) {
                break;
            }
            if (totalBytesRead + chunk.length < count) {
                chunks.push(chunk);
                totalBytesRead += chunk.length;
            }
            else {
                let outstanding: Buffer | undefined;
                if (totalBytesRead + chunk.length === count) {
                    chunks.push(chunk);
                    totalBytesRead = count;
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
    return await p.promise;
}

export async function readBytesFully(
        stream: Readable, count: number,
        abortSignal?: AbortSignal): Promise<Buffer> {
    const data = await tryReadBytesFully(stream,
        count, abortSignal)
    if (data.length !== count) {
        throw new CustomIOError("unexpected end of read");
    }
    return data;
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
    const options = {
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