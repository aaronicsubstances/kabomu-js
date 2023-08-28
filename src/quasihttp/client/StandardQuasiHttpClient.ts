import { QuasiHttpRequestProcessingError } from "../errors"
import {
    IQuasiHttpAltTransport,
    IQuasiHttpClientTransport,
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    ProtocolSendResultInternal,
    QuasiHttpSendOptions,
    QuasiHttpSendResponse
} from "../types"
import { SendTransferInternal } from "./SendTransferInternal"
import * as ProtocolUtilsInternal from "../ProtocolUtilsInternal"
import * as QuasiHttpUtils from "../QuasiHttpUtils"
import { AltSendProtocolInternal } from "./AltSendProtocolInternal"
import { MissingDependencyError } from "../../common/errors"
import { DefaultSendProtocolInternal } from "./DefaultSendProtocolInternal"
import { createBlankChequePromise } from "../../common/MiscUtils"

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
 * extends underlying transport beyond TCP to IPC mechanisms and even interested
 * connectionless transports as well.
 */
export class StandardQuasiHttpClient {

    /**
     * The default options used to send requests.
     */
    defaultSendOptions?: QuasiHttpSendOptions

    /**
     * The underlying transport (TCP or IPC) by which connections
     * will be allocated for sending requests and receiving responses.
     */
    transport?: IQuasiHttpClientTransport

    /**
     * Alternative to transport property for bypassing the usual
     * connection-oriented request processing done in this class.
     * 
     * By this property, any network can be used to send quasi http
     * requests since it effectively receives full responsibility
     * for sending the request.
     */
    transportBypass?: IQuasiHttpAltTransport

    /**
     * Can be used by transports which want to take charge of timeout
     * settings, to avoid the need for an instance of this class to
     * skip setting timeouts.
     */
    ignoreTimeoutSettings?: boolean

    /**
     * Creates a new instance.
     * @param options optional object for setting properties
     * on the instance.
     */
    constructor(options?: {    
            defaultSendOptions?: QuasiHttpSendOptions
            transport?: IQuasiHttpClientTransport
            transportBypass?: IQuasiHttpAltTransport
            ignoreTimeoutSettings?: boolean
        }) {
        this.defaultSendOptions = options?.defaultSendOptions
        this.transport = options?.transport
        this.transportBypass = options?.transportBypass
        this.ignoreTimeoutSettings = options?.ignoreTimeoutSettings
    }

    /**
     * Cancels a send request if it is still ongoing. Invalid cancellation
     * handles are simply ignored.
     * @param sendCancellationHandle cancellation handle received from
     * the send2() method of this class.
     */
    cancelSend(sendCancellationHandle: any) {
        if (sendCancellationHandle instanceof SendTransferInternal) {
            const transfer = sendCancellationHandle as
                SendTransferInternal
            const cancellationError = new QuasiHttpRequestProcessingError(
                "send cancelled",
                QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED);
            transfer.cancellationTcs?.reject(cancellationError)
        }
    }

    /**
     * Sends a quasi http request via quasi http transport.
     * @param remoteEndpoint the destination endpoint of the request
     * @param request the request to send
     * @param options optional send options which will be merged
     * with default send options.
     * @returns a promise whose result will be the quasi http response
     * returned from the remote endpoint
     */
    async send(remoteEndpoint: any, request: IQuasiHttpRequest,
            options?: QuasiHttpSendOptions)
            : Promise<IQuasiHttpResponse | undefined> {
        if (!request) {
            throw new Error("request argument is null")
        }
        const transfer = new SendTransferInternal(null as any)
        return await this._sendInternal(remoteEndpoint, request, undefined,
            options, transfer)
    }

    /**
     * Sends a quasi http request via quasi http transport and makes it
     * posssible to cancel.
     * @param remoteEndpoint the destination endpoint of the request
     * @param requestFunc a callback which receives any environment
     * associated with the connection that may be created, or any environment
     * that may be supplied by the transportBypass property.
     * Returns a promise of the request to send
     * @param options optional send options which will be merged
     * with default send options.
     * @returns an object which contains a promise whose result is the
     * quasi http response received from the remote endpoint;
     * and also contains opaque cancellation handle which can be used
     * to cancel the request sending with the cancelSend() method of this class.
     */
    send2(remoteEndpoint: any,
            requestFunc: (env?: Map<string, any>) => Promise<IQuasiHttpRequest | undefined>,
            options?: QuasiHttpSendOptions)
            : QuasiHttpSendResponse {
        if (!requestFunc) {
            throw new Error("requestFunc argument is null")
        }

        const transfer = new SendTransferInternal(null as any)
        transfer.cancellationTcs = createBlankChequePromise<ProtocolSendResultInternal | undefined>()
        const sendPromise = this._sendInternal(remoteEndpoint, undefined,
            requestFunc, options, transfer)
        const result: QuasiHttpSendResponse = {
            responsePromise: sendPromise,
            cancellationHandle: transfer
        }
        return result
    }

