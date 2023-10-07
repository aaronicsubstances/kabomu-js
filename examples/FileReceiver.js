const fs = require('node:fs/promises')
const path = require('node:path')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const {
    DefaultQuasiHttpResponse,
    QuasiHttpUtils
} = require("kabomu")
const { logDebug, logInfo, logError } = require('./AppLogger')

exports.create = function(remoteEndpoint, downloadDirPath) {
    return async (request) => {
        return await receiveFileTransfer(request, remoteEndpoint, downloadDirPath)
    }
};

async function receiveFileTransfer(request, remoteEndpoint, downloadDirPath) {
    let fileName = request.headers.get("f")[0]
    fileName = Buffer.from(fileName, "base64").toString()
    fileName = path.basename(fileName)

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
            logDebug(`Starting receipt of file ${fileName} from ${remoteEndpoint}...`)
            await pipeline(request.body, fileStream)
        }
        finally {
            await fileHandle.close()
        }
    }
    catch (e) {
        transferError = e
    }

    const response = new DefaultQuasiHttpResponse()
    let responseBody
    if (!transferError) {
        logInfo(`File ${fileName} received successfully`)
        response.statusCode = QuasiHttpUtils.STATUS_CODE_OK
        const echoBody = request.headers.get("echo-body")
        if (echoBody) {
            responseBody = echoBody.join(",") 
        }
    }
    else {
        logError(`File ${fileName} received with error:`, transferError)
        response.statusCode = QuasiHttpUtils.STATUS_CODE_SERVER_ERROR
        responseBody = transferError.message
    }
    if (responseBody) {
        const responseBytes = Buffer.from(responseBody)
        response.body = Readable.from(responseBytes);
        response.contentLength = -1;
        if (Math.random() < 0.5) {
            response.contentLength = responseBytes.length;
        }
    }

    return response
}