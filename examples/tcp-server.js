const readline = require('readline/promises')
const {
    StandardQuasiHttpServer
} =  require("kabomu")
const FileReceiver = require("./FileReceiver")
const {
    LocalhostTcpServerTransport
} = require("./LocalhostTcpServerTransport")
const { logDebug, logInfo, logWarn, logError } = require('./AppLogger')
const dotenv = require("dotenv")
dotenv.config()

async function main() {
    port = process.env.PORT || 5001
    uploadDirPath = process.env.SAVE_DIR || "logs/server"
    const instance = new StandardQuasiHttpServer({
        application: FileReceiver.create(port, uploadDirPath)
    });
    const transport = new LocalhostTcpServerTransport({
        port,
        server: instance,
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
        logInfo(`Started Tcp.FileServer at ${port}...`);

        await rL.question("");
    }
    catch (e) {
        logError("Fatal error encountered", e);
    }
    finally {
        rL.close();

        logDebug("Stopping Tcp.FileServer...");
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