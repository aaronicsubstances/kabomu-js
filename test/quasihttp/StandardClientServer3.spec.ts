import nativeAssert from "assert/strict"
const { expect, assert } = require("chai").use(require("chai-bytes"))
import util from "node:util"
import { StandardQuasiHttpClient } from "../../src/quasihttp/client/StandardQuasiHttpClient"
import { StandardQuasiHttpServer } from "../../src/quasihttp/server/StandardQuasiHttpServer"
import { MemoryBasedClientTransport } from "../shared/quasihttp/MemoryBasedClientTransport"
import { DefaultQuasiHttpRequest } from "../../src/quasihttp/DefaultQuasiHttpRequest"
import { QuasiHttpRequestProcessingError } from "../../src/quasihttp/errors"
import { appLogger } from "../shared/common/LogManager"
import {
    IQuasiHttpRequest,
    QuasiHttpProcessingOptions,
    QuasiHttpSendOptions
} from "../../src/quasihttp/types"
import { DefaultQuasiHttpResponse } from "../../src/quasihttp/DefaultQuasiHttpResponse"
import * as ComparisonUtils from "../shared/common/ComparisonUtils"
import { createDelayPromise } from "../../src/common/MiscUtils"
import { StringBody } from "../../src/quasihttp/entitybody/StringBody"
import { DemoTransportBypass } from "../shared/quasihttp/DemoTransportBypass"
import { stringToBytes } from "../../src/common/ByteUtils"
import * as QuasiHttpUtils from "../../src/quasihttp/QuasiHttpUtils"

const logger = appLogger.child({
    label: "StandardClientServer3.spec"
})

