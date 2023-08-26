const fs = require('fs')
const path = require('path')
const { IOUtils } = require("kabomu-js/common")
const {
    DefaultQuasiHttpResponse,
    getBodyReader,
    QuasiHttpUtils
} = require("kabomu-js/quasihttp")

exports.create = function(remoteEndpoint, downloadDirPath) {
    return {
        async processRequest(request) {
            return await receiveFileTransfer(request, remoteEndpoint, downloadDirPath)
        }
    }
}

async function receiveFileTransfer(request, remoteEndpoint, downloadDirPath) {
    const fileName = path.basename(request.headers.get("f")[0])
    console.debug(`Starting receipt of file ${fileName} from ${remoteEndpoint}...`)

    let transferError
    try {
        // ensure directory exists.
        // just in case remote endpoint contains invalid file path characters...
        const pathForRemoteEndpoint = `${remoteEndpoint}`.replace(/\W/g, "_")
        const directory = path.resolve(downloadDirPath, pathForRemoteEndpoint)
        await fs.promises.mkdir(directory, {
            recursive: true
        })
        const p = path.resolve(directory, fileName)
        const fileStream = fs.createWriteStream(p)
        const reader = getBodyReader(request.body)
        await IOUtils.copyBytes(reader, fileStream)
        await IOUtils.endWrites(fileStream)
    }
    catch (e) {
        transferError = e
    }

    const response = new DefaultQuasiHttpResponse()
    if (!transferError) {
        console.info(`File ${fileName} received successfully`)
        response.statusCode = QuasiHttpUtils.STATUS_CODE_OK
    }
    else {
        console.info(`File ${fileName} received with error:`, transferError)
        response.statusCode = QuasiHttpUtils.STATUS_CODE_SERVER_ERROR
        response.httpStatusMessage = transferError.message
    }

    return response
}