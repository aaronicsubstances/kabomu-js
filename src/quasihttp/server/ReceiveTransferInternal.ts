import {
    ICancellablePromiseInternal,
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    IReceiveProtocolInternal
} from "../types";

export class ReceiveTransferInternal {
    private _abortCalled = false
    protocol: IReceiveProtocolInternal
    timeoutId?: ICancellablePromiseInternal<IQuasiHttpResponse | null>
    request?: IQuasiHttpRequest

    constructor(protocol: IReceiveProtocolInternal) {
        this.protocol = protocol
    }

    get isAborted() {
        return this._abortCalled
    }

    trySetAborted() {
        if (this._abortCalled) {
            return false;
        }
        this._abortCalled = true;
        return true
    }

    async startProtocol()
    {
        const res = await this.protocol.receive();
        await this.abort(res);
        return res;
    }

    async abort(res: IQuasiHttpResponse | null) {
        if (this.trySetAborted()) {
            this.timeoutId?.cancel();

            try {
                await this.protocol.cancel()
            }
            catch { } // ignore

            // dispose request received for direct send to application
            try {
                await this.request?.release();
            }
            catch { }
        }
        else {
            // dispose off response
            try {
                await res?.release();
            }
            catch { } // ignore.
        }
    }
}