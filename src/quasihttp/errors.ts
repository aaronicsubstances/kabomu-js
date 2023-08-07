import { KabomuError } from "../common/errors";

/**
 * Error thrown to indicate failure in decoding of byte streams expected to be
 * encoded according to custom chunked transfer defined in Kabomu library.
 */
export class ChunkDecodingError extends KabomuError { }
