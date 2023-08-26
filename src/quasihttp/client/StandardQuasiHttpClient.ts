import { createPendingPromise } from "../ProtocolUtilsInternal"
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
        transfer.request = request
        const interimResult = await this._startSend(remoteEndpoint,
            undefined, options, transfer)
        return await StandardQuasiHttpClient._completeSend(transfer,
            interimResult.promise)
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
     * @returns a promise of an object which contains 
     * (1) a promise whose result is the
     * quasi http response received from the remote endpoint;
     * and (2) also contains opaque cancellation handle which can be used
     * to cancel the request sending with the cancelSend() method of this class.
     */
    async send2(remoteEndpoint: any,
            requestFunc: (env?: Map<string, any>) => Promise<IQuasiHttpRequest | undefined>,
            options?: QuasiHttpSendOptions)
            : Promise<QuasiHttpSendResponse> {
        if (!requestFunc) {
            throw new Error("requestFunc argument is null")
        }

        const transfer = new SendTransferInternal(null as any)
        transfer.cancellationTcs = createPendingPromise<ProtocolSendResultInternal | undefined>()
        const interimResult = await this._startSend(remoteEndpoint, requestFunc,
            options, transfer)
        const sendPromise = StandardQuasiHttpClient._completeSend(
            transfer, interimResult.promise)
        const result: QuasiHttpSendResponse = {
            responsePromise: sendPromise,
            cancellationHandle: transfer
        }
        return result
    }

    private async _startSend(remoteEndpoint: any,
            requestFunc: any,
            options: QuasiHttpSendOptions | undefined,
            transfer: SendTransferInternal) {
        try {
            return await this._processSend(remoteEndpoint,
                requestFunc, options, transfer);
        }
        catch (e) {
            await transfer.abort(e, undefined)
            if (e instanceof QuasiHttpRequestProcessingError) {
                throw e;
            }
            else {
                const abortError = new QuasiHttpRequestProcessingError(
                    "encountered error during send request processing",
                    QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
                    { cause: e });
                throw abortError;
            }
        }
    }

    private static async _completeSend(
            transfer: SendTransferInternal,
            sendPromise: Promise<ProtocolSendResultInternal | undefined>)
            : Promise<IQuasiHttpResponse | undefined> {
        let result: ProtocolSendResultInternal | undefined
        let response: IQuasiHttpResponse | undefined
        try {
            result = await sendPromise
            response = result?.response
        }
        catch (e) {
            await transfer.abort(e, result)
            if (e instanceof QuasiHttpRequestProcessingError) {
                throw e;
            }
            else {
                const abortError = new QuasiHttpRequestProcessingError(
                    "encountered error during send request processing",
                    QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
                    { cause: e });
                throw abortError;
            }
        }
        return response
    }

    private async _processSend(remoteEndpoint: any,
            requestFunc: any,
            options: QuasiHttpSendOptions | undefined,
            transfer: SendTransferInternal) {
        // access fields for use per request call, in order to cooperate with
        // any implementation of field accessors which supports
        // concurrent modifications.
        const defaultSendOptions = this.defaultSendOptions;
        const transportBypass = this.transportBypass;
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

        let interimResult: {
            promise: Promise<ProtocolSendResultInternal | undefined>
        }
        if (transportBypass) {
            interimResult = await StandardQuasiHttpClient._directSend(
                remoteEndpoint, requestFunc,
                mergedSendOptions, transfer, transportBypass);
        }
        else {
            interimResult = await StandardQuasiHttpClient._allocateConnectionAndSend(
                remoteEndpoint, requestFunc,
                mergedSendOptions, transfer, this.transport);
        }
        const result = ProtocolUtilsInternal.completeRequestProcessing(
            interimResult.promise, transfer.timeoutId?.promise,
            transfer.cancellationTcs?.promise);
        return {
            promise: result
        }
    }

    private static async _directSend(remoteEndpoint: any,
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
                transfer.request, mergedSendOptions)
        }
        transfer.protocol = new AltSendProtocolInternal({
            transportBypass,
            responseBufferingEnabled: mergedSendOptions.responseBufferingEnabled,
            responseBodyBufferingSizeLimit: mergedSendOptions.responseBodyBufferingSizeLimit,
            responsePromise: response?.responsePromise as any,
            sendCancellationHandle: response?.cancellationHandle,
            ensureTruthyResponse: mergedSendOptions.ensureTruthyResponse
        })
        return {
            promise: transfer.startProtocol()
        }
    }
    
    private static async _allocateConnectionAndSend(
            remoteEndpoint: any,
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

        if (!transfer.request) {
            const request = await requestFunc(connectionResponse.environment)
            if (!request) {
                throw new QuasiHttpRequestProcessingError("no request")
            }
            transfer.request = request
        }

        transfer.protocol = new DefaultSendProtocolInternal({
            request: transfer.request as any,
            transport,
            connection,
            responseBufferingEnabled: mergedSendOptions.responseBufferingEnabled,
            responseBodyBufferingSizeLimit: mergedSendOptions.responseBodyBufferingSizeLimit,
            maxChunkSize: mergedSendOptions.maxChunkSize,
            ensureTruthyResponse: mergedSendOptions.ensureTruthyResponse
        })
        return {
            promise: transfer.startProtocol()
        }
    }
}