const {
    StandardQuasiHttpClient
} =  require("kabomu-js")
const { startTransferringFiles } = require("./FileSender")
const {
    LocalhostTcpClientTransport
} = require("./LocalhostTcpClientTransport")

async function main(serverPort, uploadDirPath) {
    serverPort = serverPort || 5001
    uploadDirPath = uploadDirPath || "."
    const transport = new LocalhostTcpClientTransport({
        defaultSendOptions: {
            timeoutMillis: 5_000
        }
    });
    const instance = new StandardQuasiHttpClient({
        transport
    });

    try {
        console.log(`Connecting Tcp.FileClient to ${serverPort}...`);

        await startTransferringFiles(instance, serverPort, uploadDirPath);
    }
    catch (e) {
        console.error("Fatal error encountered", e);
    }
}

main()