const readline = require('readline/promises')
const {
    StandardQuasiHttpServer
} =  require("kabomu")
const FileReceiver = require("./FileReceiver")
const {
    IpcServerTransport
} = require("./IpcServerTransport")
const { logDebug, logInfo, logWarn, logError } = require('./AppLogger')
const dotenv = require("dotenv")
dotenv.config()

async function main() {
    const ipcPath = process.env.IPC_PATH || "logs/34dc4fb1-71e0-4682-a64f-52d2635df2f5.sock"
    const uploadDirPath = process.env.SAVE_DIR || "logs/server"
    const instance = new StandardQuasiHttpServer({
        application: FileReceiver.create(ipcPath, uploadDirPath)
    });
    const transport = new IpcServerTransport({
        ipcPath,
        quasiHttpServer: instance,
        defaultProcessingOptions : {
            timeoutMillis: 5_000
        }
    });
    instance.transport = transport

    const rL = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    try {
        await transport.start();
        logInfo(`Started Ipc.FileServer at ${ipcPath}...`);

        await rL.question("");
    }
    catch (e) {
        logError("Fatal error encountered", e);
    }
    finally {
        rL.close();

        logDebug("Stopping Ipc.FileServer...");
        await transport.stop();

         // don't wait for remainder of ongoing
         // connections to complete.
        process.exit(0)
    }
}

process.on('SIGINT', function() {
    logWarn( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
    process.exit(0);
});

main()