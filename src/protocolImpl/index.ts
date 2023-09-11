import { Readable } from "stream";
import { IQuasiHttpRequest, IQuasiHttpResponse } from "../types";
import { CustomIOError } from "../errors";
import * as MiscUtils from "../MiscUtils";

export * as QuasiHttpCodec from "./QuasiHttpCodec"

/**
 * Provides convenient implementation of IQuasiHttpRequest interface,
 * such that the release() method is implemented to be forwarded
 * to whatever non-null body that is found.
 */
export class DefaultQuasiHttpRequest implements IQuasiHttpRequest {
    target?: string;
    headers?: Map<string, string[]>;
    contentLength?: number;
    body?: Readable;
    httpMethod?: string;
    httpVersion?: string;
    environment?: Map<string, any>;

    /**
     * Creates a new instance optionally initialized
     * by an IQuasiHttpRequest object.
     * @param options optional object from which all non-function
     * properties will be used to initialize new instance.
     */
    constructor(options?: Omit<IQuasiHttpRequest, "release">) {
        this.target = options?.target;
        this.headers = options?.headers;
        this.contentLength = options?.contentLength;
        this.body = options?.body;
        this.httpMethod = options?.httpMethod;
        this.httpVersion = options?.httpVersion;
        this.environment = options?.environment;
    }

    /**
     * Calls destroy() method of the body property of the
     * instance. Nothing is done if body is null.
     */
    async release(): Promise<void> {
        await this.body?.destroy();
    }
}

/**
 * Provides convenient implementation of IQuasiHttpResponse interface,
 * such that the release() method is implemented to be forwarded
 * to whatever non-null body that is found.
 */
export class DefaultQuasiHttpResponse implements IQuasiHttpResponse {
    statusCode = 0;
    headers?: Map<string, string[]>;
    contentLength?: number;
    body?: Readable;
    httpStatusMessage?: string;
    httpVersion?: string;
    environment?: Map<string, any>;

    /**
     * Creates a new instance optionally initialized
     * by an IQuasiHttpResponse object.
     * @param options optional object from which all non-function
     * properties will be used to initialize new instance.
     */
    constructor(options?: Omit<IQuasiHttpResponse, "release">) {
        this.statusCode = options?.statusCode || 0;
        this.headers = options?.headers;
        this.contentLength = options?.contentLength;
        this.body = options?.body;
        this.httpStatusMessage = options?.httpStatusMessage;
        this.httpVersion = options?.httpVersion;
        this.environment = options?.environment;
    }

    /**
     * Calls destroy() method of the body property of the
     * instance. Nothing is done if body is null.
     */
    async release(): Promise<void> {
        await this.body?.destroy();
    }
}

const generateContentChunksForEnforcingContentLength = 
    async function*(backingStream: any, contentLength: number) {
        let bytesLeft = contentLength
        for await (const chunk of backingStream) {
            if (contentLength < 0) {
                yield chunk
            }
            else if (chunk.length < bytesLeft) {
                yield chunk
                bytesLeft -= chunk.length
            }
            else {
                if (chunk.length > bytesLeft) {
                    yield chunk.subarray(0, bytesLeft)
                }
                else {
                    yield chunk
                }
                bytesLeft = 0
                break
            }
        }
        if (contentLength > 0 && bytesLeft < 0) {
            throw CustomIOError.createContentLengthNotSatisfiedError(
                contentLength, bytesLeft)
        }
    }

/**
 * Wraps another readable stream to ensure a given amount of bytes are read.
 * @param backingStream the source stream.
 * @param expectedLength the expected number of bytes to guarantee or assert.
 * Can be negative to indicate that the all remaining bytes in the backing reader
 * should be returned
 * @returns a stream decorating the reader argument
 */
export function createContentLengthEnforcingStream(
    backingStream: any, expectedLength: number) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    return Readable.from(generateContentChunksForEnforcingContentLength(backingStream,
        MiscUtils.parseInt48(expectedLength)));
}