const net = require("net");
const IOUtils = require("kabomu-js/dist/common/IOUtils")
const {
    createPendingPromise
} = require("kabomu-js/dist/common/MiscUtilsInternal")

class LocalhostTcpClientTransport {
    port = 0

    constructor(port) {
        this.port = port
    }
    
    async allocateConnection(port) {
        const host = "127.0.0.1"
        const options = {
            port,
            host,
            noDelay: true
        }
        
        const connectWaiter = createPendingPromise()
        const client = net.createConnection(options, () => {
            connectWaiter.resolve()
        });

        client.once("error", (error) => {
            connectWaiter.reject(error)
        });

        /*client.on("close", () => {
            console.log("Connection closed");
        });*/
        await connectWaiter.promise;
        return {
            connection: client
        }
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

exports.LocalhostTcpClientTransport = LocalhostTcpClientTransport