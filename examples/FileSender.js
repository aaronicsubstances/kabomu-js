const fs = require('node:fs/promises')
const util = require("node:util")
const { Writable } = require("node:stream")
const { pipeline } = require('node:stream/promises')
const { globIterate } = require('glob')
const {
    DefaultQuasiHttpRequest,
    QuasiHttpUtils
} = require("kabomu")
const { logDebug, logInfo, logWarn } = require('./AppLogger')

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
        logDebug(`Transferring ${f.fullpath()}`)
        await transferFile(instance, serverEndpoint, f)
        logDebug(`Successfully transferred ${f.fullpath()}`)
        bytesTransferred += f.size
        count++
    }
    const timeTaken = (new Date().getTime() - startTime) / 1000
    const megaBytesTransferred = bytesTransferred / (1024.0 * 1024.0)
    const rate = (megaBytesTransferred / timeTaken).toFixed(2)
    logInfo(util.format(
        "Successfully transferred %s bytes (%s MB) worth of data in %s files" +
        " in %s seconds = %s MB/s",
        bytesTransferred, megaBytesTransferred.toFixed(2),
        count, timeTaken.toFixed(2), rate))
}

async function transferFile(instance, serverEndpoint, f) {
    const request = new DefaultQuasiHttpRequest()
    request.headers = new Map([
        ["f", Buffer.from(f.name).toString("base64")]
    ])
    const echoBodyOn = Math.random() < 0.5;
    if (echoBodyOn) {
        request.headers.set("echo-body", [
            Buffer.from(f.fullpath()).toString("base64")
        ]);
    }

    // add body
    const fd = await fs.open(f.fullpath())
    const fileStream = fd.createReadStream()
    request.body = fileStream
    request.contentLength = -1
    if (Math.random() < 0.5) {
        request.contentLength = f.size
    }

    // determine options
    let sendOptions
    if (Math.random() < 0.5) {
        sendOptions = {
            maxResponseBodySize : -1
        }
    }
    let res
    try {
        if (Math.random() < 0.5) {
            res = await instance.send(serverEndpoint, request,
                sendOptions)
        }
        else {
            res = await instance.send2(serverEndpoint,
                () => Promise.resolve(request), sendOptions)
        }
        if (res.statusCode === QuasiHttpUtils.STATUS_CODE_OK) {
            if (echoBodyOn) {
                let actualResBody = await readableToString(res.body)
                actualResBody = Buffer.from(actualResBody, "base64").toString()
                if (actualResBody != f.fullpath()) {
                    throw new Error("expected echo body to be " +
                        `${f.fullpath()} but got ${actualResBody}`);
                }
            }
            logInfo(`File ${f.fullpath()} sent successfully`)
        }
        else {
            let responseMsg = ""
            if (res.body) {
                try {
                    responseMsg = await readableToString(res.body)
                }
                catch {
                    // ignore.
                }
            }
            throw new Error(`status code indicates error: ${res.statusCode}\n${responseMsg}`)
        }
    }
    catch (e) {
        logWarn(`File ${f.fullpath()} sent with error: ${e.message}`);
        throw e;
    }
    finally {
        await fd.close();
        await res?.release();
    }
}

async function readableToString(stream) {
    const chunks = new Array()
    const writer = new Writable({
        write(chunk, encoding, cb) {
            chunks.push(chunk)
            cb()
        }
    })
    await pipeline(stream, writer);
    return Buffer.concat(chunks).toString()
}

module.exports = {
    startTransferringFiles
}