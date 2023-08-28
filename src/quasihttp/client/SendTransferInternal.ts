import { IBlankChequePromise } from "../../common/types";
import {
    ICancellableTimeoutPromiseInternal,
    IQuasiHttpRequest,
    ISendProtocolInternal,
    ProtocolSendResultInternal
} from "../types";

export class SendTransferInternal {
    private _abortCalled = false
    protocol: ISendProtocolInternal
    timeoutId?: ICancellableTimeoutPromiseInternal
    cancellationTcs?: IBlankChequePromise<ProtocolSendResultInternal | undefined>
    request?: IQuasiHttpRequest

    constructor(protocol: ISendProtocolInternal) {
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
        const res = await this.protocol.send();
        await this.abort(undefined, res);
        return res;
    }

    async abort(cancellationError: any,
            res: ProtocolSendResultInternal | undefined) {
        if (this.trySetAborted()) {
            this.timeoutId?.cancel();

            if (cancellationError) {
                this.cancellationTcs?.reject(cancellationError)
            }
            else {
                this.cancellationTcs?.resolve(undefined)
            }

            if (cancellationError || !res?.response?.body ||
                    res?.responseBufferingApplied === true) {
                try {
                    await this.protocol.cancel()
                }
                catch { } // ignore
            }

            // dispose request
            try {
                await this.request?.release();
            }
            catch { }
        }
        else {
            // dispose off response
            try {
                await res?.response?.release();
            }
            catch { } // ignore.
        }
    }
}