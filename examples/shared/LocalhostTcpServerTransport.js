const net = require("net");
const IOUtils = require("kabomu-js/dist/common/IOUtils")
const {
    createDelayPromise,
    createPendingPromise
} = require("kabomu-js/dist/common/MiscUtilsInternal")

class LocalhostTcpServerTransport {
    port = 0
    quasiHttpServer = undefined
    _server = undefined

    constructor(port, quasiHttpServer) {
        this.port = port
        this.quasiHttpServer = quasiHttpServer
        this._server = net.createServer()
    }
    
    async start() {        
        this._server.on("connection", (socket) => {
            //console.log("Client connected");

            /*socket.on("end", () => {
                console.log("Client disconnected");
            });

            socket.on("error", (error) => {
                console.log(`Socket Error: ${error.message}`);
            });*/

            // don't wait
            this._receiveConnection(socket)
        })

        const listenWaiter = createPendingPromise()
        this._server.on("error", (error) => {
            console.log(`Server Error: ${error.message}`);
            listenWaiter.reject(error) // should take effect only once.
        });
        this._server.listen(this.port, () => {
            //console.log(`TCP socket server is running on port: ${this.port}`);
            listenWaiter.resolve()
        })
        await listenWaiter.promise
    }

    async _receiveConnection(socket) {
        try {
            socket.noDelay = true;
            await this.quasiHttpServer.acceptConnection({
                connection: socket
            })
        }
        catch (e) {
            console.warn("connection processing error", e)
        }
    }
    
    async stop() {
        await this._server.close()
        await createDelayPromise(1_000)
    }
    
    getReader(connection) {
        return connection
    }
    
    getWriter(connection) {
        return connection
    }
    
    async releaseConnection(connection) {
        await IOUtils.endWrites(connection)
    }
}

exports.LocalhostTcpServerTransport = LocalhostTcpServerTransport