const {
    QuasiHttpUtils
} = require("kabomu")

class SocketConnection {
    _socket = undefined
    _abortController = undefined
    _timeoutId = undefined
    processingOptions = undefined
    environment = undefined

    constructor(socket, isClient, processingOptions,
            fallbackProcessingOptions) {
        this._socket = socket
        this.processingOptions = QuasiHttpUtils.mergeProcessingOptions(
            processingOptions, fallbackProcessingOptions) ||
            {}
        this._abortController = new AbortController()
        this._timeoutId = QuasiHttpUtils.createCancellableTimeoutPromise(
            this.processingOptions.timeoutMillis);
    }

    get timeoutPromise() {
        return this._timeoutId?.promise
    }

    get abortSignal() {
        return this._abortController.signal
    }
    
    get stream() {
        return this._socket
    }

    async release(response) {
        this._timeoutId?.cancel()
        if (response?.body) {
            return;
        }
        this._abortController.abort()
        this._socket.end(() => {
            this._socket.destroy()
        })
    }
}

exports.SocketConnection = SocketConnection