import nativeAssert from "assert/strict"
const { assert } = require('chai').use(require('chai-bytes'))
import { Readable } from "node:stream"
import * as IOUtils from "../../src/common/IOUtils"
import { DefaultQuasiHttpRequest } from "../../src/quasihttp/DefaultQuasiHttpRequest"
import { LambdaBasedQuasiHttpBody } from "../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody"
import { getBodyReader } from "../../src/quasihttp/entitybody/EntityBodyUtils"

describe("DefaultQuasiHttpRequest", function() {
    describe("#release", function() {
        it("should pass (1)", async function() {
            const instance = new DefaultQuasiHttpRequest()
            await instance.release();
    
            const stream = Readable.from(
                Buffer.from([2, 5, 9]))
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
            assert.equalBytes(result, Buffer.from([2, 5, 9]))
    
            await instance.release()
            await nativeAssert.rejects(async () => {
                await IOUtils.readBytes(
                    getBodyReader(instance.body),
                    Buffer.alloc(1))
            }, {
                message: "release"
            })
    
            await instance.release()
        })
    
        it("should pass (2)", async function() {
            const instance = new DefaultQuasiHttpRequest(
                {
                    target: "/",
                    headers: new Map<string, string[]>(
                        [["x", ["x1"]]]),
                    method: "GET",
                    httpVersion: "1.0",
                    environment: new Map<string, any>(
                        [["y", ["y1", "y2"]]])
                })
    
            assert.deepEqual(instance, {
                target: "/",
                headers: new Map<string, string[]>(
                    [["x", ["x1"]]]),
                method: "GET",
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
                getBodyReader(instance.body),
                Buffer.alloc(1))
            assert.equal(result, 0)
    
            await instance.release()
            await nativeAssert.rejects(async () => {
                await IOUtils.readBytes(
                    getBodyReader(instance.body),
                    Buffer.alloc(1))
            }, {
                message: "release"
            })
    
            await instance.release()
        })
    })
})