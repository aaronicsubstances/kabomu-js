import nativeAssert from "assert/strict"
const { expect, assert } = require("chai").use(require("chai-bytes"))
import util from "node:util"
import { StandardQuasiHttpClient } from "../../src/quasihttp/client/StandardQuasiHttpClient"
import { StandardQuasiHttpServer } from "../../src/quasihttp/server/StandardQuasiHttpServer"
import { MemoryBasedClientTransport } from "../shared/quasihttp/MemoryBasedClientTransport"
import { DefaultQuasiHttpRequest } from "../../src/quasihttp/DefaultQuasiHttpRequest"
import { QuasiHttpRequestProcessingError } from "../../src/quasihttp/errors"
import { appLogger } from "../shared/common/LogManager"
import { MemoryBasedServerTransport } from "../shared/quasihttp/MemoryBasedServerTransport"
import { IQuasiHttpRequest, QuasiHttpSendOptions } from "../../src/quasihttp/types"
import { DefaultQuasiHttpResponse } from "../../src/quasihttp/DefaultQuasiHttpResponse"
import * as ComparisonUtils from "../shared/common/ComparisonUtils"
import { createDelayPromise } from "../../src/common/MiscUtils"

const logger = appLogger.child({
    label: "StandardClientServer2.spec"
})

