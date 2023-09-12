const readline = require('readline/promises')
const {
    StandardQuasiHttpServer
} =  require("kabomu-js")
const FileReceiver = require("./FileReceiver")
const {
    LocalhostTcpServerTransport
} = require("./LocalhostTcpServerTransport")

async function main(port, uploadDirPath) {
    port = port || 5001
    uploadDirPath = uploadDirPath || "logs"
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
        console.log(`Started Tcp.FileServer at ${port}...`);

        await rL.question("");
    }
    catch (e) {
        console.error("Fatal error encountered", e);
    }
    finally {
        rL.close();

        console.debug("Stopping Tcp.FileServer...");
        await transport.stop();

         // don't wait for remainder of ongoing
         // connections to complete.
        process.exit(0)
    }
}

process.on('SIGINT', function() {
    console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
    process.exit(0);
});

main()