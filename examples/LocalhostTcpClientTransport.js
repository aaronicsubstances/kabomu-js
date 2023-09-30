const net = require("node:net")
const {
    QuasiHttpUtils
} = require("kabomu-js")
const { SocketConnection } = require("./SocketConnection")

class LocalhostTcpClientTransport {
    defaultSendOptions = undefined

    constructor(options) {
        this.defaultSendOptions = options?.defaultSendOptions
    }

    async allocateConnection(remoteEndpoint, sendOptions) {
        const port = QuasiHttpUtils.parseInt32(remoteEndpoint)
        const socket = new net.Socket()
        const connection = new SocketConnection(socket,
            true, sendOptions, this.defaultSendOptions)
        const blankCheque = QuasiHttpUtils.createBlankChequePromise()
        const errorListener = e => {
            blankCheque.reject(e)
        }
        socket.once("error", errorListener)
        const connectOpts = {
            port,
            noDelay: true
        }
        socket.connect(connectOpts, "::1", () => {
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

    async releaseConnection(connection, response) {
        await connection.release(response)
    }

    getReadableStream(connection) {
        return connection.stream
    }

    getWritableStream(connection) {
        return connection.stream
    }
}

exports.LocalhostTcpClientTransport = LocalhostTcpClientTransport