const {
    StandardQuasiHttpClient
} =  require("kabomu-js")
const { startTransferringFiles } = require("./FileSender")
const {
    LocalhostTcpClientTransport
} = require("./LocalhostTcpClientTransport")
const { logInfo, logError } = require("./AppLogger")

async function main(serverPort, uploadDirPath) {
    serverPort = serverPort || 5001
    uploadDirPath = uploadDirPath || "logs/client"
    const transport = new LocalhostTcpClientTransport({
        defaultSendOptions: {
            timeoutMillis: 5_000
        }
    });
    const instance = new StandardQuasiHttpClient({
        transport
    });

    try {
        logInfo(`Connecting Tcp.FileClient to ${serverPort}...`);

        await startTransferringFiles(instance, serverPort, uploadDirPath);
    }
    catch (e) {
        logError("Fatal error encountered", e);
    }
}

main()