const {
    StandardQuasiHttpClient
} =  require("kabomu")
const { startTransferringFiles } = require("./FileSender")
const {
    LocalhostTcpClientTransport
} = require("./LocalhostTcpClientTransport")
const { logInfo, logError } = require("./AppLogger")
const dotenv = require("dotenv")
dotenv.config()

async function main() {
    const serverPort = process.env.PORT || 5001
    const uploadDirPath = process.env.UPLOAD_DIR || "logs/client"
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