describe("StandardClientServer2", function() {
    it("test no connection (1)", async function() {
        // should cause connection allocation problem from
        // null reference exception on servers property
        const clientTransport = new MemoryBasedClientTransport(null as any)

        const client = new StandardQuasiHttpClient({
            transport: clientTransport
        })
        const remoteEndpoint = "seed"
        const request = new DefaultQuasiHttpRequest()
        const options = undefined
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint, request, options)
        }, (e: any) => {
            logger.info("actual error from test no connection (1)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("send request processing")
            return true
        })
    })
    it("test no connection (2)", async function() {
        const remoteEndpoint = "seed2"
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, undefined as any]
            ]))
        const client = new StandardQuasiHttpClient({
            transport: clientTransport
        })
        const request = new DefaultQuasiHttpRequest()
        const options = undefined
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint, request, options)
        }, (e: any) => {
            logger.info("actual error from test no connection (2)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("no connection")
            return true
        })
    })
    it("test no connection (3)", async function() {
        const remoteEndpoint = "seed3"
        const clientTransport = new MemoryBasedClientTransport(
            new Map())
        const client = new StandardQuasiHttpClient({
            transport: clientTransport
        })
        const request = new DefaultQuasiHttpRequest()
        const options = undefined
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint, request, options)
        }, (e: any) => {
            logger.info("actual error from test no connection (3)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("no connection")
            return true
        })
    })

    it("test request func yield no request (1)", async function() {
        const remoteEndpoint = "seed3"
        const server = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                // do nothing.
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server]
            ]))
        const client = new StandardQuasiHttpClient({
            transport: clientTransport
        })
        let actualReqEnv = undefined
        const requestFunc = async (reqEnv: any) => {
            actualReqEnv = reqEnv
            return undefined
        }
        const options: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                [ "scheme", "https" ]
            ]),
            ensureTruthyResponse: false,
            responseBufferingEnabled: false
        }
        const expectedSendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                [ "scheme", "https" ]
            ]),
            maxChunkSize: 0,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: false,
            responseBufferingEnabled: false,
            timeoutMillis: 0
        }
        await nativeAssert.rejects(async () => {
            const interimResult = client.send2(
                remoteEndpoint, requestFunc, options)
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from " +
                "test request func yield no request (1)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("no request")
            return true
        })

        // also check the environment passed to the request func.
        assert.equal(clientTransport.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(clientTransport.actualSendOptions,
            expectedSendOptions)
        assert.deepEqual(actualReqEnv,
            expectedSendOptions.extraConnectivityParams)
    })

    it("test request func yield no request (2)", async function() {
        const remoteEndpoint = 345
        const server = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                // do nothing.
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server]
            ]))
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                extraConnectivityParams: new Map<string, any>([
                    ["one", 1],
                    ["scheme", "plus"]
                ]),
                timeoutMillis: -1
            }
        })
        let actualReqEnv = undefined
        const requestFunc = async (reqEnv: any) => {
            actualReqEnv = reqEnv
            throw new Error("IOE: error from req func")
        }
        const options: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                [ "scheme", "https" ]
            ]),
            timeoutMillis: -2
        }
        const expectedSendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                [ "scheme", "https" ],
                [ "one", 1 ]
            ]),
            maxChunkSize: 0,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true,
            responseBufferingEnabled: true,
            timeoutMillis: -2
        }
        await nativeAssert.rejects(async () => {
            const interimResult = client.send2(
                remoteEndpoint, requestFunc, options)
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from " +
                "test request func yield no request (2)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("send request processing")
            assert.isOk(e.cause)
            expect(e.cause.message).to.contain("IOE: error from req func")
            return true
        })

        // check that the environment is passed in has been merged correctly
        // with default.
        assert.equal(clientTransport.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(clientTransport.actualSendOptions,
            expectedSendOptions)
        assert.deepEqual(actualReqEnv,
            expectedSendOptions.extraConnectivityParams)
    })

    it("test request func yield", async function() {
        const remoteEndpoint = []
        const expectedResponse = new DefaultQuasiHttpResponse()
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    return expectedResponse
                },
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ]))
        const client = new StandardQuasiHttpClient({
            transport: clientTransport
        })
        const expectedRequest = new DefaultQuasiHttpRequest()
        let actualReqEnv: any
        const requestFunc = async (reqEnv: any) => {
            actualReqEnv = reqEnv
            return expectedRequest
        }
        const interimResult = client.send2(remoteEndpoint, requestFunc)
        const actualResponse = await interimResult.responsePromise
        assert.isOk(serverPromise)
        await ComparisonUtils.compareRequests(actualRequest,
            expectedRequest, undefined)
        await ComparisonUtils.compareResponses(actualResponse,
            expectedResponse, undefined)

        // check that empty default environment is passed in to req func,
        // since MemoryBasedClientTransport uses merged connectivity params
        const expectedSendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            ensureTruthyResponse: true,
            responseBufferingEnabled: true,
            maxChunkSize: 0,
            responseBodyBufferingSizeLimit: 0,
            timeoutMillis: 0
        }
        assert.equal(clientTransport.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(clientTransport.actualSendOptions,
            expectedSendOptions)
        assert.deepEqual(actualReqEnv,
            expectedSendOptions.extraConnectivityParams)
    })

    it("test no timeout (1)", async function() {
        this.timeout(5_000)
        const remoteEndpoint = []
        const expectedResponse = new DefaultQuasiHttpResponse()
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    await createDelayPromise(2_000)
                    return expectedResponse
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 4_000
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 5_000
            }
        })
        const expectedRequest = new DefaultQuasiHttpRequest({
            environment: new Map()
        })
        let actualReqEnv: any
        const requestFunc = async (reqEnv: any) => {
            actualReqEnv = reqEnv
            await createDelayPromise(1_000)
            return expectedRequest
        }
        const sendOptions = {}
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, sendOptions)
        const actualResponse = await interimResult.responsePromise
        assert.isOk(serverPromise)
        await ComparisonUtils.compareRequests(actualRequest,
            expectedRequest, undefined)
        await ComparisonUtils.compareResponses(actualResponse,
            expectedResponse, undefined)
        const expectedSendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: 5_000,
            ensureTruthyResponse: true,
            responseBufferingEnabled: true,
            maxChunkSize: 0,
            responseBodyBufferingSizeLimit: 0
        }
        assert.equal(clientTransport.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(clientTransport.actualSendOptions,
            expectedSendOptions)
        assert.deepEqual(actualReqEnv,
            expectedSendOptions.extraConnectivityParams)
    })

    it("test no timeout (2)", async function() {
        this.timeout(5_000)
        const remoteEndpoint = []
        const expectedResponse = new DefaultQuasiHttpResponse()
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    await createDelayPromise(2_000)
                    return expectedResponse
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 4_000
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 5_000
            }
        })
        const expectedRequest = new DefaultQuasiHttpRequest({
            environment: new Map()
        })
        const requestFunc = async (reqEnv: any) => {
            await createDelayPromise(1_000)
            return expectedRequest
        }
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, undefined)
        const actualResponse = await interimResult.responsePromise
        assert.isOk(serverPromise)
        await ComparisonUtils.compareRequests(actualRequest,
            expectedRequest, undefined)
        await ComparisonUtils.compareResponses(actualResponse,
            expectedResponse, undefined)
    })

    it("test no timeout due to ignore timeout settings", async function() {
        this.timeout(5_000)
        const remoteEndpoint = []
        const expectedResponse = new DefaultQuasiHttpResponse()
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    await createDelayPromise(2_000)
                    return expectedResponse
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 4_000
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            ignoreTimeoutSettings: true
        })
        const expectedRequest = new DefaultQuasiHttpRequest({
            environment: new Map()
        })
        const requestFunc = async (reqEnv: any) => {
            await createDelayPromise(1_000)
            return expectedRequest
        }
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: 700
        }
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, sendOptions)
        const actualResponse = await interimResult.responsePromise
        assert.isOk(serverPromise)
        await ComparisonUtils.compareRequests(actualRequest,
            expectedRequest, undefined)
        await ComparisonUtils.compareResponses(actualResponse,
            expectedResponse, undefined)
    })

    it("test cancellation", async function() {
        const remoteEndpoint = []
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(2_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis:- 1
            }
        })
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                // don't wait.
                server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: -1,
                ensureTruthyResponse: true
            }
        })
        const requestFunc = async (reqEnv: any) => {
            return new DefaultQuasiHttpRequest()
        }
        const sendOptions: QuasiHttpSendOptions = {
            maxChunkSize: 200,
            responseBodyBufferingSizeLimit: 20_000,
            responseBufferingEnabled: false,
            ensureTruthyResponse: true
        }
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, sendOptions)
        await createDelayPromise(1_000)
        client.cancelSend(interimResult.cancellationHandle)
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from test cancellation\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED,
                e.reasonCode)
            return true
        })

        // test that a second cancellation does nothing.
        client.cancelSend(interimResult.cancellationHandle)
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED,
                e.reasonCode)
            return true
        })
        const expectedSendOptions: QuasiHttpSendOptions = {
            ensureTruthyResponse: true,
            extraConnectivityParams: new Map(),
            timeoutMillis: -1,
            maxChunkSize: 200,
            responseBodyBufferingSizeLimit: 20_000,
            responseBufferingEnabled: false,
        }
        assert.equal(clientTransport.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(clientTransport.actualSendOptions,
            expectedSendOptions)
    })

    it("test no timeout due to cancellation", async function() {
        const remoteEndpoint = []
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(2_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 4_000
            }
        })
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                // don't wait.
                server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 5_000
            }
        })
        const requestFunc = async (reqEnv: any) => {
            await createDelayPromise(1_000)
            return new DefaultQuasiHttpRequest()
        }
        const sendOptions: QuasiHttpSendOptions = {}
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, sendOptions)
        await createDelayPromise(1_000)
        client.cancelSend(interimResult.cancellationHandle)
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from " +
                "test no timeout due to cancellation\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED,
                e.reasonCode)
            return true
        })
    })

    it("test timeout (1)", async function() {
        this.timeout(5_000)
        const remoteEndpoint = {}
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(4_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: -1
            }
        })
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                // don't wait.
                server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 3_000
            }
        })
        const requestFunc = async (reqEnv: any) => {
            await createDelayPromise(1_000)
            return new DefaultQuasiHttpRequest()
        }
        const sendOptions: QuasiHttpSendOptions = {}
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, sendOptions)
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from " +
                "test timeout (1)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT,
                e.reasonCode)
            return true
        })
    })

    it("test timeout (2)", async function() {
        this.timeout(7_500)
        const remoteEndpoint = '/x/d/y'
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(4_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: -1
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 30_000,
                maxChunkSize: 200,
                responseBodyBufferingSizeLimit: 20_000,
                responseBufferingEnabled: true
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: 3_000,
            ensureTruthyResponse: false,
            responseBufferingEnabled: true
        }
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint,
                new DefaultQuasiHttpRequest(), sendOptions)
        }, (e: any) => {
            logger.info("actual client error from " +
                "test timeout (2)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT,
                e.reasonCode)
            return true
        })
        assert.isOk(serverPromise)
        await nativeAssert.rejects(async () => {
            await serverPromise
        }, (e: any) => {
            logger.info("actual server error from " +
                "test timeout (2)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            return true
        })
        const expectedSendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: 3_000,
            maxChunkSize: 200,
            responseBodyBufferingSizeLimit: 20_000,
            responseBufferingEnabled: true,
            ensureTruthyResponse: false,
        }
        assert.equal(clientTransport.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(clientTransport.actualSendOptions,
            expectedSendOptions)
    })

    it("test timeout (3)", async function() {
        this.timeout(5000)
        const remoteEndpoint = "127.0.0.1";
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(4_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 2_000
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 3_000
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: -1
        }
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint,
                new DefaultQuasiHttpRequest(), sendOptions)
        }, (e: any) => {
            logger.info("actual clilent error from " +
                "test timeout (3)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            return true
        })
        assert.isOk(serverPromise)
        await nativeAssert.rejects(async () => {
            await serverPromise
        }, (e: any) => {
            logger.info("actual server error from " +
                "test timeout (3)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT,
                e.reasonCode)
            return true
        })
    })

    it("test timeout (4)", async function() {
        this.timeout(5000)
        const remoteEndpoint = "127.0.0.2";
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(4_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 2_000
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 3_000
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: 6_000
        }
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint,
                new DefaultQuasiHttpRequest(), sendOptions)
        }, (e: any) => {
            logger.info("actual clilent error from " +
                "test timeout (4)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            return true
        })
        assert.isOk(serverPromise)
        await nativeAssert.rejects(async () => {
            await serverPromise
        }, (e: any) => {
            logger.info("actual server error from " +
                "test timeout (4)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT,
                e.reasonCode)
            return true
        })
    })

    it("test timeout (5)", async function() {
        this.timeout(7500)
        const remoteEndpoint = []
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(4_000)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 6_000
            }
        })
        let serverPromise: any
        server.transport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = server.acceptConnection(c)
            },
        })
        const clientTransport = new MemoryBasedClientTransport(
            new Map([
                [remoteEndpoint, server.transport]
            ])
        )
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            defaultSendOptions: {
                timeoutMillis: 30_000
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: 3_000
        }
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint,
                new DefaultQuasiHttpRequest(), sendOptions)
        }, (e: any) => {
            logger.info("actual clilent error from " +
                "test timeout (5)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT,
                e.reasonCode)
            return true
        })
        assert.isOk(serverPromise)
        await nativeAssert.rejects(async () => {
            await serverPromise
        }, (e: any) => {
            logger.info("actual server error from " +
                "test timeout (5)\n" +
                util.format(e));
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(QuasiHttpRequestProcessingError.REASON_CODE_GENERAL,
                e.reasonCode)
            return true
        })
    })
})