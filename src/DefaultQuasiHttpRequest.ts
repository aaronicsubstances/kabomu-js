import { Readable } from "stream";
import { IQuasiHttpRequest } from "./types";

/**
 * Provides convenient implementation of IQuasiHttpRequest interface,
 * such that the release() method is implemented to be forwarded
 * to whatever non-null body that is found.
 */
export class DefaultQuasiHttpRequest implements IQuasiHttpRequest {
    target?: string;
    headers?: Map<string, string[]>;
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
        this.body?.destroy();
    }
}
