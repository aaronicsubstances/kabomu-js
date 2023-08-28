import nativeAssert from "assert/strict"
import { assert } from "chai"
import { SendTransferInternal } from "../../../src/quasihttp/client/SendTransferInternal"
import { DefaultQuasiHttpResponse } from "../../../src/quasihttp/DefaultQuasiHttpResponse"
import {
    ICancellableTimeoutPromiseInternal,
    IQuasiHttpResponse,
    ISendProtocolInternal,
    ProtocolSendResultInternal
} from "../../../src/quasihttp/types"
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody"
import { createBlankChequePromise } from "../../../src/common/MiscUtils"

class HelperSendProtocol implements ISendProtocolInternal {
    cancelled = false
    expectedCancelError?: Error
    expectedSendError?: Error
    expectedSendResult?: ProtocolSendResultInternal

    constructor(options: any) {
        this.expectedCancelError = options?.expectedCancelError
        this.expectedSendError = options?.expectedSendError
        this.expectedSendResult = options?.expectedSendResult
    }

    async cancel() {
        this.cancelled = true
        if (this.expectedCancelError) {
            throw this.expectedCancelError
        }
    }

    async send() {
        if (this.expectedSendError) {
            throw this.expectedSendError
        }
        return this.expectedSendResult
    }
}

