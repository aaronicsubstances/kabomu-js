import {
    MissingDependencyError,
    QuasiHttpError
} from "./errors";
import {
    QuasiHttpConnection,
    QuasiHttpApplication,
    IQuasiHttpServerTransport
} from "./types";
import * as ProtocolUtilsInternal from "./protocol-impl/ProtocolUtilsInternal"
import * as QuasiHttpCodec from "./protocol-impl/QuasiHttpCodec"
import * as QuasiHttpUtils from "./QuasiHttpUtils"
import { DefaultQuasiHttpRequest } from "./DefaultQuasiHttpRequest";

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
     * The function which is
     * responsible for processing requests to generate responses.
     */
    application?: QuasiHttpApplication

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
            application?: QuasiHttpApplication
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
            const acceptPromise = processAccept(application,
                transport, connection);
            if (connection.timeoutPromise) {
                const timeoutPromise = ProtocolUtilsInternal.wrapTimeoutPromise(
                    connection.timeoutPromise, "receive timeout")
                await Promise.race([
                    acceptPromise, timeoutPromise]);
            }
            await acceptPromise;
        }
        catch (e) {
            await abort(transport, connection, true)
            if (e instanceof QuasiHttpError) {
                throw e;
            }
            const abortError = new QuasiHttpError(
                "encountered error during receive request processing",
                QuasiHttpError.REASON_CODE_GENERAL,
                { cause: e })
            throw abortError;
        }
    }
}

async function processAccept(
        application: QuasiHttpApplication,
        transport: IQuasiHttpServerTransport,
        connection: QuasiHttpConnection) {
    const encodedRequest= await
        ProtocolUtilsInternal.readEntityFromTransport(
            false, transport, connection);

    const request = new DefaultQuasiHttpRequest({
        environment: connection.environment
    });
    QuasiHttpCodec.decodeRequestHeaders(encodedRequest.headers, request);
    request.body = ProtocolUtilsInternal.decodeRequestBodyFromTransport(
        request.contentLength, encodedRequest.body);

    const response = await application(request);
    if (!response) {
        throw new QuasiHttpError("no response");
    }

    try {
        if (ProtocolUtilsInternal.getEnvVarAsBoolean(response.environment,
                QuasiHttpUtils.ENV_KEY_SKIP_SENDING) !== true) {
            const encodedResponseHeaders = QuasiHttpCodec.encodeResponseHeaders(response,
                connection.processingOptions?.maxHeadersSize);
            const encodedResponseBody = ProtocolUtilsInternal.encodeBodyToTransport(true,
                response.contentLength, response.body);
            await transport.write(connection, true, encodedResponseHeaders,
                encodedResponseBody);
        }
    }
    finally {
        const releaseFunc = response.release;
        if (releaseFunc) {
            await releaseFunc.call(response);
        }
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
