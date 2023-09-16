const { pipeline } = require('node:stream/promises')
const {
    QuasiHttpUtils
} = require("kabomu-js")
const { logDebug } = require('./AppLogger')

class SocketConnection {
    _owner = ''
    _socket = undefined
    _abortController = undefined
    _timeoutId = undefined
    processingOptions = undefined
    environment = undefined

    constructor(socket, isClient, processingOptions,
            fallbackProcessingOptions) {
        this._owner = isClient ? "client" : "server";
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

    async release(responseStreamingEnabled) {
        const usageTag = responseStreamingEnabled ? "partially" : "fully";
        logDebug(`releasing ${usageTag} for ${this._owner}...`);
        this._timeoutId?.cancel()
        if (responseStreamingEnabled) {
            return;
        }
        this._abortController.abort()
        this._socket.destroy()
    }

    async write(isResponse, encodedHeaders, body) {
        logDebug(`writing ${getUsageTag(isResponse)} for ${this._owner}...`)
        this._socket.write(encodedHeaders)
        if (body) {
            await pipeline(body, this._socket, {
                end: false,
                signal: this._abortController.signal
            })
        }
        logDebug(`done writing ${getUsageTag(isResponse)} for ${this._owner}.`)
    }

    async read(isResponse, encodedHeadersReceiver) {
        logDebug(`read ${getUsageTag(isResponse)} called for ${this._owner}...`)
        return this._socket
    }
}

function getUsageTag(isResponse) {
    return isResponse ? "response" : "request";
}

exports.SocketConnection = SocketConnection