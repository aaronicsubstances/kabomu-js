import { Readable, Writable } from "stream"
import { ICustomDisposable, ISelfWritable } from "../common/types"

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
     * 
     * NB: Must be valid signed 32-bit integer.
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
     * 
     * NB: Must be valid signed 48-bit integer.
     */
    contentLength?: number

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

/**
 * Represents the body of a quasi HTTP request or response.
 */
export interface IQuasiHttpBody extends ICustomDisposable, ISelfWritable {
    
    /**
     * The number of bytes that the instance will supply,
     * or -1 (actually any negative value) to indicate an unknown number of bytes.
     * 
     * NB: Falsy values will be interpreted as 0.
     */
    contentLength: number

    /**
     * Returns a readable stream for reading byte representation of the instance.
     * Can also return null indicate that direct reading is not supported.
     */
    getReader(): Readable | null
}

/**
 * Represents the equivalent of an HTTP request entity:
 * request line, request headers, and request body.
 */
export interface IQuasiHttpRequest extends ICustomDisposable {
    
    /**
     * Optional value which is equivalent of request target
     * component of HTTP request line.
     */
    target?: string

    /**
     * Optional map of string arrays keyed by strings,
     * which is the equivalent of HTTP request headers.
     * 
     * Unlike in HTTP/1.1, headers are case-sensitive and lower-cased
     * header names are recommended.
     * Also setting a Content-Length header
     * here will have no bearing on how to transmit or receive
     * the request body.
     */
    headers?: Map<string, string[]>

    /**
     * Optional request body
     */
    body?: IQuasiHttpBody

    /**
     * Optional HTTP method value.
     */
    method?: string

    /**
     * Optional HTTP request version value.
     */
    httpVersion?: string

    /**
     * Optional map of objects keyed by strings which may be of
     * interest during request processing.
     */
    environment?: Map<string, any>
}

/**
 * Represents the equivalent of an HTTP response entity:
 * response status line, response headers, and response body.
 */
export interface IQuasiHttpResponse extends ICustomDisposable {
    /**
     * Optional HTTP response status code. Falsy values will
     * be interpreted as 0.
     */
    statusCode: number

    /**
     * Optional map of string arrays keyed by strings,
     * which is the equivalent of HTTP response headers.
     * 
     * Unlike in HTTP/1.1, headers are case-sensitive and lower-cased
     * header names are recommended.
     * Also setting a Content-Length header
     * here will have no bearing on how to transmit or receive
     * the response body.
     */
    headers?: Map<string, string[]>

    /**
     * Optional response body
     */
    body?: IQuasiHttpBody

    /**
     * Optional HTTP response status text or reason phrase.
     */
    httpStatusMessage?: string

    /**
     * Optional HTTP response version value.
     */
    httpVersion?: string

    /**
     * Optional map of objects keyed by strings which may be of
     * interest during response processing.
     */
    environment?: Map<string, any>
}

/**
 * Contains connection and other connection-related information created by
 * IQuasiHttpServerTransport or IQuasiHttpClientTransport objects,
 * in response to a connection allocation or receive request.
 */
export interface ConnectionAllocationResponse {

    /**
     * Stores the connection object created by a quasi http transport.
     */
    connection: any

    /**
     * Stores any environment variables associated with a
     * connection received from a quasi http transport.
     */
    environment?: Map<string, any>
}

/**
 * Used to configure send requests to StandardQuasiHttpClient instances.
 */
export interface QuasiHttpSendOptions {

    /**
     * Represents any extra information which can help a transport to
     * locate a communication endpoint.
     */
    extraConnectivityParams?: Map<string, any>

    /**
     * Represents the wait time period in milliseconds for a send request
     * to succeed. To indicate forever wait or infinite timeout, use -1 or any
     * negative value.
     * 
     * Note that falsy values will be interpreted as unspecified, and in the absence of
     * any overriding options a client-specific default value will be used
     * (including the possibility of infinite timeout).
     */
    timeoutMillis?: number

    /**
     * Imposes a maximum size on the headers and chunks which will be generated during
     * a send request, in accordance with the chunked transfer protocol.
     * 
     * Note that falsy and negative values will be interpreted as unspecified,
     * and in the absence of any overriding options
     * a client-specific default value will be used.
     */
    maxChunkSize?: number

