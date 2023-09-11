/**
 * Base exception class for errors encountered in the library.
 */
export class KabomuError extends Error {
    get name() {
        return this.constructor.name
    }
}

/**
 * Represents errors usable by implementations of streams,
 * as well as errors encountered by IOUtils module.
 */
export class CustomIOError extends KabomuError {
    static createContentLengthNotSatisfiedError(contentLength: number,
            remainingBytesToRead: number) {
        return new CustomIOError(`insufficient bytes available to satisfy ` +
            `content length of ${contentLength} bytes (could not read remaining ` +
            `${remainingBytesToRead} bytes before end of read)`)
    }
}

/**
 * Error thrown to indicate that the caller of a method or function didn't find the output or outcome
 * satisfactory. E.g. the return value from a function is invalid; the function took too long to complete.
 */
export class ExpectationViolationError extends KabomuError { }

/**
 * Error that is thrown by clients to indicate that a required dependency
 * (e.g. a property of the client) has not been set up properly for use
 * (e.g. the property is null).
 */
export class MissingDependencyError extends KabomuError { }

// the following codes are reserved for future use.
const reasonCodeReserved5 = 5;
const reasonCodeReserved6 = 6;
const reasonCodeReserved7 = 7;
const reasonCodeReserved8 = 8;
const reasonCodeReserved9 = 9;
const reasonCodeReserved0 = 0;

export class QuasiHttpRequestProcessingError extends KabomuError {

    /**
     * Indicates general error without much detail to offer aside inspecting 
     * error messages and inner exceptions.
     */
    static readonly REASON_CODE_GENERAL = 1;

    /**
     * Indicates a timeout in processing.
     */
    static readonly REASON_CODE_TIMEOUT = 2;

    /**
     * Indicates a problem with encoding/decoding headers.
     */
    static readonly REASON_CODE_PROTOCOL_VIOLATION = 3;

    /**
     * Indicates a problem with exceeding header or body size limits.
     */
    static readonly REASON_CODE_MESSAGE_LENGTH_LIMIT_EXCEEDED = 4;
    
    reasonCode?: number;

    /**
     * Creates a new instance with an error message,
     * a reason code and error options.
     * @param message the error message
     * @param reasonCode reason code to use
     * @param options optional error options containing
     * cause of this exception and others
     */
    constructor(message: string, reasonCode?: number,
            options?: ErrorOptions) {
        super(message, options)
        switch (reasonCode) {
            case reasonCodeReserved5:
            case reasonCodeReserved6:
            case reasonCodeReserved7:
            case reasonCodeReserved8:
            case reasonCodeReserved9:
            case reasonCodeReserved0:
                throw new Error("cannot use reserved reason code: " + reasonCode);
            default:
                break;
        }
        this.reasonCode = reasonCode ??
            QuasiHttpRequestProcessingError.REASON_CODE_GENERAL;
    }
}
