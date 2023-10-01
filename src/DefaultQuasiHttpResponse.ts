import { Readable } from "stream";
import { IQuasiHttpResponse } from "./types";

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
        this.body?.destroy();
    }
}
