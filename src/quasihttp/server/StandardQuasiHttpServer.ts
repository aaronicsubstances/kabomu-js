import { QuasiHttpRequestProcessingError } from "../errors";
import {
    ConnectionAllocationResponse,
    IQuasiHttpApplication,
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    IQuasiHttpServerTransport,
    QuasiHttpProcessingOptions
} from "../types";
import { ReceiveTransferInternal } from "./ReceiveTransferInternal";
import * as ProtocolUtilsInternal from "../ProtocolUtilsInternal"
import { DefaultReceiveProtocolInternal } from "./DefaultReceiveProtocolInternal";
import { AltReceiveProtocolInternal } from "./AltReceiveProtocolInternal";

/**
 * The standard implementation of the server side of the quasi http protocol
 * defined by the Kabomu library.
 * 
 * This class provides the server facing side of networking for end users.
 * It is the complement to the StandardQuasiHttpClient class for providing
 * HTTP semantics for web application frameworks whiles enabling underlying
 * transport options beyond TCP.
 * 
 * Therefore this class can be seen as the equivalent of an HTTP server
 * in which the underlying transport of choice extends beyond TCP to include
 * IPC mechanisms.
 */
export class StandardQuasiHttpServer {

    /**
     * The default options used to process receive requests.
     */
    defaultProcessingOptions?: QuasiHttpProcessingOptions

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
            defaultProcessingOptions: QuasiHttpProcessingOptions
            application: IQuasiHttpApplication
            transport: IQuasiHttpServerTransport
        }) {
        this.defaultProcessingOptions = options?.defaultProcessingOptions
        this.application = options?.application
        this.transport = options?.transport
    }

    /**
     * Used to process incoming connections from quasi http server transports.
     * @param connectionAllocationResponse represents a connection and
     * any associated information
     */
    async acceptConnection(
            connectionAllocationResponse: ConnectionAllocationResponse) {
        if (!connectionAllocationResponse?.connection) {
            throw new Error("connectionAllocationResponse argument is null")
        }
        const transfer = new ReceiveTransferInternal(null as any)
        await this._processAcceptConnection(transfer,
            connectionAllocationResponse)
    }

    private async _processAcceptConnection(
            transfer: ReceiveTransferInternal,
            connectionResponse: ConnectionAllocationResponse) {
        // access fields for use per processing call, in order to cooperate with
        // any implementation of field accessors which supports
        // concurrent modifications.
        const defaultProcessingOptions = this.defaultProcessingOptions;
        const timeoutMillis =
            ProtocolUtilsInternal.determineEffectiveNonZeroIntegerOption(
                undefined, defaultProcessingOptions?.timeoutMillis, 0);
        const maxChunkSize = 
            ProtocolUtilsInternal.determineEffectivePositiveIntegerOption(
                undefined, defaultProcessingOptions?.maxChunkSize, 0)
        
        transfer.timeoutId =
            ProtocolUtilsInternal.createCancellableTimeoutPromise(
                timeoutMillis, "receive timeout")
        
        transfer.protocol = new DefaultReceiveProtocolInternal({
            maxChunkSize,
            application: this.application as any,
            transport: this.transport as any,
            connection: connectionResponse.connection,
            requestEnvironment: connectionResponse.environment
        })

        try {
            const workPromise = transfer.startProtocol()
            await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise, transfer.timeoutId?.promise, undefined)
        }
        catch (e) {
            await transfer.abort(undefined)
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

    /**
     * Sends a quasi http request directly to the application property
     * within some timeout value.
     * 
     * By this method, transport types which are not connection-oriented
     * or implement connections differently can still make use of this class
     * to offload some of the burdens of quasi http request processing.
     * Currently what is available is setting timeouts on request processing.
     * 
     * @param request quasi http request to process
     * @param options supplies request timeout and any processing options
     * which should override the default processing options
     * @returns a promise whose result will be the response generated by
     * the quasi http application
     */
    async acceptRequest(request: IQuasiHttpRequest,
            options?: QuasiHttpProcessingOptions)
            : Promise<IQuasiHttpResponse> {
        if (!request) {
            throw new Error("request argument is null")
        }
        const transfer = new ReceiveTransferInternal(null as any)
        return await this._processAcceptRequest(
            request, options, transfer)
    }

    private async _processAcceptRequest(
            request: IQuasiHttpRequest,
            options: QuasiHttpProcessingOptions | undefined,
            transfer: ReceiveTransferInternal)
            : Promise<IQuasiHttpResponse> {
        const timeoutMillis =
            ProtocolUtilsInternal.determineEffectiveNonZeroIntegerOption(
                options?.timeoutMillis,
                this.defaultProcessingOptions?.timeoutMillis,
                0)
        transfer.timeoutId =
                ProtocolUtilsInternal.createCancellableTimeoutPromise(
                    timeoutMillis, "receive timeout")
        
        transfer.protocol = new AltReceiveProtocolInternal(
            this.application as any,
            request)

        try {
            const workPromise = transfer.startProtocol();
            const res = await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise, transfer.timeoutId?.promise, undefined);
            return res!
        }
        catch (e) {
            await transfer.abort(undefined)
            if (e instanceof QuasiHttpRequestProcessingError) {
                throw e;
            }
            const abortError = new QuasiHttpRequestProcessingError(
                "encountered error during receive request processing",
                QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
                { cause: e })
            throw abortError
        }
    }
}