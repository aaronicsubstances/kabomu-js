const net = require("node:net")
const {
    QuasiHttpUtils
} = require("kabomu")
const { SocketConnection } = require("./SocketConnection")
const { logWarn } = require("./AppLogger")
const { unlink } = require("node:fs/promises")

class IpcServerTransport {
    defaultProcessingOptions = undefined
    quasiHttpServer = undefined
    ipcPath = ''

    constructor(options) {
        this.defaultProcessingOptions = options?.defaultProcessingOptions
        this.quasiHttpServer = options?.quasiHttpServer
        this.ipcPath = options?.ipcPath
        this.serverSocket = net.createServer({
            noDelay: true
        })
    }

    async start() {
        this.acceptConnections()
        const blankCheque = QuasiHttpUtils.createBlankChequePromise()
        this.serverSocket.on("error", e => {
            logWarn("server socket error:", e.message);
            blankCheque.reject(e)
        })
        const listenOpts = {
            path: this.ipcPath
        }
        try {
            await unlink(this.ipcPath); // for unix domain sockets.
        }
        catch {} // ignore
        this.serverSocket.listen(listenOpts, e => {
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
        await QuasiHttpUtils.createDelayPromise(1_000);
    }

    async acceptConnections() {
        this.serverSocket.on("connection", socket => {
            // don't wait.
            this.receiveConnection(socket)
        })
    }

    async receiveConnection(socket) {
        socket.on("error", e => {
            logWarn("client socket error:", e);
        })
        try {
            const connection = new SocketConnection(socket,
                undefined, this.defaultProcessingOptions)
            await this.quasiHttpServer.acceptConnection(connection)
        }
        catch (e) {
            logWarn("connection processing error", e)
        }
    }

    async releaseConnection(connection) {
        await connection.release(undefined)
    }

    getReadableStream(connection) {
        return connection.stream
    }

    getWritableStream(connection) {
        return connection.stream
    }
}

exports.IpcServerTransport = IpcServerTransport