import {
    ICancellableTimeoutPromiseInternal,
    IQuasiHttpResponse,
    IReceiveProtocolInternal
} from "../types";

export class ReceiveTransferInternal {
    private _abortCalled = false
    protocol: IReceiveProtocolInternal
    timeoutId?: ICancellableTimeoutPromiseInternal

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

    async abort(res: IQuasiHttpResponse | undefined) {
        if (this.trySetAborted()) {
            this.timeoutId?.cancel();

            try {
                await this.protocol.cancel()
            }
            catch { } // ignore
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