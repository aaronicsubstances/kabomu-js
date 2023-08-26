const { StandardQuasiHttpClient } = require("kabomu-js")
const FileSender = require("shared/FileSender")
const dotenv = require("dotenv")
const { parseInt32 } = require("kabomu-js/dist/common/ByteUtils")
const { LocalhostTcpClientTransport } = require("shared/LocalhostTcpClientTransport")

async function main() {
    // load environment variables.
    dotenv.config()
    
    const transport = new LocalhostTcpClientTransport()
    const serverPort = parseInt32(process.env.SERVER_PORT || 5000)
    const uploadDirPath = process.env.UPLOAD_DIR || "."
    const defaultSendOptions = {
        timeoutMillis: 5_000
    }
    const instance = new StandardQuasiHttpClient({
        defaultSendOptions,
        transport
    })

    try {
        console.info(`Connecting Tcp.FileClient to ${serverPort}...`);

        await FileSender.startTransferringFiles(instance, serverPort, uploadDirPath);
    }
    catch (e) {
        console.info("Fatal error encountered", e);
    }
}

main()
