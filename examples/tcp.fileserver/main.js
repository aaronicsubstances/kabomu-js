const { StandardQuasiHttpServer } = require("kabomu-js")
const FileReceiver = require("shared/FileReceiver")
const dotenv = require("dotenv")
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { LocalhostTcpServerTransport } = require("shared/LocalhostTcpServerTransport")
const { parseInt32 } = require("kabomu-js/dist/common/ByteUtils")

async function main() {
    // load environment variables.
    dotenv.config()
    const rl = readline.createInterface({ input, output });
    
    const port = parseInt32(process.env.PORT || 5000)
    // use default dir which is already git ignored.
    const uploadDirPath = process.env.UPLOAD_DIR || "logs"
    const defaultProcessingOptions = {
        timeoutMillis: 5_000
    };
    const instance = new StandardQuasiHttpServer({
        defaultProcessingOptions,
    });
    instance.application = FileReceiver.create(port, uploadDirPath)
    const transport = new LocalhostTcpServerTransport(port, instance)
    instance.transport = transport

    try {
        await transport.start()
        console.info(`Created Tcp.FileServer at ${port}`)
        
        await rl.question('');
    }
    catch (e) {
        console.error("Fatal error encountered", e);
    }
    finally {
        rl.close()
        console.debug("Stopping Tcp.FileServer...")
        await transport.stop()
    }
}

main()
