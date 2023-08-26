const fs = require('node:fs/promises')
const { globIterate } = require('glob')
const IOUtils = require("kabomu-js/dist/common/IOUtils")
const { bytesToString } = require("kabomu-js/dist/common/ByteUtils")
const { DefaultQuasiHttpRequest } = require("kabomu-js/dist/quasihttp/DefaultQuasiHttpRequest")
const { LambdaBasedQuasiHttpBody } = require("kabomu-js/dist/quasihttp/entitybody/LambdaBasedQuasiHttpBody")
const { getBodyReader } = require("kabomu-js/dist/quasihttp/entitybody/EntityBodyUtils")
const QuasiHttpUtils = require("kabomu-js/dist/quasihttp/QuasiHttpUtils")
const util = require("node:util")

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
    const fd = await fs.open(f.fullpath())
    const fileStream = fd.createReadStream()
    const fLen = Math.random() < 0.5 ? -1 : f.size
    request.body = new LambdaBasedQuasiHttpBody(() => fileStream)
    request.body.ContentLength = fLen
    let res
    try {
        res = await instance.send(serverEndpoint, request)
    }
    catch (e) {
        console.info(`File ${f.fullpath()} sent with error`)
        throw e
    }
    if (!res) {
        console.warn("Received no response.")
        return
    }
    if (res.statusCode === QuasiHttpUtils.STATUS_CODE_OK) {
        console.info(`File ${f.fullpath()} sent successfully`)
    }
    else {
        let responseMsg = ""
        if (res.body) {
            try {
                const responseMsgBytes = await IOUtils.readAllBytes(getBodyReader(res.body))
                responseMsg = bytesToString(responseMsgBytes)
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