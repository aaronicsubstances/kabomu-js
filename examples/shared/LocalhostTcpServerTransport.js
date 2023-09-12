const net = require("node:net")
const {
    MiscUtils
} = require("kabomu-js")
const { SocketConnection } = require("./SocketConnection")
const { createDelayPromise } = require("./TransportImplHelpers")

class LocalhostTcpServerTransport {
    defaultProcessingOptions = undefined
    server = undefined
    port = 0

    constructor(options) {
        this.defaultProcessingOptions = options?.defaultProcessingOptions
        this.server = options?.server
        this.port = options?.port
        this.serverSocket = net.createServer({
            noDelay: true
        })
    }

    async start() {
        this.acceptConnections()
        const blankCheque = MiscUtils.createBlankChequePromise()
        this.serverSocket.listen(this.port, "localhost", e => {
            if (e) {
                blankCheque.reject(e)
            }
            else {
                blankCheque.resolve()
            }
        })
        await blankCheque.promise
    }

    async stop() {
        // don't wait for close except for a few secs.
        this.serverSocket.close()
        await createDelayPromise(1_000);
    }

    async acceptConnections() {
        this.serverSocket.on("connection", socket => {
            // don't wait.
            this.receiveConnection(socket)
        })
    }

    async receiveConnection(socket) {
        try {
            const connection = new SocketConnection(socket,
                false, this.defaultProcessingOptions)
            await this.server.acceptConnection(connection)
        }
        catch (e) {
            console.warn("connection processing error", e)
        }
    }

    async releaseConnection(connection) {
        await connection.release(false)
    }

    async write(connection, isResponse, encodedHeaders, body) {
        await connection.write(isResponse, encodedHeaders, body)
    }

    async read(connection, isResponse, encodedHeadersReceiver) {
        return await connection.read(isResponse, encodedHeadersReceiver)
    }
}

exports.LocalhostTcpServerTransport = LocalhostTcpServerTransport