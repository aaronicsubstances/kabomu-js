import nativeAssert from "assert/strict"
const { expect, assert } = require("chai").use(require("chai-bytes"))
import { test } from "mocha"
import { CustomIOError, ExpectationViolationError } from "../../../src/common/errors"
import { AltSendProtocolInternal } from "../../../src/quasihttp/client/AltSendProtocolInternal"
import {
    IQuasiHttpAltTransport,
    IQuasiHttpBody,
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    QuasiHttpSendOptions,
    QuasiHttpSendResponse
} from "../../../src/quasihttp/types"
import { ByteBufferBody } from "../../../src/quasihttp/entitybody/ByteBufferBody"
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody"
import { Readable, Writable } from "stream"
import * as QuasiHttpUtils from "../../../src/quasihttp/QuasiHttpUtils"
import * as ByteUtils from "../../../src/common/ByteUtils"
import {
    compareResponsesInvolvingUnknownSources
} from "../../shared/ComparisonUtils"
import { DefaultQuasiHttpResponse } from "../../../src/quasihttp/DefaultQuasiHttpResponse"

class HelperQuasiHttpAltTransport implements IQuasiHttpAltTransport {
    actualCancellationHandle: any

    processSendRequest(
            remoteEndpoint: any,
            request: IQuasiHttpRequest,
            sendOptions?: QuasiHttpSendOptions | undefined)
            : QuasiHttpSendResponse {
        throw new Error("Method not implemented.")
    }
    processSendRequest2(
            remoteEndpoint: any,
            requestFunc: (env: Map<string, any>) => Promise<IQuasiHttpRequest>,
            sendOptions?: QuasiHttpSendOptions | undefined)
            : QuasiHttpSendResponse {
        throw new Error("Method not implemented.")
    }
    cancelSendRequest(sendCancellationHandle: any): void {
        this.actualCancellationHandle = sendCancellationHandle
    }
}

class ErrorQuasiHttpBody implements IQuasiHttpBody {
    get contentLength(): number {
        throw new Error("Method not implemented.")
    }
    getReader(): Readable | null {
        throw new Error("Method not implemented.")
    }
    release(): Promise<void> {
        throw new Error("Method not implemented.")
    }
    writeBytesTo(writer: Writable): Promise<void> {
        throw new Error("Method not implemented.")
    }

}

