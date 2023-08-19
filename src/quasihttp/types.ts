import { Readable, Writable } from "stream"
import { ICustomDisposable, ICustomWritable } from "../common/types"

/**
 * Structure used to encode quasi http headers for serialization and transmission on
 * quasi http transports. All properties in this structure are optional except for Version.
 *
 * This structure is equivalent to the information contained in
 * HTTP request line, HTTP status line, and HTTP request and response headers.
 */
export interface LeadChunk {

    /**
     * Serialization format version.
     */
    version: number;

    /**
     * Reserved for future use.
     */
    flags?: number

    /**
     * The equivalent of request target component of HTTP request line.
     */
    requestTarget?: string;

    /**
     * The equivalent of HTTP response status code.
     */
    statusCode?: number

    /**
     * Provides the length in bytes of a quasi http body which will
     * follow the lead chunk when serialized. Equivalent to Content-Length and 
     * Transfer-Encoding=chunked HTTP headers.
     *
     * There are three possible values:
     *    1. zero: this means that there will be no quasi http body.</item>
     *    2. positive: this means that there will be a quasi http body with the exact number of bytes
     *       present as the value of this property.</item>
     *    3. negative: this means that there will be a quasi http body, but with an unknown number of
     *       bytes. This implies chunk encoding where one or more subsequent chunks will follow the
     *       lead chunk when serialized.
     */
    contentLength?: bigint

    /**
     * The equivalent of method component of HTTP request line.
     */
    method?: string;

    /**
     * Gets or sets an HTTP request or response version value.
     */
    httpVersion?: string;

    /**
     * Gets or sets HTTP status text, ie the reason phrase component of HTTP response lines.
     */
    httpStatusMessage?: string;

    /**
     * The equivalent of HTTP request or response headers. Null keys and values are not allowed.
     *
     * Unlike in HTTP, here the headers are distinct from properties of this structure equivalent to 
     * HTTP headers, i.e. Content-Length. So setting a Content-Length header
     * here will have no bearing on how to transmit or receive quasi http bodies.
     */
    headers?: Map<string, string[]>
}

export interface ProtocolSendResultInternal {
    response?: IQuasiHttpResponse
    responseBufferingApplied?: boolean
}

export interface ISendProtocolInternal {
    cancel(): Promise<void>
    send(): Promise<ProtocolSendResultInternal>
}

export interface IReceiveProtocolInternal {
    cancel(): Promise<void>
    receive(): Promise<IQuasiHttpResponse>
}

export interface IQuasiHttpRequest extends ICustomDisposable {
    target?: string
    headers?: Map<string, string[]>
    body?: IQuasiHttpBody
    method?: string
    httpVersion?: string
    environment?: Map<string, any>
}

export interface IQuasiHttpResponse extends ICustomDisposable {
    statusCode: number
    headers?: Map<string, string[]>
    body?: IQuasiHttpBody
    httpStatusMessage?: string
    httpVersion?: string
    environment?: Map<string, any>
}

export interface IQuasiHttpBody extends ICustomDisposable, ICustomWritable {
    contentLength: bigint
    getReader(): Readable | null
}

export interface IConnectionAllocationResponse {
    connection: any
    environment?: Map<string, any>
}

export interface IQuasiHttpSendOptions {
    extraConnectivityParams?: Map<string, any>
    timeoutMillis: number
    maxChunkSize: number
    responseBufferingEnabled?: boolean
    responseBodyBufferingSizeLimit: number
    ensureNonNullResponse?: boolean 
}

export interface IQuasiHttpProcessingOptions {
    timeoutMillis: number
    maxChunkSize: number
}

export interface IQuasiHttpAltTransport {
    processSendRequest(remoteEndpoint: any, request: IQuasiHttpRequest,
        sendOptions: IQuasiHttpSendOptions): [Promise<IQuasiHttpResponse>, any]
    processSendRequest(remoteEndpoint: any,
        requestFunc: (env: Map<string, any>) => Promise<IQuasiHttpRequest>,
        sendOptions: IQuasiHttpSendOptions): [Promise<IQuasiHttpResponse>, any]
    cancelSendRequest(sendCancellationHandle: any): void
}

export interface IQuasiHttpClientTransport extends IQuasiHttpTransport  {
    allocateConnection(remoteEndpoint: any, sendOptions: IQuasiHttpSendOptions):
        Promise<IConnectionAllocationResponse>
}

export interface IQuasiHttpTransport {
    getReader(connection: any): Promise<Readable>
    getWriter(connection: any): Promise<Writable>
    releaseConnection(connection: any): Promise<void>
}

export interface IQuasiHttpServerTransport  extends IQuasiHttpTransport {
}