describe("StandardClientServer3", function() {
    it("test client bypass (1)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const expectedResponse = new DefaultQuasiHttpResponse({
            body: new StringBody("tead")
        })
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            return expectedResponse
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            transport: new MemoryBasedClientTransport(null as any),
            defaultSendOptions: {
                responseBufferingEnabled: false,
                extraConnectivityParams: new Map([
                    ["1", "1"],
                    ["2", "2,2"]
                ])
            }
        })
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                ["1", "1"],
                ["2", "2,2"]
            ]),
            timeoutMillis: 0,
            maxHeadersSize: 0,
            responseBufferingEnabled: false,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act
        const actualResponse = await client.send(remoteEndpoint,
            request)

        // assert
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.strictEqual(actualRequest, request)
        assert.strictEqual(actualResponse, expectedResponse)
        // test that it is not disposed.
        await ComparisonUtils.compareResponses(
            actualResponse, expectedResponse, undefined)
        // should be false due to response buffering.
        assert.isNotOk(transportBypass.isCancellationRequested);
    })

    it("test client bypass (2)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const expectedResponse = new DefaultQuasiHttpResponse({
            body: new StringBody("tread")
        })
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            return expectedResponse
        },
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                responseBufferingEnabled: false,
                responseBodyBufferingSizeLimit: 2,
                ensureTruthyResponse: false
            }
        })
        const requestFunc = async (reqEnv) => {
            return request
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: 0,
            maxHeadersSize: 0,
            responseBufferingEnabled: false,
            responseBodyBufferingSizeLimit: 2,
            ensureTruthyResponse: false
        }

        // act
        const interimResult = client.send2(remoteEndpoint,
            requestFunc)
        const actualResponse = await interimResult.responsePromise

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        // test that it is not disposed.
        await ComparisonUtils.compareResponses(
            actualResponse, expectedResponse, undefined)
        // should be false due to response buffering.
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (3)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const expectedResBodyBytes = stringToBytes("threads");
        const expectedResponse = new DefaultQuasiHttpResponse({
            body: new StringBody("threads")
        })
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return expectedResponse
        }
        const client = new StandardQuasiHttpClient({
            transportBypass
        })
        const requestFunc = async (reqEnv) => {
            await createDelayPromise(500)
            return request
        }
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: 3_000,
            maxHeadersSize: 20,
            extraConnectivityParams: new Map([
                ["1", "one"],
                ["2", "two"]
            ])
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                ["1", "one"],
                ["2", "two"]
            ]),
            timeoutMillis: 3_000,
            maxHeadersSize: 20,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act
        const interimResult = client.send2(remoteEndpoint,
            requestFunc, sendOptions)
        const actualResponse = await interimResult.responsePromise

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        await ComparisonUtils.compareResponses(
            actualResponse, expectedResponse,
            expectedResBodyBytes)
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (4)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const expectedResBodyBytes = stringToBytes("reads");
        const expectedResponse = new DefaultQuasiHttpResponse({
            body: new StringBody("reads")
        })
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return expectedResponse
        }
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 3_000,
                extraConnectivityParams: new Map([
                    ["1", "1"],
                    ["2", "2,2"],
                    ["3", "3,3,3"]
                ])
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                ["1", "one"],
                ["2", "two"]
            ])
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                ["1", "one"],
                ["2", "two"],
                ["3", "3,3,3"]
            ]),
            timeoutMillis: 3_000,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act
        const actualResponse = await client.send(remoteEndpoint, request,
            sendOptions)

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        await ComparisonUtils.compareResponses(
            actualResponse, expectedResponse,
            expectedResBodyBytes)
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (5)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const expectedResBodyBytes = stringToBytes("tie");
        const expectedResponse = new DefaultQuasiHttpResponse({
            environment: new Map([
                [
                    QuasiHttpUtils.RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED,
                    "TRUE"
                ]
            ]),
            body: new StringBody("tie")
        })
        expectedResponse.body!.contentLength = -1
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return expectedResponse
        }
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 300,
                responseBodyBufferingSizeLimit: 800,
                responseBufferingEnabled: true
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: -1,
            responseBufferingEnabled: false,
            ensureTruthyResponse: false,
            responseBodyBufferingSizeLimit: 500
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: -1,
            maxHeadersSize: 0,
            responseBufferingEnabled: false,
            responseBodyBufferingSizeLimit: 500,
            ensureTruthyResponse: false
        }

        // act
        const actualResponse = await client.send(remoteEndpoint, request,
            sendOptions)

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        // test that it is not disposed.
        await ComparisonUtils.compareResponses(
            actualResponse, expectedResponse,
            expectedResBodyBytes)
        // should be false due to absence of cancellation handle.
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (6)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const expectedResBodyBytes = stringToBytes("tie");
        const expectedResponse = new DefaultQuasiHttpResponse({
            environment: new Map([
                [
                    QuasiHttpUtils.RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED,
                    "TRUE"
                ]
            ]),
            body: new StringBody("tie")
        })
        expectedResponse.body!.contentLength = -1
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return expectedResponse
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 300,
                ensureTruthyResponse: true,
                responseBufferingEnabled: false
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            timeoutMillis: -1,
            responseBufferingEnabled: false,
            ensureTruthyResponse: false,
            responseBodyBufferingSizeLimit: 500
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: -1,
            maxHeadersSize: 0,
            responseBufferingEnabled: false,
            responseBodyBufferingSizeLimit: 500,
            ensureTruthyResponse: false
        }

        // act
        const actualResponse = await client.send(remoteEndpoint, request,
            sendOptions)

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        // test that it is not disposed.
        await ComparisonUtils.compareResponses(
            actualResponse, expectedResponse,
            expectedResBodyBytes)
        // should be false due to absence of cancellation handle.
        assert.isOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (7)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return undefined
        }
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 3_000,
                ensureTruthyResponse: true,
                extraConnectivityParams: new Map([
                    ["1", "1"],
                    ["2", "2,2"],
                    ["3", '3,3,3']
                ])
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["1", "one"],
                ["2", "two"],
                ["4", 'four'],
                [
                    QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET,
                    true
                ]
            ])
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["1", "one"],
                ["2", "two"],
                ["3", "3,3,3"],
                ["4", 'four'],
                [
                    QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET,
                    true
                ]
            ]),
            timeoutMillis: 3_000,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint, request,
                sendOptions);
        }, (e: any) => {
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("no response")
            return true
        })

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (8)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return undefined
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 3_000,
                extraConnectivityParams: new Map([
                    ["1", "1"],
                    ["2", "2,2"],
                    ["3", '3,3,3']
                ])
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["11", "eleven"],
                ["12", "twelve"],
                ["4", 'four'],
                [
                    QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET,
                    true
                ]
            ])
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["1", "1"],
                ["2", "2,2"],
                ["3", "3,3,3"],
                ["4", 'four'],
                ["11", "eleven"],
                ["12", "twelve"],
                [
                    QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET,
                    true
                ]
            ]),
            timeoutMillis: 3_000,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: false
        }

        // act
        const interimResult = client.send2(remoteEndpoint,
            async () => request, sendOptions)
        const actualResponse = await interimResult.responsePromise

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isNotOk(actualResponse)
        assert.isOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (9)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return undefined
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 3_100,
                maxHeadersSize: 4_000,
                responseBufferingEnabled: false,
                extraConnectivityParams: new Map([
                    ["1", "1"],
                    ["2", "2,2"],
                    ["3", '3,3,3']
                ])
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["11", "eleven"],
                ["12", "twelve"],
                ["4", 'four']
            ]),
            maxHeadersSize: 1500
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["1", "1"],
                ["2", "2,2"],
                ["3", "3,3,3"],
                ["4", 'four'],
                ["11", "eleven"],
                ["12", "twelve"]
            ]),
            timeoutMillis: 3_100,
            maxHeadersSize: 1500,
            responseBufferingEnabled: false,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act
        const interimResult = client.send2(remoteEndpoint,
            async () => request, sendOptions)
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            expect(e.message).to.contain("no response")
            return true
        })

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass (10)", async function() {
        // arrange
        const remoteEndpoint = {}
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            actualRequest = req
            await createDelayPromise(500)
            return undefined
        }
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 3_200,
                extraConnectivityParams: new Map([
                    ["1", "1"],
                    ["2", "2,2"],
                    ["3", '3,3,3']
                ]),
                ensureTruthyResponse: true,
                responseBodyBufferingSizeLimit: 4_300,
            }
        })
        const sendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["1", "one"],
                ["2", "two"],
                ["4", 'four']
            ]),
            ensureTruthyResponse: false,
            responseBodyBufferingSizeLimit: 700
        }
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map<string, any>([
                ["1", "one"],
                ["2", "two"],
                ["3", "3,3,3"],
                ["4", 'four']
            ]),
            timeoutMillis: 3_200,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 700,
            ensureTruthyResponse: false
        }

        // act
        const actualResponse = await client.send(
            remoteEndpoint, request, sendOptions)

        // assert
        assert.strictEqual(actualRequest, request)
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isNotOk(actualResponse)
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass timeout (1)", async function() {
        // act
        const remoteEndpoint = {}
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            await createDelayPromise(2_500)
            return new DefaultQuasiHttpResponse()
        }
        const client = new StandardQuasiHttpClient({
            transportBypass,
            transport: new MemoryBasedClientTransport(null as any),
            defaultSendOptions: {
                timeoutMillis: 300
            }
        })
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: 300,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act and begin asserting
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint,
                new DefaultQuasiHttpRequest())
        }, (e: any) => {
            logger.info("actual error from " +
                "test client bypass timeout (1)\n",
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT)
            return true
        })

        // assert
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass timeout (2)", async function() {
        // act
        const remoteEndpoint = {}
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            await createDelayPromise(2_500)
            return new DefaultQuasiHttpResponse()
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            transport: new MemoryBasedClientTransport(null as any),
            defaultSendOptions: {
                timeoutMillis: 300,
                responseBufferingEnabled: false
            }
        })
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: 300,
            maxHeadersSize: 0,
            responseBufferingEnabled: false,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act and begin asserting
        await nativeAssert.rejects(async () => {
            await client.send(remoteEndpoint,
                new DefaultQuasiHttpRequest())
        }, (e: any) => {
            logger.info("actual error from " +
                "test client bypass timeout (2)\n",
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT)
            return true;
        })

        // assert
        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass cancellation", async function() {
        // act
        const remoteEndpoint = {}
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            await createDelayPromise(2_500)
            return new DefaultQuasiHttpResponse()
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: -1
            }
        })
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: -1,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: true
        }

        // act
        const interimResult = client.send2(remoteEndpoint,
            async () => undefined)
        await createDelayPromise(1_000)
        assert.isNotOk(transportBypass.isCancellationRequested)
        client.cancelSend(interimResult.cancellationHandle)

        // assert
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from " +
                "test client bypass cancellation\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED)
            return true
        })
        assert.isOk(transportBypass.isCancellationRequested)

        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)

        // test that a second cancel does not do anything.
        transportBypass.isCancellationRequested = false;
        client.cancelSend(interimResult.cancellationHandle)
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED)
            return true
        })
        assert.isNotOk(transportBypass.isCancellationRequested)
    })

    it("test client bypass no timeout due to cancellation", async function() {
        // act
        const remoteEndpoint = {}
        const transportBypass = new DemoTransportBypass()
        transportBypass.sendRequestCallback = async (req) => {
            await createDelayPromise(2_500)
            return new DefaultQuasiHttpResponse()
        }
        transportBypass.createCancellationHandles = true
        const client = new StandardQuasiHttpClient({
            transportBypass,
            defaultSendOptions: {
                timeoutMillis: 4_000,
                ensureTruthyResponse: false
            }
        })
        const expectedConnectivityParams: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map(),
            timeoutMillis: 4_000,
            maxHeadersSize: 0,
            responseBufferingEnabled: true,
            responseBodyBufferingSizeLimit: 0,
            ensureTruthyResponse: false
        }

        // act
        const interimResult = client.send2(remoteEndpoint,
            async () => undefined)
        await createDelayPromise(1_000)
        assert.isNotOk(transportBypass.isCancellationRequested)
        client.cancelSend(interimResult.cancellationHandle)

        // assert
        await nativeAssert.rejects(async () => {
            await interimResult.responsePromise
        }, (e: any) => {
            logger.info("actual error from " +
                "test client bypass no timeout due to cancellation\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_CANCELLED)
            return true
        })

        assert.equal(transportBypass.actualRemoteEndpoint,
            remoteEndpoint)
        assert.deepEqual(transportBypass.actualSendOptions,
            expectedConnectivityParams)
        assert.isOk(transportBypass.isCancellationRequested)
    })

    it("test server bypass (1)", async function() {
        const request = new DefaultQuasiHttpRequest()
        const expectedResponse = new DefaultQuasiHttpResponse()
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    await createDelayPromise(1_200)
                    return expectedResponse
                },
            }
        })
        const actualResponse = await server.acceptRequest(request)
        assert.strictEqual(actualRequest, request)
        assert.strictEqual(actualResponse, expectedResponse)
        // test that it is not disposed
        await ComparisonUtils.compareResponses(expectedResponse,
            actualResponse, undefined)
    })

    it("test server bypass (2)", async function() {
        const request = new DefaultQuasiHttpRequest()
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    await createDelayPromise(1_200)
                    return undefined
                },
            }
        })
        const actualResponse = await server.acceptRequest(request)
        assert.strictEqual(actualRequest, request)
        assert.isNotOk(actualResponse)
    })

    it("test server bypass no timeout", async function() {
        const request = new DefaultQuasiHttpRequest()
        const expectedResBodyBytes = stringToBytes("ideas")
        const expectedResponse = new DefaultQuasiHttpResponse({
            body: new StringBody("ideas")
        })
        let actualRequest: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequest = request
                    await createDelayPromise(1_200)
                    return expectedResponse
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 5_000
            }
        })
        const actualResponse = await server.acceptRequest(request)
        assert.strictEqual(actualRequest, request)
        assert.strictEqual(actualResponse, expectedResponse)
        // test that it is not disposed
        await ComparisonUtils.compareResponses(expectedResponse,
            actualResponse, expectedResBodyBytes)
    })

    it("test server bypass timeout (1)", async function() {
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(2_800)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: -1
            }
        })
        const receiveOptions: QuasiHttpProcessingOptions = {
            timeoutMillis: 1_500
        }
        const request = new DefaultQuasiHttpRequest()
        await nativeAssert.rejects(async () => {
            await server.acceptRequest(request, receiveOptions)
        }, (e: any) => {
            logger.info("actual error from " +
                "test server bypass timeout (1)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT)
            return true
        })
    })

    it("test server bypass timeout (2)", async function() {
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    await createDelayPromise(2_800)
                    return new DefaultQuasiHttpResponse()
                },
            },
            defaultProcessingOptions: {
                timeoutMillis: 1_500
            }
        })
        const receiveOptions: QuasiHttpProcessingOptions = {
            timeoutMillis: 1_200
        }
        const request = new DefaultQuasiHttpRequest()
        await nativeAssert.rejects(async () => {
            await server.acceptRequest(request, receiveOptions)
        }, (e: any) => {
            logger.info("actual error from " +
                "test server bypass timeout (2)\n" +
                util.format(e))
            assert.instanceOf(e, QuasiHttpRequestProcessingError)
            assert.equal(e.reasonCode,
                QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT)
            return true
        })
    })
})