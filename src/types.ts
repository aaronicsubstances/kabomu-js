import { Readable, Writable } from "stream"

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
 * Represents additional interface that transport property of 
 * StandardQuasiHttpClient and StandardQuasiHttpServer classes can
 * implement, in order to override parts of
 * IQuasiHttpTransport functionality.
 */
export interface IQuasiHttpAltTransport {

    /**
     * Gets a function which can return true to
     * prevent the need to write request headers
     * and body to a connection.
     */
    requestSerializer?: (conn: QuasiHttpConnection, req: IQuasiHttpRequest) => Promise<boolean>
    
    /**
     * Gets a function which can return true to prevent the
     * need to write response headers and body to a connection.
     */
    responseSerializer?: (conn: QuasiHttpConnection, res: IQuasiHttpResponse) => Promise<boolean>
    
    /**
     * Gets a function which can return a non-null request object to
     * prevent the need to read request headers from a connection.
     */
    requestDeserializer?: (conn: QuasiHttpConnection) => Promise<IQuasiHttpRequest | undefined>
    
    /**
     * Gets a function which can return a non-null response object
     * to prevent the need to read response headers from  a
     * connection.
     */
    responseDeserializer?: (conn: QuasiHttpConnection) => Promise<IQuasiHttpResponse | undefined>
}

/**
 * Equivalent of TCP client socket factory that provides 
 * instances of StandardQuasiHttpClient class
 * with client connections for sending quasi http requests to servers or remote endpoints.
 */
export interface IQuasiHttpClientTransport extends IQuasiHttpTransport  {
    
    /**
     * Creates a connection to a remote endpoint.
     * @param remoteEndpoint the target endpoint of the connection
     * allocation request
     * @param sendOptions any options given to one of the send*() methods of
     * the StandardQuasiHttpClient class
     * @returns a promise whose result is a connection to remote endpoint
     */
    allocateConnection(remoteEndpoint: any, sendOptions?: QuasiHttpProcessingOptions ):
        Promise<QuasiHttpConnection | undefined>

    /**
     * Activates or establishes a connection created with
     * allocateConnection() method.
     * @param connection connection to establish before use
     */
    establishConnection(connection: QuasiHttpConnection): Promise<void>

    /**
     * Releases resources held by a connection of a quasi http transport instance.
     * @param connection the connection to release
     * @param response an optional response which may still need the connection
     * to some extent
     */
    releaseConnection(connection: QuasiHttpConnection,
        response: IQuasiHttpResponse | undefined): Promise<void>
}

/**
 * Represens objects needed by IQuasiHttpTransport instances
 * for reading or writing data.
 */
export interface QuasiHttpConnection {

    /**
     * Gets the effective processing options that will be used to
     * limit sizes of headers and response bodies, and configure any
     * other operations by StandardQuasiHttpClient
     * and StandardQuasiHttpServer instances.
     */
    processingOptions?: QuasiHttpProcessingOptions

    /**
     * Gets an optional promise which can be used by
     * StandardQuasiHttpClient and StandardQuasiHttpServer
     * instances, to impose timeouts on request processing
     * if and only if it returns true.
     */
    timeoutPromise?: Promise<boolean>

    /**
     * Gets any environment variables that can control decisions
     * during operations by StandardQuasiHttpClient
     * and StandardQuasiHttpServer instances.
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
     * Gets the value that imposes a maximum size on response bodies. To indicate absence
     * of a limit, use -1 or any negative value.
     * 
     * Note that falsy values will be interpreted as unspecified, and in the absence of any overriding options
     * a client-specific default value will be used.
     */
    maxResponseBodySize?: number
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
     * Unlike in HTTP, headers are case-sensitive and lower-cased
     * header names are recommended.
     * Also setting a Content-Length header
     * here will have no bearing on how to transmit or receive
     * the request body.
     */
    headers?: Map<string, string[]>

    /**
     * Optional HTTP method value.
     */
    httpMethod?: string

    /**
     * Optional HTTP request version value.
     */
    httpVersion?: string

    /**
     * Gets or sets the number of bytes that the instance will supply,
     * or -1 (actually any negative value) to indicate an unknown number of
     * bytes.
     */
    contentLength?: number

    /**
     * Optional request body
     */
    body?: Readable

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
     * Unlike in HTTP, headers are case-sensitive and lower-cased
     * header names are recommended.
     * Also setting a Content-Length header
     * here will have no bearing on how to transmit or receive
     * the response body.
     */
    headers?: Map<string, string[]>

    /**
     * Optional HTTP response status text or reason phrase.
     */
    httpStatusMessage?: string

    /**
     * Optional HTTP response version value.
     */
    httpVersion?: string

    /**
     * Gets or sets the number of bytes that the instance will supply,
     * or -1 (actually any negative value) to indicate an unknown number of
     * bytes.
     */
    contentLength?: number

    /**
     * Optional response body
     */
    body?: Readable

    /**
     * Optional map of objects keyed by strings which may be of
     * interest during response processing.
     */
    environment?: Map<string, any>
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

/**
 * Represents commonality of functions provided by TCP or IPC mechanisms
 * at both server and client ends.
 */
export interface IQuasiHttpTransport {

    /**
     * Gets the readable stream associated with a connection
     * for reading a request or response from the connection.
     * @param connection connection with readable stream
     * @returns readable stream
     */
    getReadableStream(conn: QuasiHttpConnection): Readable | undefined
    
    /**
     * Gets the writable stream associated with a connection
     * for writing a request or response to the connection.
     * @param connection connection with writable stream
     * @returns writable stream
     */
    getWritableStream(conn: QuasiHttpConnection): Writable | undefined
}

/**
 * Represents a quasi http request processing function used by 
 * instances of StandardQuasiHttpServer class
 * to generate quasi http responses.
 */
export type QuasiHttpApplication =
    (request: IQuasiHttpRequest) => Promise<IQuasiHttpResponse | undefined>;


/**
 * Represents a promise and a function to cancel it. Intended for use
 * with timeouts.
 */
export interface ICancellableTimeoutPromise {

    /**
     * Gets the pending timeout task, which will resolve
     * with a truthy value if timeout occurs.
     */
    promise: Promise<boolean>

    /**
     * Cancels the pending timeout, such that the promise
     * property will resolve with a falsy value.
     */
    cancel(): void
}

/**
 * Equivalent to TaskCompletionSource in C#.NET or
 * Deferred in jQuery.
 */
export interface IBlankChequePromise<T> {
    promise: Promise<T>
    resolve: (r: T) => void
    reject: (r: Error) => void
}