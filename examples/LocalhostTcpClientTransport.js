const net = require("node:net")
const {
    QuasiHttpUtils
} = require("kabomu")
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
            port, sendOptions, this.defaultSendOptions)
        return connection
    }

    async establishConnection(connection) {
        const socket = connection.socket;
        const port = connection.clientPortOrPath;
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
        await blankCheque.promise;
        socket.removeListener("error", errorListener)
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