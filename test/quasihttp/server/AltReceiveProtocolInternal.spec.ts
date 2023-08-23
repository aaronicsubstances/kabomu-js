import nativeAssert from "assert/strict"
import { assert } from "chai"
import { DefaultQuasiHttpRequest } from "../../../src/quasihttp/DefaultQuasiHttpRequest"
import { DefaultQuasiHttpResponse } from "../../../src/quasihttp/DefaultQuasiHttpResponse"
import { AltReceiveProtocolInternal } from "../../../src/quasihttp/server/AltReceiveProtocolInternal"
import { MissingDependencyError } from "../../../src/common/errors"
import {
    IQuasiHttpApplication, IQuasiHttpResponse
} from "../../../src/quasihttp/types"

describe("AltReceiveProtocolInternal", function() {
    describe("#receive", function() {
        it("should pass (1)", async function() {
            const instance = new AltReceiveProtocolInternal(
                null as any,
                new DefaultQuasiHttpRequest()
            )
            await nativeAssert.rejects(async () => {
                await instance.receive()
            }, MissingDependencyError)
        })
        it("should pass (2)", async function() {
            const app: IQuasiHttpApplication = {
                async processRequest(request) {
                    return undefined
                },
            } 
            const instance = new AltReceiveProtocolInternal(
                app,
                new DefaultQuasiHttpRequest()
            )
            const actual = await instance.receive()
            assert.isNotOk(actual)
        })
        it("should pass (3)", async function() {
            const request = new DefaultQuasiHttpRequest();
            const expectedResponse = new DefaultQuasiHttpResponse()
            let actualRequest: (IQuasiHttpResponse | null) = null
            const app: IQuasiHttpApplication = {
                async processRequest(req) {
                    actualRequest = req;
                    return expectedResponse
                },
            } 
            const instance = new AltReceiveProtocolInternal(
                app,
                request
            )
            const actual = await instance.receive()
            assert.strictEqual(actual, expectedResponse)
            assert.strictEqual(actualRequest, request)
        })
    })
})
