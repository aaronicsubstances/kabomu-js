const {
    QuasiHttpUtils
} = require("kabomu")

class SocketConnection {
    socket = undefined
    clientPortOrPath = undefined
    _timeoutId = undefined
    processingOptions = undefined
    environment = undefined

    constructor(socket, clientPortOrPath, processingOptions,
            fallbackProcessingOptions) {
        this.socket = socket
        this.clientPortOrPath = clientPortOrPath
        this.processingOptions = QuasiHttpUtils.mergeProcessingOptions(
            processingOptions, fallbackProcessingOptions) ||
            {}
        this._timeoutId = QuasiHttpUtils.createCancellableTimeoutPromise(
            this.processingOptions.timeoutMillis);
    }

    get timeoutPromise() {
        return this._timeoutId?.promise
    }
    
    get stream() {
        return this.socket
    }

    async release(response) {
        this._timeoutId?.cancel()
        if (response?.body) {
            return;
        }
        this.socket.end(() => {
            this.socket.destroy()
        })
    }
}

exports.SocketConnection = SocketConnection