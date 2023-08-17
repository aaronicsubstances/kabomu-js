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
    static createContentLengthNotSatisfiedError(contentLength: bigint,
            remainingBytesToRead: bigint) {
        return new CustomIOError(`insufficient bytes available to satisfy ` +
            `content length of ${contentLength} bytes (could not read remaining ` +
            `${remainingBytesToRead} bytes before end of read)`)
    }
    
    static createDataBufferLimitExceededError(bufferSizeLimit: number) {
        return new CustomIOError(`data buffer size limit of ${bufferSizeLimit} bytes exceeded`)
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
