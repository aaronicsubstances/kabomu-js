import { Readable } from "stream"

/**
 * Common interface of instances in Kabomu library which perform
 * resource clean-up operations.
 */
export interface ICustomDisposable {

    /**
     * Performs any needed clean up operation on resources held
     * by the instance.
     */
    release(): Promise<void>
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
        Promise<IQuasiHttpResponse | undefined>
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

    contentLength?: number

    /**
     * Optional request body
     */
    body?: Readable

    /**
     * Optional HTTP method value.
     */
    httpMethod?: string

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
    statusCode?: number

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

    contentLength?: number

    /**
     * Optional response body
     */
    body?: Readable

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
export interface QuasiHttpConnection {

    abortSignal?: AbortSignal
    processingOptions?: QuasiHttpProcessingOptions

    /**
     * Stores any environment variables associated with a
     * connection received from a quasi http transport.
     */
    environment?: Map<string, any>
}

/**
 * Used to configure parameters which affect processing quasi http requests
 * and responses.
 */
export interface QuasiHttpProcessingOptions {

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
     * Imposes a maximum size on the headers of requests and
     * responses which will be encountered during sending out requests and
     * receipt of responses.
     * 
     * Note that falsy and negative values will be interpreted as unspecified,
     * and in the absence of any overriding options
     * a client-specific default value will be used.
     */
    maxHeadersSize?: number

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
     * @param sendOptions any options given to one of the send*() methods of
     * the StandardQuasiHttpClient class
     * @returns a promise whose result is ready for use as a duplex
     * stream of data for reading and writing
     */
    allocateConnection(remoteEndpoint: any, sendOptions?: QuasiHttpProcessingOptions ):
        Promise<QuasiHttpConnection | undefined>

    /**
     * Releases resources held by a connection of a quasi http transport instance.
     * @param connection the connection to release
     * @param responseStreamingEnabled whether response body
     * still needs the connection to some extent
     */
    releaseConnection(connection: QuasiHttpConnection,
        responseStreamingEnabled: boolean): Promise<void>
}

/**
 * Represents commonality of functions provided by TCP or IPC mechanisms
 * at both server and client ends.
 */
export interface IQuasiHttpTransport {

    /**
     * Transfers an entire http entity to a quasi web transport
     * @param connection connection to use for transfer
     * @param isResponse indicates whether http entity is for
     * response (with truthy value), or indicates request (with falsy value)
     * @param encodedHeaders http request or response headers to transfer
     * @param body http request or response body to transfer
     * @returns a stream which can be used to read bytes from the connection argument
     */
    write(connection: QuasiHttpConnection, isResponse: boolean,
        encodedHeaders: Buffer, body?: Readable): Promise<void>

    /**
     * Retrieves an entire http entity from a quasi web transport.
     * @param connection connection to use for retrieval
     * @param isResponse indicates whether http entity is for
     * response (with truthy value), or indicates request (with falsy value)
     * @param encodedHeaderReceiver list which will be populated with
     * byte chunks representing request or response headers
     * @returns a promise whose result will be an http request or response body.
     */    
    read(connection: QuasiHttpConnection, isResponse: boolean,
        encodedHeaderReceiver: Array<Buffer>): Promise<Readable | undefined>
}

/**
 * Equivalent of factory of sockets accepted from a TCP server socket,
 * that provides instances of StandardQuasiHttpServer class
 * with server operations, for sending quasi http requests to servers at
 * remote endpoints.
 */
export interface IQuasiHttpServerTransport  extends IQuasiHttpTransport {

    /**
     * Releases resources held by a connection of a quasi http transport instance.
     * @param connection the connection to release
     */
    releaseConnection(connection: QuasiHttpConnection): Promise<void>
}

export interface IBlankChequePromise<T> {
    promise: Promise<T>
    resolve: (r: T) => void
    reject: (r: Error) => void
}

/*export interface ICancellableTimeoutPromiseInternal {
    promise: Promise<void>
    isCancellationRequested(): boolean
    cancel(): void
}*/