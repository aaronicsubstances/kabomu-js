import nativeAssert from "assert/strict"
const { assert } = require('chai').use(require('chai-bytes'))
import { Readable } from "node:stream"
import * as IOUtils from "../../src/common/IOUtils"
import { DefaultQuasiHttpResponse } from "../../src/quasihttp/DefaultQuasiHttpResponse"
import { LambdaBasedQuasiHttpBody } from "../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody"
import { getBodyReader } from "../../src/quasihttp/entitybody/EntityBodyUtils"

describe("DefaultQuasiHttpResponse", function() {
    describe("#release", function() {
        it("should pass (1)", async function() {
            const instance = new DefaultQuasiHttpResponse()
            await instance.release();
    
            const stream = Readable.from(
                Buffer.from([18, 19, 34]))
            let endOfReadError: any;
            instance.body = new LambdaBasedQuasiHttpBody(
                () => {
                    if (endOfReadError) {
                        throw endOfReadError
                    }
                    return stream
                })
            instance.body.release = async () => {
                endOfReadError = new Error("release")
            }
            const result = await IOUtils.readAllBytes(
                getBodyReader(instance.body))
            assert.equalBytes(result, Buffer.from([18, 19, 34]))
    
            await instance.release()
            await nativeAssert.rejects(async () => {
                await IOUtils.readBytes(
                    getBodyReader(instance.body), 1)
            }, {
                message: "release"
            })
    
            await instance.release()
        })
    
        it("should pass (2)", async function() {
            const instance = new DefaultQuasiHttpResponse(
                {
                    statusCode: 203,
                    headers: new Map<string, string[]>(
                        [["x", ["x1"]]]),
                    httpStatusMessage: "Done",
                    httpVersion: "1.0",
                    environment: new Map<string, any>(
                        [["y", ["y1", "y2"]]])
                })
    
            assert.deepEqual(instance, {
                statusCode: 203,
                headers: new Map<string, string[]>(
                    [["x", ["x1"]]]),
                httpStatusMessage: "Done",
                httpVersion: "1.0",
                environment: new Map<string, any>(
                    [["y", ["y1", "y2"]]]),
                body: undefined
            })
            await instance.release();
    
            const stream = Readable.from([])
            let endOfReadError: any;
            instance.body = new LambdaBasedQuasiHttpBody(
                () => {
                    if (endOfReadError) {
                        throw endOfReadError
                    }
                    return stream
                })
            instance.body.release = async () => {
                endOfReadError = new Error("release")
            }
            const result = await IOUtils.readBytes(
                getBodyReader(instance.body), 1)
            assert.isNotOk(result)
    
            await instance.release()
            await nativeAssert.rejects(async () => {
                await IOUtils.readBytes(
                    getBodyReader(instance.body), 1)
            }, {
                message: "release"
            })
    
            await instance.release()
        })
    })
})