    /**
     * Indicates whether response buffering is enabled or not.
     *
     *  - Falsy values other than null and undefined mean that clients
     *    are responsible for closing a response if it has a body.
     *  - Truthy values mean that send request processing must ensure that
     *    responses are released before returning them to clients,
     *    by generating equivalent responses with buffered bodies.
     *  - Null and undefined values mean that it is unspecified whether
     *    response buffering is enabled or not, and in the absence of
     *    any overriding options a client-specific default action will be taken.
     *
     */
    responseBufferingEnabled?: boolean

    /**
     * Imposes a maximum size on response bodies when they are being buffered,
     * i.e. in situations where response buffering is enabled.
     * 
     * Note that falsy and negative values will be interpreted as unspecified, and in the absence of any overriding options
     * a client-specific default value will be used.
     */
    responseBodyBufferingSizeLimit?: number

    /**
     * Indicates whether null responses received from sending requests
     * should result in an error, or should simply be returned as is.
     */
    ensureNonNullResponse?: boolean 
}

/**
 * Used to configure request processing by StandardQuasiHttpServer instances.
 */
export interface QuasiHttpProcessingOptions {

    /**
     * Represents the wait time period in milliseconds for the processing of a request
     * to succeed. To indicate forever wait or infinite timeout, use -1 or any
     * negative value.
     * 
     * Note that falsy values will be interpreted as unspecified, and in the absence of
     * any overriding options a client-specific default value will be used
     * (including the possibility of infinite timeout).
     */
    timeoutMillis?: number

    /**
     * Imposes a maximum size on the headers and chunks which will be generated during
     * the processing of a request, in accordance with the chunked transfer protocol.
     * 
     * Note that falsy and negative values will be interpreted as unspecified,
     * and in the absence of any overriding options
     * a client-specific default value will be used.
     */
    maxChunkSize?: number
}

/**
 * Represents result of sending quasi http requests with
 * StandardQuasiHttpClient instances and
 * IQuasiHttpAltTransport objects.
 */
export interface QuasiHttpSendResponse {
    responsePromise: Promise<IQuasiHttpResponse>
    cancellationHandle?: any
}

/**
 * Alternative interface to IQuasiHttpTransport which provides another way for
 * StandardQuasiHttpClient instances to send quasi http requests
 * to servers or remote endpoints.
 *
 * The goal of this interface is to provide an alternative for situations in which
 * IQuasiHttpTransport is unsuitable for sending quasi http requests. For example,
 *
 *  - Memory-based transports can reduce some of the performance hit
 *    of serialization by sending requests directly to their communication endpoints,
 *    without need for allocating and releasing connections.
 *
 *  - Actual HTTP-based transports already have a way to send requests thanks to
 *    the myriad of HTTP client libraries out there, and so it will be
 *    unnecessary or impractical to re-invent the wheel and allocate and releasee
 *    TCP connections.
 *
 */
export interface IQuasiHttpAltTransport {

    /**
     * Makes a direct send request on behalf of an instance of
     * StandardQuasiHttpClient.
     *
     * Implementations which want to support cancellation of
     * send requests can supply a cancellation
     * handle in the return value; otherwise they should
     * return null cancellation handle.
     * @param remoteEndpoint the destination endpoint of the request
     * @param request the quasi http request to send
     * @param sendOptions communication endpoint information. When used with a
     * StandardQuasiHttpClient instance, this will be the result of merging
     * the default send options of the instance with the particular send options
     * specified in the send() method, ie the instance method which
     * initiated the send processing request.
     * @returns an object containing a promise whose result will be the quasi http response
     * processed by the tranport instance.
     */
    processSendRequest(remoteEndpoint: any, request: IQuasiHttpRequest,
        sendOptions: QuasiHttpSendOptions): QuasiHttpSendResponse

