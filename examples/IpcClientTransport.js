const net = require("node:net")
const {
    QuasiHttpUtils
} = require("kabomu-js")
const { SocketConnection } = require("./SocketConnection")

class IpcClientTransport {
    defaultSendOptions = undefined

    constructor(options) {
        this.defaultSendOptions = options?.defaultSendOptions
    }

    async allocateConnection(remoteEndpoint, sendOptions) {
        const path = remoteEndpoint
        const socket = new net.Socket()
        const connection = new SocketConnection(socket,
            true, sendOptions, this.defaultSendOptions)
        const blankCheque = QuasiHttpUtils.createBlankChequePromise()
        const errorListener = e => {
            blankCheque.reject(e)
        }
        socket.once("error", errorListener)
        const connectOpts = {
            path,
            noDelay: true
        }
        socket.connect(connectOpts, () => {
            blankCheque.resolve()
        })
        const connectionAllocationResponse = {
            connection,
            connectPromise: blankCheque.promise.then(() => {
                socket.removeListener("error", errorListener)
            })
        }
        return connectionAllocationResponse
    }

    async releaseConnection(connection, responseStreamingEnabled) {
        await connection.release(responseStreamingEnabled)
    }

    async write(connection, isResponse, encodedHeaders, body) {
        await connection.write(isResponse, encodedHeaders, body)
    }

    async read(connection, isResponse, encodedHeadersReceiver) {
        return await connection.read(isResponse, encodedHeadersReceiver)
    }
}

exports.IpcClientTransport = IpcClientTransport