describe("AltSendProtocolInternal", function() {
    test("send for argument errors", async function() {
        await nativeAssert.rejects(async () => {
            const instance = new AltSendProtocolInternal(null as any)
            await instance.send()
        }, ExpectationViolationError)
        await nativeAssert.rejects(async () => {
            const instance = new AltSendProtocolInternal({
                responsePromise: Promise.resolve(null),
                transportBypass: null as any,
                ensureNonNullResponse: true
            })
            await instance.send()
        }, (err: any) => {
            expect(err.message).to.contain("no response")
            return true
        })
    })

    test("send for no response", async function() {
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(null),
            transportBypass: transport,
            ensureNonNullResponse: false
        })
        const actual = await instance.send()
        assert.isNull(actual)
    })

    test("send ensures release on receiving error response (1)", async function() {
        let responseReleaseCallCount = 0
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
                throw new Error("should be ignored")
            },
            body: new ErrorQuasiHttpBody()
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            transportBypass: transport,
            responsePromise: Promise.resolve(expectedResponse),
            sendCancellationHandle: {},
            responseBufferingEnabled: true,
            ensureNonNullResponse: true
        })
        await nativeAssert.rejects(async () => {
            await instance.send()
        }, {
            message: "Method not implemented."
        })
        assert.equal(responseReleaseCallCount, 1)
        await instance.cancel()
        assert.strictEqual(transport.actualCancellationHandle,
            instance.sendCancellationHandle)
    })
    
    test("send ensures release on receiving error response (1)", async function() {
        let responseReleaseCallCount = 0;
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
            },
            body: new StringBody("too much!")
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            transportBypass: transport,
            responsePromise: Promise.resolve(expectedResponse),
            sendCancellationHandle: {},
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 5,
            ensureNonNullResponse: true
        })
        await nativeAssert.rejects(async () => {
            await instance.send()
        }, (err: any) => {
            assert.instanceOf(err, CustomIOError)
            assert.include(err.message, "limit of 5")
            return true
        })
        assert.equal(responseReleaseCallCount, 1)

        await instance.cancel()
        assert.strictEqual(transport.actualCancellationHandle,
            instance.sendCancellationHandle)
    })

    test("send response buffering disabled and body present (1)", async function() {
        let responseReleaseCallCount = 0;
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
            },
            body: new StringBody("tea")
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(expectedResponse),
            responseBufferingEnabled: false,
            transportBypass: transport,
            ensureNonNullResponse: true
        })
        const res = await instance.send()
        assert.equal(responseReleaseCallCount, 0)
        assert.strictEqual(res?.response, expectedResponse)
        assert.isNotOk(res?.responseBufferingApplied)

        // test successful cancellation due to null cancellation handle
        await instance.cancel();
        assert.isNotOk(transport.actualCancellationHandle);
    })

    test("send response buffering disabled and body present (2)", async function() {
        let responseReleaseCallCount = 0;
        const expectedResponse: IQuasiHttpResponse = {
            body: new StringBody("tea"),
            environment: new Map([
                [
                    QuasiHttpUtils.RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED,
                    true
                ]
            ]),
            async release() {
                responseReleaseCallCount++
                throw new Error("should be ignored");
            },
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(expectedResponse),
            responseBufferingEnabled: false,
            transportBypass: transport,
            ensureNonNullResponse: true
        })
        const res = await instance.send()
        assert.equal(responseReleaseCallCount, 1)
        assert.strictEqual(res?.response, expectedResponse)
        assert.isOk(res?.responseBufferingApplied)

        await instance.cancel();
        assert.strictEqual(transport.actualCancellationHandle,
            instance.sendCancellationHandle);
    })

    test("send response buffering disabled and body absent", async function() {
        let responseReleaseCallCount = 0
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
            },
            environment: new Map([
                [
                    QuasiHttpUtils.RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED,
                    null
                ]
            ])
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(expectedResponse),
            responseBufferingEnabled: false,
            transportBypass: transport,
            sendCancellationHandle: [],
            ensureNonNullResponse: true
        })
        const res = await instance.send()
        assert.equal(responseReleaseCallCount, 1)
        assert.strictEqual(res?.response, expectedResponse)
        assert.isNotOk(res?.responseBufferingApplied)

        await instance.cancel()
        assert.strictEqual(transport.actualCancellationHandle,
            instance.sendCancellationHandle)
    })

    test("send response buffering enabled and body absent (1)", async function() {
        let responseReleaseCallCount = 0
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
                throw new Error("should be ignored");
            },
            environment: new Map([
                [
                    QuasiHttpUtils.RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED,
                    true
                ]
            ])
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(expectedResponse),
            responseBufferingEnabled: true,
            transportBypass: transport,
            ensureNonNullResponse: true
        })
        const res = await instance.send()
        assert.equal(responseReleaseCallCount, 1)
        assert.strictEqual(res?.response, expectedResponse)
        assert.isOk(res?.responseBufferingApplied)

        // test successful cancellation due to null cancellation handle
        await instance.cancel()
        assert.isNotOk(transport.actualCancellationHandle)
    })

    test("send response buffering enabled and body absent (2)", async function() {
        let responseReleaseCallCount = 0
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
            }
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(expectedResponse),
            responseBufferingEnabled: true,
            transportBypass: transport,
            ensureNonNullResponse: true
        })
        const res = await instance.send()
        assert.equal(responseReleaseCallCount, 1)
        assert.strictEqual(res?.response, expectedResponse)
        assert.isNotOk(res?.responseBufferingApplied)

        // test successful cancellation due to null cancellation handle
        await instance.cancel()
        assert.isNotOk(transport.actualCancellationHandle)
    })

    test("send response buffering enabled and body present (1)", async function() {
        const expectedResBodyBytes = ByteUtils.stringToBytes("just enough");
        let responseReleaseCallCount = 0;
        const expectedResponse: IQuasiHttpResponse = {
            statusCode: 0,
            body: new ByteBufferBody(expectedResBodyBytes),
            async release() {
                responseReleaseCallCount++
            },
        }
        const transport = new HelperQuasiHttpAltTransport()
        const instance = new AltSendProtocolInternal({
            responsePromise: Promise.resolve(expectedResponse),
            transportBypass: transport,
            responseBufferingEnabled: true,
            ensureNonNullResponse: true
        })
        const response = await instance.send()
        assert.equal(responseReleaseCallCount, 1)
        assert.isOk(response?.responseBufferingApplied)

        await compareResponsesInvolvingUnknownSources(
            response?.response, expectedResponse,
            expectedResBodyBytes)
        assert.equal(response?.response?.environment,
            expectedResponse.environment)
        
        await instance.cancel()
        assert.isNotOk(transport.actualCancellationHandle)
    })

    describe("send response buffering enabled and body present (2)", function() {
        const createTestSendResponseBufferingEnabledAndBodyPresentData =
            function*() {
                let responseBodyBufferingLimit = 0;
                let sendCancellationHandle: any = null;
                let expectedResBodyBytes = Buffer.alloc(0);
                let expectedResponse = new DefaultQuasiHttpResponse({
                    body: new ByteBufferBody(expectedResBodyBytes)
                })
                yield {
                    responseBodyBufferingLimit,
                    sendCancellationHandle,
                    expectedResBodyBytes,
                    expectedResponse
                }

                responseBodyBufferingLimit = 0
                sendCancellationHandle = {}
                expectedResBodyBytes = Buffer.alloc(0)
                expectedResponse = new DefaultQuasiHttpResponse({
                    statusCode: 200,
                    httpVersion: "",
                    headers: new Map(),
                    body: new ByteBufferBody(expectedResBodyBytes)
                })
                expectedResponse.body!.contentLength = -1
                yield {
                    responseBodyBufferingLimit,
                    sendCancellationHandle,
                    expectedResBodyBytes,
                    expectedResponse
                }

                sendCancellationHandle = {}
                expectedResBodyBytes = ByteUtils.stringToBytes("abcdef")
                responseBodyBufferingLimit = expectedResBodyBytes.length
                expectedResponse = new DefaultQuasiHttpResponse({
                    body: new ByteBufferBody(expectedResBodyBytes)
                })
                expectedResponse.body!.contentLength = -1
                yield {
                    responseBodyBufferingLimit,
                    sendCancellationHandle,
                    expectedResBodyBytes,
                    expectedResponse
                }

                sendCancellationHandle = null
                expectedResBodyBytes = ByteUtils.stringToBytes("abcdef")
                responseBodyBufferingLimit = expectedResBodyBytes.length
                expectedResponse = new DefaultQuasiHttpResponse({
                    body: new ByteBufferBody(expectedResBodyBytes),
                    environment: new Map([
                        [ "scheme", "shivers" ]
                    ])
                })
                expectedResponse.body!.contentLength = -1
                yield {
                    responseBodyBufferingLimit,
                    sendCancellationHandle,
                    expectedResBodyBytes,
                    expectedResponse
                }

                sendCancellationHandle = {}
                expectedResBodyBytes = ByteUtils.stringToBytes("abcdef")
                responseBodyBufferingLimit = 8
                expectedResponse = new DefaultQuasiHttpResponse({
                    statusCode: 404,
                    httpStatusMessage: "not found",
                    httpVersion: "1.1",
                    headers: new Map([
                        [ "one", "1" as any ],
                        [ "two", ["2", "2"] ],
                        [ "three", ["3", "3", "3"] ],
                        [ "four", ["4", "4", "4", "4"] ]
                    ]),
                    body: new ByteBufferBody(expectedResBodyBytes),
                    environment: new Map()
                })
                expectedResponse.body!.contentLength = -1
                yield {
                    responseBodyBufferingLimit,
                    sendCancellationHandle,
                    expectedResBodyBytes,
                    expectedResponse
                }
            }
        let i = 0
        for (const testDataItem of
                createTestSendResponseBufferingEnabledAndBodyPresentData()) {
            i++
            const {
                responseBodyBufferingLimit,
                sendCancellationHandle,
                expectedResBodyBytes,
                expectedResponse
            } = testDataItem;
            it(`should pass with input ${i}`, async function() {
                const transport = new HelperQuasiHttpAltTransport()
                const instance = new AltSendProtocolInternal({
                    responsePromise: Promise.resolve(expectedResponse),
                    transportBypass: transport,
                    sendCancellationHandle: sendCancellationHandle,
                    responseBufferingEnabled: true,
                    responseBodyBufferingSizeLimit: responseBodyBufferingLimit,
                    ensureNonNullResponse: true
                })
                const response = await instance.send()
                assert.isOk(response?.responseBufferingApplied)

                await compareResponsesInvolvingUnknownSources(
                    response?.response, expectedResponse,
                    expectedResBodyBytes)
                assert.deepEqual(response?.response?.environment,
                    expectedResponse.environment)
                
                await instance.cancel()
                // didn't use strictEqual due to need to treat
                // null and undefined as equal.
                assert.equal(transport.actualCancellationHandle,
                    sendCancellationHandle)
            })
        }
    })
})