describe("SendTransferInternal", function() {
    describe("#startProtocol", function() {
        it("should pass (1)", async function() {
            // arrange
            const protocol = new HelperSendProtocol({
                expectedSendResult: {
                } as ProtocolSendResultInternal
            })
            const instance = new SendTransferInternal(
                protocol)
            
            // act
            const actual = await instance.startProtocol()
            
            // assert
            assert.strictEqual(actual, protocol.expectedSendResult)
            assert.isOk(protocol.cancelled)
        })
        it("should pass (2)", async function() {
            // arrange
            const protocol = new HelperSendProtocol({
                expectedSendResult: {
                    response: new DefaultQuasiHttpResponse({
                        body: new StringBody("sth")
                    })
                } as ProtocolSendResultInternal
            })
            const instance = new SendTransferInternal(
                protocol)
            
            // act
            const actual = await instance.startProtocol()
            
            // assert
            assert.strictEqual(actual, protocol.expectedSendResult)
            assert.isNotOk(protocol.cancelled)
        })
        it("should pass (3)", async function() {
            // arrange
            const protocol = new HelperSendProtocol({
                expectedSendResult: {
                } as ProtocolSendResultInternal
            })
            const instance = new SendTransferInternal(
                protocol)
            instance.trySetAborted()
            
            // act
            const actual = await instance.startProtocol()
            
            // assert
            assert.strictEqual(actual, protocol.expectedSendResult)
            assert.isNotOk(protocol.cancelled)
        })
        it("should pass (4)", async function() {
            // arrange
            const protocol = new HelperSendProtocol({
                expectedSendError: new Error("NIE")
            })
            const instance = new SendTransferInternal(
                protocol)
            instance.trySetAborted()
            
            // act and assert error
            await nativeAssert.rejects(async () => {
                await instance.startProtocol()
            }, {
                message: "NIE"
            })
            
            // assert
            assert.isNotOk(protocol.cancelled)
        })
    })

    describe("#abort", function() {
        it("should pass (1)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({})
            const instance = new SendTransferInternal(protocol)
            const cancellationError = undefined
            let responseReleaseCallCount = 0;
            const res: ProtocolSendResultInternal = {
                responseBufferingApplied: true,
                response: {
                    body: new StringBody("ice"),
                    async release() {
                        responseReleaseCallCount++
                    },
                } as IQuasiHttpResponse
            }

            // act
            await instance.abort(cancellationError, res)

            // assert
            assert.equal(responseReleaseCallCount, 0)
            assert.isOk(protocol.cancelled)
        })
        it("should pass (2)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({})
            const instance = new SendTransferInternal(protocol)
            const cancellationError = undefined
            const res: ProtocolSendResultInternal = {}

            // act
            await instance.abort(cancellationError, res)

            // assert
            assert.isOk(protocol.cancelled)
        })
        it("should pass (3)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({})
            const instance = new SendTransferInternal(protocol)
            const cancellationError = undefined
            instance.trySetAborted()

            // act
            await instance.abort(cancellationError, undefined)

            // assert
            assert.isNotOk(protocol.cancelled)
        })
        it("should pass (4)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({})
            const instance = new SendTransferInternal(protocol)
            instance.cancellationTcs = createBlankChequePromise<ProtocolSendResultInternal | undefined>()
            const cancellationError = new Error("IOE")
            const res: ProtocolSendResultInternal = {}

            // act
            await instance.abort(cancellationError, res)

            // assert
            assert.isOk(protocol.cancelled)
            await nativeAssert.rejects(async () => {
                await instance.cancellationTcs?.promise
            }, {
                message: "IOE"
            })
        })
        it("should pass (5)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({})
            const instance = new SendTransferInternal(protocol)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal
            instance.cancellationTcs = createBlankChequePromise<ProtocolSendResultInternal | undefined>()
            const cancellationError = undefined
            var responseReleaseCallCount = 0;
            const res: ProtocolSendResultInternal = {
                response: {
                    body: new StringBody("unbuffered"),
                    async release() {
                        responseReleaseCallCount++
                        throw new Error("should not be called");
                    },
                } as IQuasiHttpResponse
            }

            // act
            await instance.abort(cancellationError, res)

            // assert
            assert.isNotOk(protocol.cancelled)
            assert.isOk(instance.timeoutId?.isCancellationRequested())
            assert.equal(responseReleaseCallCount, 0)
            assert.isOk(instance.cancellationTcs)
            assert.isNotOk(await instance.cancellationTcs!.promise)
        })
        it("should pass (6)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({})
            const instance = new SendTransferInternal(protocol)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal
            instance.trySetAborted()
            const cancellationError = undefined
            var responseReleaseCallCount = 0;
            const res: ProtocolSendResultInternal = {
                response: {
                    body: new StringBody("unbuffered"),
                    async release() {
                        responseReleaseCallCount++
                        throw new Error("should be ignored");
                    },
                } as IQuasiHttpResponse
            }

            // act
            await instance.abort(cancellationError, res)

            // assert
            assert.isNotOk(protocol.cancelled)
            assert.isNotOk(instance.timeoutId?.isCancellationRequested())
            assert.equal(responseReleaseCallCount, 1)
        })
        it("should pass (7)", async function() {
            // arrange
            const instance = new SendTransferInternal(null as any)
            const cancellationError = undefined
            const res: ProtocolSendResultInternal = {
                responseBufferingApplied: false,
                response: new DefaultQuasiHttpResponse({
                    body: new StringBody('ice')
                })
            }

            // act and assert that
            // null protocol was not called.
            await instance.abort(cancellationError, res);
        })
        it("should pass (8)", async function() {
            // arrange
            const instance = new SendTransferInternal(null as any)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal
            instance.cancellationTcs = createBlankChequePromise<ProtocolSendResultInternal | undefined>()
            const cancellationError = undefined
            const res: ProtocolSendResultInternal = {
                responseBufferingApplied: true
            }

            // act and assert that
            // null protocol was not called.
            await instance.abort(cancellationError, res);

            assert.isOk(instance.timeoutId?.isCancellationRequested())
            assert.isOk(instance.cancellationTcs)
            assert.isNotOk(await instance.cancellationTcs!.promise)
        })
        it("should pass (9)", async function() {
            // arrange
            const protocol  = new HelperSendProtocol({
                expectedCancelError: new Error("IOE")
            })
            const instance = new SendTransferInternal(protocol)
            let cancelled = false
            instance.timeoutId = {
                isCancellationRequested() {
                    return cancelled
                },
                cancel() {
                    cancelled = true
                },
            } as ICancellableTimeoutPromiseInternal
            instance.cancellationTcs = createBlankChequePromise<ProtocolSendResultInternal | undefined>()
            var responseReleaseCallCount = 0;
            const res: ProtocolSendResultInternal = {
                response: {
                    body: new StringBody("deal"),
                    async release() {
                        responseReleaseCallCount++
                    },
                } as IQuasiHttpResponse
            }
            const cancellationError = new Error("NSE")

            // act
            await instance.abort(cancellationError, res)

            // assert
            assert.isOk(instance.timeoutId?.isCancellationRequested())
            assert.isOk(protocol.cancelled)
            assert.equal(responseReleaseCallCount, 0)
            assert.isOk(instance.cancellationTcs)
            await nativeAssert.rejects(async () => {
                await instance.cancellationTcs?.promise
            }, {
                message: "NSE"
            })
        })
    })
})