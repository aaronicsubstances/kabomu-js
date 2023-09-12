import {
    MissingDependencyError,
    QuasiHttpRequestProcessingError
} from "./errors"
import {
    IQuasiHttpClientTransport,
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    QuasiHttpConnection,
    QuasiHttpProcessingOptions,
} from "./types"
import * as ProtocolUtilsInternal from "./protocol-impl/ProtocolUtilsInternal"
import * as QuasiHttpCodec from "./protocol-impl/QuasiHttpCodec"
import { DefaultQuasiHttpResponse } from "./protocol-impl"

/**
 * The standard implementation of the client side of the quasi http protocol
 * defined by the Kabomu library.
 * 
 * This class provides the client facing side of networking for end users.
 * It is the complement to the StandardQuasiHttpServer class for supporting
 * the semantics of HTTP client libraries whiles enabling underlying transport
 * options beyond TCP.
 * 
 * Therefore this class can be seen as the equivalent of an HTTP client that
 * extends underlying transport beyond TCP to IPC mechanisms.
 */
export class StandardQuasiHttpClient {

    /**
     * The underlying transport (TCP or IPC) by which connections
     * will be allocated for sending requests and receiving responses.
     */
    transport?: IQuasiHttpClientTransport

    /**
     * Creates a new instance.
     * @param options optional object for setting properties
     * on the instance.
     */
    constructor(options?: {
            transport?: IQuasiHttpClientTransport
        }) {
        this.transport = options?.transport
    }

    /**
     * Sends a quasi http request via quasi http transport.
     * @param remoteEndpoint the destination endpoint of the request
     * @param request the request to send
     * @param options optional send options
     * @returns a promise whose result will be the quasi http response
     * returned from the remote endpoint
     */
    async send(remoteEndpoint: any, request: IQuasiHttpRequest,
            options?: QuasiHttpProcessingOptions)
            : Promise<IQuasiHttpResponse | undefined> {
        if (!request) {
            throw new Error("request argument is null")
        }
        return await this._sendInternal(remoteEndpoint, request, undefined,
            options)
    }

    /**
     * Sends a quasi http request via quasi http transport and makes it
     * posssible to receive connection allocation information before
     * creating request.
     * @param remoteEndpoint the destination endpoint of the request
     * @param requestFunc a callback which receives any environment
     * associated with the connection that is created.
     * Returns a promise of the request to send
     * @param options optional send options
     * @returns a promise whose result will be the
     * quasi http response received from the remote endpoint.
     */
    async send2(remoteEndpoint: any,
            requestFunc: (env?: Map<string, any>) => Promise<IQuasiHttpRequest | undefined>,
            options?: QuasiHttpProcessingOptions)
            : Promise<IQuasiHttpResponse | undefined> {
        if (!requestFunc) {
            throw new Error("requestFunc argument is null")
        }
        return await this._sendInternal(remoteEndpoint, undefined,
            requestFunc, options)
    }

    private async _sendInternal(
            remoteEndpoint: any,
            request: IQuasiHttpRequest | undefined,
            requestFunc: any,
            sendOptions?: QuasiHttpProcessingOptions | undefined)
            : Promise<IQuasiHttpResponse | undefined> {
        // access fields for use per request call, in order to cooperate with
        // any implementation of field accessors which supports
        // concurrent modifications.
        const transport = this.transport;

        if (transport == null) {
            throw new MissingDependencyError("client transport");
        }

        const connection = await transport.allocateConnection(
            remoteEndpoint, sendOptions)
        if (!connection) {
            throw new QuasiHttpRequestProcessingError("no connection")
        }

        if (!request) {
            request = await requestFunc(connection.environment)
            if (!request) {
                throw new QuasiHttpRequestProcessingError("no request")
            }
        }

        try {
            const response = await processSend(request, transport,
                connection)
            return response
        }
        catch (e) {
            await abort(transport, connection, true)
            if (e instanceof QuasiHttpRequestProcessingError) {
                throw e;
            }
            const abortError = new QuasiHttpRequestProcessingError(
                "encountered error during send request processing",
                QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
                { cause: e });
            throw abortError;
        }
    }
}

async function processSend(
        request: IQuasiHttpRequest,
        transport: IQuasiHttpClientTransport,
        connection: QuasiHttpConnection) {
    // send entire request first before
    // receiving of response.
    if (ProtocolUtilsInternal.getEnvVarAsBoolean(
            request.environment, QuasiHttpCodec.ENV_KEY_SKIP_SENDING)
            !== true) {
        const encodedRequestHeaders = QuasiHttpCodec.encodeRequestHeaders(request,
            connection.processingOptions?.maxHeadersSize);
        const encodedRequestBody = ProtocolUtilsInternal.encodeBodyToTransport(false,
            request.contentLength, request.body);
        await transport.write(connection, false, encodedRequestHeaders,
            encodedRequestBody);
    }

    const encodedResponseHeaders = new Array<Buffer>();
    const encodedResponseBody = await transport.read(connection, true,
        encodedResponseHeaders);
    if (!encodedResponseHeaders.length) {
        throw new QuasiHttpRequestProcessingError("no response");
    }

    const response = new DefaultQuasiHttpResponse({
        body: encodedResponseBody
    })
    response.release = async () => {
        await transport.releaseConnection(connection, true);
    }
    QuasiHttpCodec.decodeResponseHeaders(encodedResponseHeaders,
        response)
    const responseStreamingEnabled = 
        await ProtocolUtilsInternal.decodeResponseBodyFromTransport(
            response,
            connection.environment, 
            connection.processingOptions,
            connection.abortSignal);
    await abort(transport, connection, false, responseStreamingEnabled);
    return response;
}

async function abort(transport: IQuasiHttpClientTransport,
        connection: QuasiHttpConnection,
        errorOccured: boolean, responseStreamingEnabled = false) {
    if (errorOccured) {
        try {
            // don't wait.
            transport.releaseConnection(connection, false);
        }
        catch { } // ignore
    }
    else {
        await transport.releaseConnection(connection,
            responseStreamingEnabled);
    }
}
