import {
    createBlankChequePromise,
    parseInt32
} from "./MiscUtilsInternal";
import {
    ICancellableTimeoutPromise,
    QuasiHttpProcessingOptions
} from "./types";

export {
    parseInt32,
    parseInt48,
    createBlankChequePromise
} from "./MiscUtilsInternal";

/**
 *  Request environment variable for local server endpoint.
 */
export const ENV_KEY_LOCAL_PEER_ENDPOINT = "kabomu.local_peer_endpoint";

/**
 *  Request environment variable for remote client endpoint.
 */
export const ENV_KEY_REMOTE_PEER_ENDPOINT = "kabomu.remote_peer_endpoint";

/**
 * Request environment variable for the transport instance from
 * which a request was received.
 */
export const ENV_KEY_TRANSPORT_INSTANCE = "kabomu.transport";

/**
 * Request environment variable for the connection from which a
 * request was received.
 */
export const ENV_KEY_CONNECTION = "kabomu.connection";

export const METHOD_CONNECT = "CONNECT";
export const METHOD_DELETE = "DELETE";
export const METHOD_GET = "GET";
export const METHOD_HEAD = "HEAD";
export const METHOD_OPTIONS = "OPTIONS";
export const METHOD_PATCH = "PATCH";
export const METHOD_POST = "POST";
export const METHOD_PUT = "PUT";
export const METHOD_TRACE = "TRACE";

/**
 * 200 OK
 */
export const STATUS_CODE_OK = 200;

/**
 * 400 Bad Request
 */
export const STATUS_CODE_CLIENT_ERROR_BAD_REQUEST = 400;

/**
 * 401 Unauthorized
 */
export const STATUS_CODE_CLIENT_ERROR_UNAUTHORIZED = 401;

/**
 * 403 Forbidden
 */
export const STATUS_CODE_CLIENT_ERROR_FORBIDDEN = 403;

/**
 * 404 Not Found
 */
export const STATUS_CODE_CLIENT_ERROR_NOT_FOUND = 404;

/**
 * 405 Method Not Allowed
 */
export const STATUS_CODE_CLIENT_ERROR_METHOD_NOT_ALLOWED = 405;

/**
 * 413 Payload Too Large
 */
export const STATUS_CODE_CLIENT_ERROR_PAYLOAD_TOO_LARGE = 413;

/**
 * 414 URI Too Long
 */
export const STATUS_CODE_CLIENT_ERROR_URI_TOO_LONG = 414;

/**
 * 415 Unsupported Media Type
 */
export const STATUS_CODE_CLIENT_ERROR_UNSUPPORTED_MEDIA_TYPE = 415;

/**
 * 422 Unprocessable Entity
 */
export const STATUS_CODE_CLIENT_ERROR_UNPROCESSABLE_ENTITY = 422;

/**
 * 429 Too Many Requests
 */
export const STATUS_CODE_CLIENT_ERROR_TOO_MANY_REQUESTS = 429;

/**
 * 500 Internal Server Error
 */
export const STATUS_CODE_SERVER_ERROR = 500;

/**
 * The default value of maximum size of headers in a request or response.
 */
export const DEFAULT_MAX_HEADERS_SIZE = 8_192;

/**
 * Merges two sources of processing options together, unless one of 
 * them is null, in which case it returns the non-null one.
 * @param preferred options object whose valid property values will
 * make it to merged result
 * @param fallback options object whose valid property
 * values will make it to merged result, if corresponding property
 * on preferred argument are invalid.
 * @returns merged options
 */
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

    mergedOptions.maxHeadersSize =
        _determineEffectivePositiveIntegerOption(
            preferred?.maxHeadersSize,
            fallback?.maxHeadersSize,
            0);

    mergedOptions.maxResponseBodySize  =
        _determineEffectiveNonZeroIntegerOption(
            preferred?.maxResponseBodySize ,
            fallback?.maxResponseBodySize ,
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

/**
 * Creates an object representing both a pending timeout and the
 * function to cancel the timeout.
 * 
 * Note that if the timeout occurs, the pending promise to be returned will
 * resolve with a result of true. If the timeout is cancelled,
 * the promise will still resolve but with false result.
 * @param timeoutMillis timeout value in milliseconds. must
 * be positive for non-null object to be returned.
 * @returns object that can be used to wait for pending timeout
 * or cancel the pending timeout.
 */
export function createCancellableTimeoutPromise(
        timeoutMillis: number) {
    if (!timeoutMillis || timeoutMillis <= 0) {
        return undefined
    }
    const blankChequePromise = createBlankChequePromise<boolean>()
    const timeoutId = setTimeout(() => {
        blankChequePromise.resolve(true);
    }, timeoutMillis);
    const cancellationHandle: ICancellableTimeoutPromise = {
        promise: blankChequePromise.promise,
        cancel() {
            clearTimeout(timeoutId);
            blankChequePromise.resolve(false);
        }
    }
    return cancellationHandle
}

export async function createDelayPromise(delayMs: number) {
    await new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}

export async function createYieldPromise() {
    await new Promise((resolve) => {
        setImmediate(resolve)
    })
}

export function isValidHttpHeaderSection(
        csv: Array<string[]>) {
    if (!csv) {
        throw new Error("csv argument is null");
    }
    if (!csv.length) {
        return false;
    }
    const specialHeader = csv[0]
    if (!specialHeader?.length) {
        return false;
    }
    for (const item of specialHeader) {
        // allow empty strings in special header.
        if (typeof item === "undefined" || item === null) {
            return false;
        }
        if (!_containsOnlyPrintableAsciiChars(item,
                false, false)) {
            return false;
        }
    }
    for (let i = 1; i < csv.length; i++) {
        const row = csv[i]
        if (!row || row.length < 2) {
            return false;
        }
        const headerName = row[0];
        if (!headerName) {
            return false;
        }
        if (!_containsOnlyPrintableAsciiChars(headerName,
                true, false)) {
            return false;
        }
        for (let j = 1; j < row.length; j++) {
            const headerValue = row[j];
            if (!headerValue) {
                return false;
            }
            if (!_containsOnlyPrintableAsciiChars(headerValue,
                    false, true)) {
                return false;
            }
        }
    }
    return true;
}

export function _containsOnlyPrintableAsciiChars(v: string,
        safeOnly: boolean, allowSpace: boolean) {
    for (let i = 0; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if (safeOnly) {
            if (c >= 48 && c < 58) {
                // digits.
            }
            else if (c >= 65 && c < 91) {
                // upper case
            }
            else if (c >= 97 && c < 123) {
                // lower case
            }
            else if (c === 45) {
                // hyphen
            }
            else {
                return false;
            }
        }
        else {
            if (c < 32 || c > 126) {
                return false;
            }
            if (!allowSpace && c === 32) {
                return false;
            }
        }
    }
    return true;
}
