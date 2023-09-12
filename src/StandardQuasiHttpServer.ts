import {
    MissingDependencyError,
    QuasiHttpRequestProcessingError
} from "./errors";
import {
    QuasiHttpConnection,
    IQuasiHttpApplication,
    IQuasiHttpServerTransport
} from "./types";
import * as ProtocolUtilsInternal from "./protocol-impl/ProtocolUtilsInternal"
import * as QuasiHttpCodec from "./protocol-impl/QuasiHttpCodec"
import { DefaultQuasiHttpRequest } from "./protocol-impl";

/**
 * The standard implementation of the server side of the quasi http protocol
 * defined by the Kabomu library.
 * 
 * This class provides the server facing side of networking for end users.
 * It is the complement to the StandardQuasiHttpClient class for providing
 * HTTP semantics whiles enabling underlying
 * transport options beyond TCP.
 * 
 * Therefore this class can be seen as the equivalent of an HTTP server
 * in which the underlying transport of choice extends beyond TCP to include
 * IPC mechanisms.
 */
export class StandardQuasiHttpServer {

    /**
     * The object which is
     * responsible for processing requests to generate responses.
     */
    application?: IQuasiHttpApplication

    /**
     * The underlying transport (TCP or IPC) for retrieving requests
     * for quasi web applications, and for sending responses generated
     * from quasi web applications.
     */
    transport?: IQuasiHttpServerTransport

    /**
     * Creates a new instance.
     * @param options optional object for setting properties
     * on the instance.
     */
    constructor(options?: {
            application?: IQuasiHttpApplication
            transport?: IQuasiHttpServerTransport
        }) {
        this.application = options?.application
        this.transport = options?.transport
    }

    /**
     * Used to process incoming connections from quasi http server transports.
     * @param connection represents a connection and
     * any associated information
     */
    async acceptConnection(connection: QuasiHttpConnection) {
        if (!connection) {
            throw new Error("connection argument is null")
        }

        // access fields for use per processing call, in order to cooperate with
        // any implementation of field accessors which supports
        // concurrent modifications.
        const transport = this.transport
        const application = this.application
        if (!transport) {
            throw new MissingDependencyError("server transport")
        }
        if (!application) {
            throw new MissingDependencyError("server application")
        }

        try {
            await processAccept(application, transport, connection)
        }
        catch (e) {
            await abort(transport, connection, true)
            if (e instanceof QuasiHttpRequestProcessingError) {
                throw e;
            }
            const abortError = new QuasiHttpRequestProcessingError(
                "encountered error during receive request processing",
                QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
                { cause: e })
            throw abortError;
        }
    }
}

async function processAccept(
        application: IQuasiHttpApplication,
        transport: IQuasiHttpServerTransport,
        connection: QuasiHttpConnection) {
    const encodedRequestHeaders = new Array<Buffer>();
    const encodedRequestBody = await transport.read(connection, false,
        encodedRequestHeaders);
    if (!encodedRequestHeaders.length) {
        throw new QuasiHttpRequestProcessingError("no request")
    }

    const request = new DefaultQuasiHttpRequest({
        environment: connection.environment
    });
    QuasiHttpCodec.decodeRequestHeaders(encodedRequestHeaders, request);
    request.body = ProtocolUtilsInternal.decodeRequestBodyFromTransport(
        request.contentLength, encodedRequestBody);

    const response = await application.processRequest(request);
    if (!response) {
        throw new QuasiHttpRequestProcessingError("no response");
    }

    try {
        if (ProtocolUtilsInternal.getEnvVarAsBoolean(response.environment,
                QuasiHttpCodec.ENV_KEY_SKIP_SENDING) !== true) {
            const encodedResponseHeaders = QuasiHttpCodec.encodeResponseHeaders(response,
                connection.processingOptions?.maxHeadersSize);
            const encodedResponseBody = ProtocolUtilsInternal.encodeBodyToTransport(true,
                response.contentLength, response.body);
            await transport.write(connection, true, encodedResponseHeaders,
                encodedResponseBody);
        }
    }
    finally {
        await response.release()
    }
    await abort(transport, connection, false)
}

async function abort(transport: IQuasiHttpServerTransport,
        connection: QuasiHttpConnection, errorOccured: boolean) {
    if (errorOccured) {
        try {
            transport.releaseConnection(connection);
        }
        catch { } // ignore
    }
    else {
        await transport.releaseConnection(connection);
    }
}
