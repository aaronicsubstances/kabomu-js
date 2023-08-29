import nativeAssert from "assert/strict"
import { assert } from "chai"
import { ReceiveTransferInternal } from "../../../src/quasihttp/server/ReceiveTransferInternal"
import { DefaultQuasiHttpResponse } from "../../../src/quasihttp/DefaultQuasiHttpResponse"
import {
    ICancellableTimeoutPromiseInternal,
    IQuasiHttpResponse,
    IReceiveProtocolInternal
} from "../../../src/quasihttp/types"
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody"

class HelperReceiveProtocol implements IReceiveProtocolInternal {
    cancelled = false
    expectedCancelError?: Error
    expectedReceiveError?: Error
    expectedReceiveResult?: IQuasiHttpResponse

    constructor(options: any) {
        this.expectedCancelError = options?.expectedCancelError
        this.expectedReceiveError = options?.expectedReceiveError
        this.expectedReceiveResult = options?.expectedReceiveResult
    }

    async cancel() {
        this.cancelled = true
        if (this.expectedCancelError) {
            throw this.expectedCancelError
        }
    }

    async receive() {
        if (this.expectedReceiveError) {
            throw this.expectedReceiveError
        }
        return this.expectedReceiveResult
    }
}

describe("ReceiveTransferInternal", function() {
    describe("#startProtocol", function() {
        it("should pass (1)", async function() {
            // arrange
            const protocol = new HelperReceiveProtocol({
                expectedReceiveResult: new DefaultQuasiHttpResponse()
            })
            const instance = new ReceiveTransferInternal(protocol)

            // act
            const actual = await instance.startProtocol()

            // assert
            assert.strictEqual(actual, protocol.expectedReceiveResult)
            assert.isOk(protocol.cancelled)
        })
        it("should pass (2)", async function() {
            // arrange
            const protocol = new HelperReceiveProtocol({
                expectedReceiveResult: new DefaultQuasiHttpResponse()
            })
            const instance = new ReceiveTransferInternal(protocol)
            instance.trySetAborted()

            // act
            const actual = await instance.startProtocol()

            // assert
            assert.strictEqual(actual, protocol.expectedReceiveResult)
            assert.isNotOk(protocol.cancelled)
        })
        it("should pass (3)", async function() {
            // arrange
            const protocol = new HelperReceiveProtocol({
                expectedReceiveError: new Error("NIE")
            })
            const instance = new ReceiveTransferInternal(protocol)

            // act and assert error
            await nativeAssert.rejects(async () => {
                await instance.startProtocol()
            }, {
                message: "NIE"
            })
        })
    })

    describe("#abort", function() {
        it("should pass (1)", async function() {
            const protocol = new HelperReceiveProtocol({})
            const instance = new ReceiveTransferInternal(protocol)

            // act
            await instance.abort()

            // assert
            assert.isOk(protocol.cancelled)
        })
        it("should pass (2)", async function() {
            // arrange
            const instance = new ReceiveTransferInternal(
                null as any)

            // act to verify no errors are raised with
            // the missing props
            await instance.abort();
        })
        it("should pass (3)", async function() {
            // arrange
            const instance = new ReceiveTransferInternal(
                null as any)
            instance.trySetAborted()

            // act to verify no errors are raised with
            // the missing props
            await instance.abort();
        })
        it("should pass (4)", async function() {
            // arrange
            const protocol = new HelperReceiveProtocol({})
            const instance = new ReceiveTransferInternal(
                protocol)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal;

            // act
            await instance.abort();

            // assert
            assert.isOk(protocol.cancelled)
            assert.isOk(instance.timeoutId?.isCancellationRequested())
        })
        it("should pass (5)", async function() {
            // arrange
            const protocol = new HelperReceiveProtocol({})
            const instance = new ReceiveTransferInternal(
                protocol)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal;
            instance.trySetAborted()

            // act
            await instance.abort();

            // assert
            assert.isNotOk(protocol.cancelled)
            assert.isNotOk(instance.timeoutId?.isCancellationRequested())
        })
        it("should pass (6)", async function() {
            // arrange
            const protocol = new HelperReceiveProtocol({
                expectedCancelError: new Error("IOE")
            })
            const instance = new ReceiveTransferInternal(protocol)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal;

            // act
            await instance.abort()

            // assert
            assert.isOk(instance.timeoutId?.isCancellationRequested())
            assert.isOk(protocol.cancelled)
        })
    })
})