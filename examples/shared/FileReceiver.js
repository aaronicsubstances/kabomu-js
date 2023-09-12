const fs = require('node:fs/promises')
const path = require('node:path')
const { Readable } = require('node:stream')
const {
    DefaultQuasiHttpResponse,
    MiscUtils,
    QuasiHttpCodec
} = require("kabomu-js")

exports.create = function(remoteEndpoint, downloadDirPath) {
    return async (request) => {
        return await receiveFileTransfer(request, remoteEndpoint, downloadDirPath)
    }
};

async function receiveFileTransfer(request, remoteEndpoint, downloadDirPath) {
    const fileName = path.basename(request.headers.get("f")[0])
    console.info(`Starting receipt of file ${fileName} from ${remoteEndpoint}...`)

    let transferError
    try {
        // ensure directory exists.
        // just in case remote endpoint contains invalid file path characters...
        const pathForRemoteEndpoint = `${remoteEndpoint}`.replace(/\W/g, "_")
        const directory = path.resolve(downloadDirPath, pathForRemoteEndpoint)
        await fs.mkdir(directory, {
            recursive: true
        })
        const filePath = path.resolve(directory, fileName)
        const fileHandle = await fs.open(filePath, "w")
        const fileStream = fileHandle.createWriteStream();
        try {
            console.debug("about to save to file")
            await MiscUtils.copyBytes(request.body, fileStream)
            console.debug("saved to file")
        }
        finally {
            await fileHandle.close()
        }
    }
    catch (e) {
        transferError = e
    }

    const response = new DefaultQuasiHttpResponse()
    if (!transferError) {
        console.info(`File ${fileName} received successfully`)
        response.statusCode = QuasiHttpCodec.STATUS_CODE_OK
    }
    else {
        console.info(`File ${fileName} received with error:`, transferError)
        response.statusCode = QuasiHttpCodec.STATUS_CODE_SERVER_ERROR
    }
    if (transferError || fileName.length > 10) {
        const responseBytes = MiscUtils.stringToBytes(transferError?.message ?? "done");
        response.body = Readable.from(responseBytes);
        response.contentLength = Math.random() < 0.5 ? -1 :
            responseBytes.length;
        response.contentLength = responseBytes.length
    }

    return response
}