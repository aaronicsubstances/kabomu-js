const {
    StandardQuasiHttpClient
} =  require("kabomu-js")
const { startTransferringFiles } = require("./FileSender")
const {
    IpcClientTransport
} = require("./IpcClientTransport")
const { logInfo, logError } = require("./AppLogger")
const dotenv = require("dotenv")
dotenv.config()

async function main() {
    const serverPath = process.env.IPC_PATH || "logs/34dc4fb1-71e0-4682-a64f-52d2635df2f5.sock"
    const uploadDirPath = process.env.UPLOAD_DIR || "logs/client"
    const transport = new IpcClientTransport({
        defaultSendOptions: {
            timeoutMillis: 5_000
        }
    });
    const instance = new StandardQuasiHttpClient({
        transport
    });

    try {
        logInfo(`Connecting Ipc.FileClient to ${serverPath}...`);

        await startTransferringFiles(instance, serverPath, uploadDirPath);
    }
    catch (e) {
        logError("Fatal error encountered", e);
    }
}

main()