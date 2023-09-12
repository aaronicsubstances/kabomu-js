const fs = require('node:fs')
const util = require("node:util")
const { globIterate } = require('glob')
const {
    DefaultQuasiHttpRequest,
    MiscUtils,
    QuasiHttpCodec
} = require("kabomu-js")

async function startTransferringFiles(instance, serverEndpoint, uploadDirPath) {
    let count = 0
    let bytesTransferred  = 0
    const startTime = new Date().getTime()
    const files = globIterate('*', {
        cwd: uploadDirPath,
        nodir: true,
        stat: true,
        withFileTypes: true
    })
    for await (const f of files) {
        console.debug(`Transferring ${f.fullpath()}`)
        await transferFile(instance, serverEndpoint, f)
        console.info(`Successfully transferred ${f.fullpath()}`)
        bytesTransferred += f.size
        count++
    }
    const timeTaken = (new Date().getTime() - startTime) / 1000
    const megaBytesTransferred = bytesTransferred / (1024.0 * 1024.0)
    const rate = (megaBytesTransferred / timeTaken).toFixed(2)
    console.info(util.format(
        "Successfully transferred %s bytes (%s MB) worth of data in %s files" +
        " in %s seconds = %s MB/s",
        bytesTransferred, megaBytesTransferred.toFixed(2),
        count, timeTaken.toFixed(2), rate))
}

async function transferFile(instance, serverEndpoint, f) {
    const request = new DefaultQuasiHttpRequest()
    request.headers = new Map([
        ["f", f.fullpath()]
    ])
    const fd = await fs.promises.open(f.fullpath())
    const fileStream = fd.createReadStream()
    request.contentLength = Math.random() < 0.5 ? -1 : f.size
    request.contentLength = f.size
    request.body = fileStream
    let res
    try {
        res = await instance.send(serverEndpoint, request)
    }
    catch (e) {
        console.info(`File ${f.fullpath()} sent with error`)
        throw e
    }
    if (res.statusCode === QuasiHttpCodec.STATUS_CODE_OK) {
        let responseMsg = ""
        if (res.body) {
            const responseMsgBytes = await MiscUtils.readAllBytes(res.body)
            responseMsg = responseMsgBytes.toString()
        }
        console.info(`File ${f.fullpath()} sent successfully`)
        console.info(`(from server: ${responseMsg})`)
    }
    else {
        let responseMsg = ""
        if (res.body) {
            try {
                const responseMsgBytes = await MiscUtils.readAllBytes(res.body)
                responseMsg = responseMsgBytes.toString()
            }
            catch {
                // ignore.
            }
        }
        throw new Error(`status code indicates error: ${res.statusCode}\n${responseMsg}`)
    }
}

module.exports = {
    startTransferringFiles
}