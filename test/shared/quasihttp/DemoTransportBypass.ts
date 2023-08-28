import {
    IQuasiHttpAltTransport,
    IQuasiHttpRequest,
    QuasiHttpSendOptions,
    QuasiHttpSendResponse
} from "../../../src/quasihttp/types";

export class DemoTransportBypass implements IQuasiHttpAltTransport {
    sendRequestCallback: any
    createCancellationHandles = false
    isCancellationRequested = false
    actualSendOptions?: QuasiHttpSendOptions
    actualRemoteEndpoint: any
    
    async cancelSendRequest(sendCancellationHandle: any) {
        this.isCancellationRequested = true;
    }

    private async _processSendRequest(
            remoteEndpoint: any,
            requestFunc: any,
            sendOptions: QuasiHttpSendOptions | undefined) {
        this.actualRemoteEndpoint = remoteEndpoint
        this.actualSendOptions = sendOptions;
        const request = await requestFunc(undefined)
        return await this.sendRequestCallback(request)
    }

    async processSendRequest(
            remoteEndpoint: any,
            request: IQuasiHttpRequest | undefined,
            sendOptions?: QuasiHttpSendOptions | undefined): Promise<QuasiHttpSendResponse | undefined> {
        return await this.processSendRequest2(remoteEndpoint,
            async () => request, sendOptions)
    }

    async processSendRequest2(
            remoteEndpoint: any,
            requestFunc: (env: Map<string, any>) => Promise<IQuasiHttpRequest | undefined>,
            sendOptions?: QuasiHttpSendOptions | undefined): Promise<QuasiHttpSendResponse | undefined> {
        const promise = this._processSendRequest(
            remoteEndpoint, requestFunc, sendOptions)
        const result: QuasiHttpSendResponse = {
            responsePromise: promise
        }
        if (this.createCancellationHandles) {
            result.cancellationHandle = {}
        }
        return result
    }
}