import { KabomuError } from "../common/errors";

/**
 * Error thrown to indicate failure in decoding of byte streams expected to be
 * encoded according to custom chunked transfer defined in Kabomu library.
 */
export class ChunkDecodingError extends KabomuError { }

export class QuasiHttpRequestProcessingError extends KabomuError {

    /**
     * Indicates general error without much detail to offer aside inspecting 
     * error messages and inner exceptions.
     */
    static readonly ReasonCodeGeneral = 1;

    /**
     * Indicates a timeout in processing.
     */
    static readonly ReasonCodeTimeout = 2;

    /**
     * Indicates that request processing has been explicitly cancelled by an end user.
     */
    static readonly ReasonCodeCancelled = 3;
    
    reasonCode = QuasiHttpRequestProcessingError.ReasonCodeGeneral;
}