const net = require("node:net")
const {
    MiscUtils
} = require("kabomu-js")
const { SocketConnection } = require("./SocketConnection")

class LocalhostTcpClientTransport {
    defaultSendOptions = undefined

    constructor(options) {
        this.defaultSendOptions = options?.defaultSendOptions
    }

    async allocateConnection(remoteEndpoint, sendOptions) {
        const port = MiscUtils.parseInt32(remoteEndpoint)
        const socket = new net.Socket()
        const connection = new SocketConnection(socket,
            true, sendOptions, this.defaultSendOptions)
        const blankCheque = MiscUtils.createBlankChequePromise()
        const errorListener = e => {
            blankCheque.reject(e)
        }
        socket.once("error", errorListener)
        const connectOpts = {
            port,
            noDelay: true
        }
        socket.connect(connectOpts, "localhost", () => {
            blankCheque.resolve()
        })
        try {
            await MiscUtils.completeMainPromise(blankCheque.promise,
                connection.timeoutId?.promise)
        }
        catch (e) {
            try {
                // don't wait.
                connection.release(false)
            }
            catch { } // ignore
            throw e;
        }
        socket.removeListener("error", errorListener)
        return connection
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

exports.LocalhostTcpClientTransport = LocalhostTcpClientTransport