    private async _sendInternal(
            remoteEndpoint: any,
            request: IQuasiHttpRequest | undefined,
            requestFunc: any,
            options: QuasiHttpSendOptions | undefined,
            transfer: SendTransferInternal)
            : Promise<IQuasiHttpResponse | undefined> {
        try {
            options = this._prepareSend(options, transfer);
            const workPromise = this._processSend(remoteEndpoint,
                request, requestFunc, options, transfer);
            const result = await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise,
                transfer.timeoutId?.promise,
                transfer.cancellationTcs?.promise);
            return result?.response
        }
        catch (e) {
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

    private _prepareSend(
            options: QuasiHttpSendOptions | undefined,
            transfer: SendTransferInternal) {
        // access fields for use per request call, in order to cooperate with
        // any implementation of field accessors which supports
        // concurrent modifications.
        const defaultSendOptions = this.defaultSendOptions;
        const skipSettingTimeouts = this.ignoreTimeoutSettings;

        // NB: negative value is allowed for timeout, which indicates infinite timeout.
        const mergedSendOptions: QuasiHttpSendOptions = {}
        mergedSendOptions.timeoutMillis =
            ProtocolUtilsInternal.determineEffectiveNonZeroIntegerOption(
                options?.timeoutMillis,
                defaultSendOptions?.timeoutMillis,
                0);

        mergedSendOptions.extraConnectivityParams =
            ProtocolUtilsInternal.determineEffectiveOptions(
                options?.extraConnectivityParams,
                defaultSendOptions?.extraConnectivityParams);

        mergedSendOptions.responseBufferingEnabled =
            ProtocolUtilsInternal.determineEffectiveBooleanOption(
                options?.responseBufferingEnabled,
                defaultSendOptions?.responseBufferingEnabled,
                true);

        mergedSendOptions.maxChunkSize =
            ProtocolUtilsInternal.determineEffectivePositiveIntegerOption(
                options?.maxChunkSize,
                defaultSendOptions?.maxChunkSize,
                0);

        mergedSendOptions.responseBodyBufferingSizeLimit =
            ProtocolUtilsInternal.determineEffectivePositiveIntegerOption(
                options?.responseBodyBufferingSizeLimit,
                defaultSendOptions?.responseBodyBufferingSizeLimit,
                0);

        const connectivityParamFireAndForget =
            ProtocolUtilsInternal.getEnvVarAsBoolean(
                mergedSendOptions.extraConnectivityParams,
                QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET);
        let defaultForEnsureNonNullResponse = true;
        if (connectivityParamFireAndForget === true) {
            defaultForEnsureNonNullResponse = false;
        }
        mergedSendOptions.ensureTruthyResponse =
            ProtocolUtilsInternal.determineEffectiveBooleanOption(
                options?.ensureTruthyResponse,
                defaultSendOptions?.ensureTruthyResponse,
                defaultForEnsureNonNullResponse);

        if (!skipSettingTimeouts) {
            transfer.timeoutId = ProtocolUtilsInternal.createCancellableTimeoutPromise(
                mergedSendOptions.timeoutMillis, "send timeout");
        }

        return mergedSendOptions;
    }

    private async _processSend(remoteEndpoint: any,
            request: IQuasiHttpRequest | undefined,
            requestFunc: any,
            mergedSendOptions: QuasiHttpSendOptions,
            transfer: SendTransferInternal) {
        // access fields for use per request call, in order to cooperate with
        // any implementation of field accessors which supports
        // concurrent modifications.
        const transportBypass = this.transportBypass;

        if (transportBypass) {
            await StandardQuasiHttpClient._initiateDirectSend(
                remoteEndpoint, request, requestFunc,
                mergedSendOptions, transfer, transportBypass);
        }
        else {
            await StandardQuasiHttpClient._allocateConnection(
                remoteEndpoint, request, requestFunc,
                mergedSendOptions, transfer, this.transport);
        }

        try {
            const workPromise = transfer.startProtocol()
            return await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise,
                transfer.timeoutId?.promise,
                transfer.cancellationTcs?.promise);
        }
        catch (e) {
            await transfer.abort(e, undefined)
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

    private static async _initiateDirectSend(remoteEndpoint: any,
            request: IQuasiHttpRequest | undefined,    
            requestFunc: any,
            mergedSendOptions: QuasiHttpSendOptions,
            transfer: SendTransferInternal,
            transportBypass: IQuasiHttpAltTransport) {
        let response: QuasiHttpSendResponse | undefined
        if (requestFunc) {
            response = await transportBypass.processSendRequest2(remoteEndpoint,
                requestFunc, mergedSendOptions)
        }
        else {
            response = await transportBypass.processSendRequest(remoteEndpoint,
                request, mergedSendOptions)
        }
        transfer.protocol = new AltSendProtocolInternal({
            transportBypass,
            responseBufferingEnabled: mergedSendOptions.responseBufferingEnabled,
            responseBodyBufferingSizeLimit: mergedSendOptions.responseBodyBufferingSizeLimit,
            responsePromise: response?.responsePromise as any,
            sendCancellationHandle: response?.cancellationHandle,
            ensureTruthyResponse: mergedSendOptions.ensureTruthyResponse
        })
    }
    
    private static async _allocateConnection(
            remoteEndpoint: any,
            request: IQuasiHttpRequest | undefined,
            requestFunc: any,
            mergedSendOptions: QuasiHttpSendOptions,
            transfer: SendTransferInternal,
            transport: IQuasiHttpClientTransport | undefined) {
        if (!transport) {
            throw new MissingDependencyError('transport')
        }

        const connectionResponse = await transport.allocateConnection(
            remoteEndpoint, mergedSendOptions)
        const connection = connectionResponse?.connection
        if (!connection) {
            throw new QuasiHttpRequestProcessingError("no connection");
        }

        if (!request) {
            request = await requestFunc(connectionResponse.environment)
            if (!request) {
                throw new QuasiHttpRequestProcessingError("no request")
            }
        }

        transfer.protocol = new DefaultSendProtocolInternal({
            request,
            transport,
            connection,
            responseBufferingEnabled: mergedSendOptions.responseBufferingEnabled,
            responseBodyBufferingSizeLimit: mergedSendOptions.responseBodyBufferingSizeLimit,
            maxChunkSize: mergedSendOptions.maxChunkSize,
            ensureTruthyResponse: mergedSendOptions.ensureTruthyResponse
        })
    }
}