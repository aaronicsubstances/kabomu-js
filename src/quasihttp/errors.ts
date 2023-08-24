import { KabomuError } from "../common/errors";

// the following codes are reserved for future use.
const reasonCodeReserved4 = 4;
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
     * Indicates that request processing has been explicitly cancelled by an end user.
     */
    static readonly REASON_CODE_CANCELLED = 3;
    
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
            case reasonCodeReserved4:
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


/**
 * Error thrown to indicate failure in encoding byte streams
 * according to custom chunked transfer defined in Kabomu library.
 */
export class ChunkEncodingError extends QuasiHttpRequestProcessingError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
            options)
    }
}

/**
 * Error thrown to indicate failure in decoding of byte streams expected to be
 * encoded according to custom chunked transfer defined in Kabomu library.
 */
export class ChunkDecodingError extends QuasiHttpRequestProcessingError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
            options)
    }
}
