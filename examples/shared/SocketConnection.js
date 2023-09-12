const {
    MiscUtils,
    QuasiHttpCodec
} = require("kabomu-js")
const {
    createCancellableTimeoutPromise
} = require("./TransportImplHelpers")

class SocketConnection {
    socket = undefined
    abortSignal = undefined
    processingOptions = undefined
    timeoutId = undefined

    constructor(socket, isClient, processingOptions,
            fallbackProcessingOptions) {
        this.socket = socket
        this.processingOptions = MiscUtils.mergeProcessingOptions(
            processingOptions, fallbackProcessingOptions) ||
            {}
        const abortController = new AbortController()
        this.abortSignal = abortController.signal
        this.timeoutId = createCancellableTimeoutPromise(
            this.processingOptions.timeoutMillis,
            isClient ? "send timeout" : "receive timeout");
    }

    async release(responseStreamingEnabled) {
        this.timeoutId?.cancel()
        if (responseStreamingEnabled) {
            return;
        }
        this.socket.destroy()
    }

    async write(isResponse, encodedHeaders, body) {
        console.debug(`writing ${isResponse ? "response" : "request"}...`)
        this.socket.write(encodedHeaders)
        if (body) {
            await MiscUtils.copyBytes(body, this.socket,
                this.abortSignal)
        }
        console.debug(`done writing ${isResponse ? "response" : "request"}...`)
    }

    async read(isResponse, encodedHeadersReceiver) {
        console.debug(`reading ${isResponse ? "response" : "request"}...`)
        await QuasiHttpCodec.readEncodedHeaders(
            this.socket, encodedHeadersReceiver,
            this.processingOptions.maxHeadersSize,
            this.abortSignal)
        console.debug(`done reading ${isResponse ? "response" : "request"}...`)
        return this.socket
    }
}

exports.SocketConnection = SocketConnection