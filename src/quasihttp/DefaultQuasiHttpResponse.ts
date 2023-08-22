import { IQuasiHttpBody, IQuasiHttpResponse } from "./types";

/**
 * Provides convenient implementation of IQuasiHttpResponse interface,
 * such that the release() method is implemented to be forwarded
 * to whatever non-null body that is found.
 */
export class DefaultQuasiHttpResponse implements IQuasiHttpResponse {
    statusCode = 0;
    headers?: Map<string, string[]>;
    body?: IQuasiHttpBody | null;
    httpStatusMessage?: string;
    httpVersion?: string;
    environment?: Map<string, any>;

    /**
     * Creates a new instance optionally initialized
     * by an IQuasiHttpResponse object.
     * @param options optional object from which the following
     * properties will be used to initialize new instance:
     * statusCode, headers, body, httpStatusMessage, httpVersion and
     * environment.
     */
    constructor(options?: Omit<IQuasiHttpResponse, "release">) {
        this.statusCode = options?.statusCode || 0;
        this.headers = options?.headers;
        this.body = options?.body;
        this.httpStatusMessage = options?.httpStatusMessage;
        this.httpVersion = options?.httpVersion;
        this.environment = options?.environment;
    }

    /**
     * Calls release() method of the body property of the
     * instance. Nothing is done if body is null.
     */
    async release(): Promise<void> {
        await this.body?.release();
    }
}
