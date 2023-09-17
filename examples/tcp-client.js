const {
    StandardQuasiHttpClient
} =  require("kabomu-js")
const { startTransferringFiles } = require("./FileSender")
const {
    LocalhostTcpClientTransport
} = require("./LocalhostTcpClientTransport")
const { logInfo, logError } = require("./AppLogger")
const dotenv = require("dotenv")
dotenv.config()

async function main(serverPort, uploadDirPath) {
    serverPort = process.env.PORT || 5001
    uploadDirPath = process.env.UPLOAD_DIR || "logs/client"
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