    /**
     * Makes a direct send request on behalf of an instance of
     * StandardQuasiHttpClient.
     *
     * Implementations which want to support cancellation of
     * send requests can supply a cancellation
     * handle in the return value; otherwise they should
     * return null cancellation handle.
     * @param remoteEndpoint the destination endpoint of the request
     * @param requestFunc a callback which receives any environment
     * associated with how the request is to be created, and returns a promise of
     * the request to send
     * @param sendOptions communication endpoint information. When used with a
     * StandardQuasiHttpClient instance, this will be the result of merging
     * the default send options of the instance with the particular send options
     * specified in the send() method, ie the instance method which
     * initiated the send processing request.
     * @returns an object containing a promise whose result will be the quasi http response
     * processed by the tranport instance.
     */
    processSendRequest(remoteEndpoint: any,
        requestFunc: (env: Map<string, any>) => Promise<IQuasiHttpRequest>,
        sendOptions: QuasiHttpSendOptions): QuasiHttpSendResponse
    
    /**
     * Attempts to cancel an ongoing send request.
     * @param sendCancellationHandle the cancellation handle that was 
     * returned by processSendRequest() for the task to be cancelled.
     */
    cancelSendRequest(sendCancellationHandle: any): void
}

/**
 * Equivalent of TCP client socket factory that provides 
 * instances of StandardQuasiHttpClient instances
 * with client connections for sending quasi http requests to servers or remote endpoints.
 */
export interface IQuasiHttpClientTransport extends IQuasiHttpTransport  {
    
    /**
     * Creates a connection to a remote endpoint.
     * @param remoteEndpoint the target endpoint of the connection
     * allocation request
     * @param sendOptions communication endpoint information. When used with a
     * StandardQuasiHttpClient instance, this will be the result of merging
     * the default send options of the instance with the particular send options specified in the
     * send() method, ie the instance method which initiated the connection allocation request.
     * @returns a promise whose result will contain a connection ready for use as a duplex
     * stream of data for reading and writing
     */
    allocateConnection(remoteEndpoint: any, sendOptions: QuasiHttpSendOptions):
        Promise<ConnectionAllocationResponse>
}

/**
 * Represents connection manager for TCP and any network protocol 
 * or IPC mechanism which is connection-oriented like TCP, 
 * where duplex streams of data are provided in the form of connections for
 * reading and writing simulataneously.
 *
 * The expectations for implementations are that:
 *
 *  1. an implementation does not bother to protect 
 *     writes, reads and connection releases from thread interference.
 *  2. an implementation does not bother to support concurrent
 *     multiple writes or concurrent multiple reads.
 *  3. concurrent calls to connection releases must be tolerated,
 *     which could possibly be concurrent with ongoing reads and writes.
 *
 */
export interface IQuasiHttpTransport {

    /**
     * Gets a writable stream which can be used to write data to a connection of
     * a quasi http transport instance.
     * @param connection the connection associated with the writer
     * @returns a stream which can be used to write bytes to the connection argument
     */
    getReader(connection: any): Readable

    /**
     * Gets a reader which can be used to read data from a connection of
     * a quasi http transport instance.
     * @param connection the connection associated with the reader
     * @returns a stream which can be used to read bytes from the connection argument
     */
    getWriter(connection: any): Writable

    /**
     * Releases resources held by a connection of a quasi http transport instance.
     * @param connection the connection to release
     */
    releaseConnection(connection: any): Promise<void>
}

/**
 * Equivalent of factory of sockets accepted from a TCP server socket,
 * that provides instances of StandardQuasiHttpServer class
 * with server operations, for sending quasi http requests to servers
 * or remote endpoints.
 */
export interface IQuasiHttpServerTransport  extends IQuasiHttpTransport {
}

/**
 * Represents a quasi http request processing function used by 
 * instances of StandardQuasiHttpServer class
 * to generate quasi http responses.
 */
export interface IQuasiHttpApplication {

    /**
     * Processes a quasi htp request.
     * @param request the quasi http request
     * @returns a promise whose result will be the response to the 
     * quasi http request
     */
    processRequest(request: IQuasiHttpRequest):
        Promise<IQuasiHttpResponse>
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

export interface ICancellablePromiseInternal<T> {
    promise: Promise<T> | null
    isCancellationRequested(): boolean
    cancel(): void
}