import {
    MissingDependencyError,
    QuasiHttpError
} from "./errors";
import {
    QuasiHttpConnection,
    QuasiHttpApplication,
    IQuasiHttpServerTransport,
    IQuasiHttpRequest,
    IQuasiHttpAltTransport
} from "./types";
import * as ProtocolUtilsInternal from "./ProtocolUtilsInternal"

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
            const timeoutPromise = connection.timeoutPromise;
            if (timeoutPromise) {
                await Promise.race([
                    acceptPromise, ProtocolUtilsInternal.wrapTimeoutPromise(
                        timeoutPromise, false)]);
            }
            await acceptPromise;
            await abort(transport, connection, false)
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
    let request: IQuasiHttpRequest | undefined
    const altTransport = transport as IQuasiHttpAltTransport
    const requestDeserializer = altTransport.requestDeserializer
    if (requestDeserializer) {
        request = await requestDeserializer(connection)
    }
    if (!request) {
        request = await ProtocolUtilsInternal.readEntityFromTransport(
            false, transport.getReadableStream(connection),
            connection)
    }

    const response = await application(request);
    if (!response) {
        throw new QuasiHttpError("no response");
    }

    try {
        let responseSerialized = false
        const responseSerializer = altTransport.responseSerializer
        if (responseSerializer) {
            responseSerialized = await responseSerializer(connection, response)
        }
        if (!responseSerialized) {
            await ProtocolUtilsInternal.writeEntityToTransport(
                true, response, transport.getWritableStream(connection),
                connection)
        }
    }
    finally {
        const releaseFunc = response.release;
        if (releaseFunc) {
            await releaseFunc.call(response);
        }
    }
}

async function abort(transport: IQuasiHttpServerTransport,
        connection: QuasiHttpConnection, errorOccured: boolean) {
    if (errorOccured) {
        try {
            // don't wait
            Promise.resolve(transport.releaseConnection(connection))
                .catch(() => {}); // swallow errors
        }
        catch { } // ignore
    }
    else {
        await transport.releaseConnection(connection);
    }
}
