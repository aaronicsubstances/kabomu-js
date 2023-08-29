import {
    ICancellableTimeoutPromiseInternal,
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
        await this.abort();
        return res;
    }

    async abort() {
        if (this.trySetAborted()) {
            this.timeoutId?.cancel();

            try {
                await this.protocol.cancel()
            }
            catch { } // ignore
        }
    }
}