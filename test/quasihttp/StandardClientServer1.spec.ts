import nativeAssert from "assert/strict"
const { assert } = require("chai").use(require("chai-bytes"))
import util from "node:util"
import { StandardQuasiHttpClient } from "../../src/quasihttp/client/StandardQuasiHttpClient"
import { StandardQuasiHttpServer } from "../../src/quasihttp/server/StandardQuasiHttpServer"
import { ConnectionAllocationResponse, IQuasiHttpAltTransport, IQuasiHttpRequest, IQuasiHttpResponse, QuasiHttpSendOptions } from "../../src/quasihttp/types";
import { createDelayPromise, createYieldPromise, parseInt32 } from "../../src/common/MiscUtils";
import { DefaultQuasiHttpResponse } from "../../src/quasihttp/DefaultQuasiHttpResponse";
import * as QuasiHttpUtils from "../../src/quasihttp/QuasiHttpUtils"
import { MemoryBasedServerTransport } from "../shared/quasihttp/MemoryBasedServerTransport";
import { MemoryBasedClientTransport } from "../shared/quasihttp/MemoryBasedClientTransport"
import { DefaultQuasiHttpRequest } from "../../src/quasihttp/DefaultQuasiHttpRequest";
import * as ComparisonUtils from "../shared/common/ComparisonUtils"
import { bytesToString, stringToBytes } from "../../src/common/ByteUtils";
import { ByteBufferBody } from "../../src/quasihttp/entitybody/ByteBufferBody";
import { StringBody } from "../../src/quasihttp/entitybody/StringBody";
import { getBodyReader } from "../../src/quasihttp/entitybody/EntityBodyUtils";
import * as IOUtils from "../../src/common/IOUtils"
import { appLogger } from "../shared/common/LogManager"

const keyStatusMessageOK = "Ok";
const keyStatusMessageBadRequest = "Bad Request";
const keyRequestTarget = "x-target";
const keyRequestMethod = "x-method";
const keyStatusCode = "x-status-code";
const keyStatusPhrase = "x-status-phrase";
const keyHttpVersion1_0 = "HTTP/1.0";
const keyHttpVersion1_1 = "HTTP/1.1";

const endpointLang = "lang";
const endpointPascal = "pascal";
const endpointParrot = "parrot";

const keyTransportDelayMs = "tr-delay-ms";
const keyMathOp = "math-operator";
const keyMathArg1 = "math-arg-1";
const keyMathArg2 = "math-arg-2";
const keyMathResult = "math-answer";
const keyMathOpAdd = "+";
const keyMathOpMul = "*";

const logger = appLogger.child({
    label: "StandardClientServer1.spec"
})

describe("StandardClientServer1", function() {
    it("test client argument errors", async function() {
        const instance = new StandardQuasiHttpClient()
        await nativeAssert.rejects(async () => {
            await instance.send(3, undefined as any, {})
        })
        assert.throws(() => {
            instance.send2(3, undefined as any, {})
        })

        // test that cancel doesn't complain when given invalid arguments.
        instance.cancelSend(null);
        instance.cancelSend({});
    })

    it("test server argument errors", async function() {
        const instance = new StandardQuasiHttpServer()
        await nativeAssert.rejects(async () => {
            await instance.acceptConnection(null as any)
        })
        await nativeAssert.rejects(async () => {
            await instance.acceptRequest(null as any, {})
        })
    })

    it("test fire and forget", async function() {
        let serverPromise: Promise<void> | undefined;
        let actualRequestClone: IQuasiHttpRequest | undefined
        const server = new StandardQuasiHttpServer({
            application: {
                async processRequest(request) {
                    actualRequestClone = request
                    await createDelayPromise(1700)
                    return new DefaultQuasiHttpResponse({
                        environment: new Map([
                            [
                                QuasiHttpUtils.RES_ENV_KEY_SKIP_RESPONSE_SENDING,
                                true
                            ]
                        ])
                    })
                },
            }
        })
        const serverTransport = new MemoryBasedServerTransport({
            acceptConnectionFunc(c) {
                serverPromise = processAcceptConnection(c, server)
            }
        })
        server.transport = serverTransport

        const endpoint = "m1"
        const servers = new Map([
            [endpoint, serverTransport]
        ])
        const clientTransport = new MemoryBasedClientTransport(servers)
        const client = new StandardQuasiHttpClient({
            transport: clientTransport
        })
        const sendOptions: QuasiHttpSendOptions = {
            extraConnectivityParams: new Map([
                [
                    QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET,
                    true
                ]
            ])
        }
        const expectedRequest = new DefaultQuasiHttpRequest()

        // act
        const res = await client.send(endpoint, expectedRequest, sendOptions)
        assert.isOk(serverPromise)
        await serverPromise

        // assert
        assert.isNotOk(res)
        await ComparisonUtils.compareRequests(actualRequestClone,
            expectedRequest, undefined)
    })

    it("test success", async function() {
        this.timeout(5_000)
        const testData = createTest1Data()
        const servers = new Map<any, MemoryBasedServerTransport>()
        const serverPromises = new Array<any>()
        createServer1(servers, serverPromises)
        createServer2(servers, serverPromises)
        createServer3(servers, serverPromises)

        const clientTransport = new MemoryBasedClientTransport(servers)
        let clientTransportBypass: IQuasiHttpAltTransport | undefined
        const client = new StandardQuasiHttpClient({
            transport: clientTransport,
            transportBypass: clientTransportBypass,
            defaultSendOptions: {
                timeoutMillis: 5_000
            }
        })
        logger.info(`test success starting...\n\n`)
        const clientPromises = new Array<any>()
        let i = 0
        for (const testDataItem of testData) {
            clientPromises.push(runTestDataItem(client, i, testDataItem))
            i++
        }
        i = 0
        for (const promise of clientPromises) {
            try {
                await promise
            }
            catch (e) {
                logger.error(`error occured in test success with ` +
                    `client task#${i}\n${util.format(e)}`)
            }
            i++
        }
        // record any server errors.
        for (const promise of serverPromises) {
            try {
                await promise
            }
            catch (e) {
                logger.error(`error occured in test success with ` +
                    `a server task\n${util.format(e)}`)
            }
        }
        // passing serverPromises first is preferred since
        // the errors at the server end are more informative
        await Promise.all(serverPromises.concat(clientPromises))
        logger.info("test success completed sucessfully.\n\n");
    })
})

async function runTestDataItem(
        client: StandardQuasiHttpClient,
        index: number,
        testDataItem: Test1Data) {
    logger.info(`Starting test success with data#${index}...`)
    const actualResponse = await client.send(
        testDataItem.remoteEndpoint,
        testDataItem.request,
        testDataItem.sendOptions)
    await ComparisonUtils.compareResponses(
        testDataItem.expectedResponse,
        actualResponse,
        testDataItem.expectedResponseBodyBytes)
    logger.info(`Sucessfully tested test success with data#${index}`)
}

function* createTest1Data() {
    // next...
    let remoteEndpoint = endpointParrot
    let sendOptions: QuasiHttpSendOptions | undefined
    let expectedResponseBodyBytes: Buffer | undefined =
        stringToBytes("did it")
    let request = new DefaultQuasiHttpRequest({
        method: "GRANT",
        target: "/reporter",
        httpVersion: "20",
        headers: new Map([
            [ "soap", ["key soap"] ],
            [ "washing power", ["omo", "madar"] ],
            [ "math basics", ["+", "-", "*", "/"] ],
            [ keyStatusCode, ["201"] ],
            [ keyStatusPhrase, ["Accepted"]]
        ]),
        body: new StringBody(bytesToString(expectedResponseBodyBytes))
    })
    let expectedResponse = new DefaultQuasiHttpResponse({
        statusCode: 201,
        httpStatusMessage: "Accepted",
        httpVersion: request.httpVersion,
        headers: new Map(request.headers),
        body: new ByteBufferBody(expectedResponseBodyBytes)
    })
    expectedResponse.headers!.set(keyRequestMethod,
        [ request.method as any ])
    expectedResponse.headers!.set(keyRequestTarget,
        [ request.target as any ])
    yield {
        remoteEndpoint,
        sendOptions,
        request,
        expectedResponse,
        expectedResponseBodyBytes
    }

    // next...
    remoteEndpoint = endpointLang
    sendOptions = {
        maxChunkSize: 200,
        responseBufferingEnabled: false
    }
    request = new DefaultQuasiHttpRequest({
        method: "GET",
        target: "/returjn/dude",
        httpVersion: keyHttpVersion1_0,
        body: new StringBody("hello")
    })
    expectedResponseBodyBytes = stringToBytes("HELLO")
    expectedResponse = new DefaultQuasiHttpResponse({
        statusCode: 0,
        httpStatusMessage: undefined,
        httpVersion: undefined,
        body: new ByteBufferBody(expectedResponseBodyBytes)
    })
    expectedResponse.body!.contentLength = -1
    yield {
        remoteEndpoint,
        sendOptions,
        request,
        expectedResponse,
        expectedResponseBodyBytes
    }

    // next...
    remoteEndpoint = endpointPascal
    sendOptions = undefined
    request = new DefaultQuasiHttpRequest({
        method: "POST",
        target: "/compute",
        headers: new Map([
            [keyMathOp, [keyMathOpMul]],
            [keyMathArg1, ["70"]],
            [keyMathArg2, ["2"]],
        ])
    })
    expectedResponseBodyBytes = undefined
    expectedResponse = new DefaultQuasiHttpResponse({
        statusCode: 200,
        httpStatusMessage: keyStatusMessageOK,
        httpVersion: keyHttpVersion1_0,
        headers: new Map([
            [keyMathResult, ["140"]]
        ])
    })
    yield {
        remoteEndpoint,
        sendOptions,
        request,
        expectedResponse,
        expectedResponseBodyBytes
    }

    // next...
    remoteEndpoint = endpointPascal
    sendOptions = {
        extraConnectivityParams: new Map([
            [keyTransportDelayMs, "1500"]
        ])
    }
    request = new DefaultQuasiHttpRequest({
        method: "POST",
        target: "/compute",
        headers: new Map([
            [keyMathOp, ["invalid"]],
            [keyMathArg1, ["70"]],
            [keyMathArg2, ["2"]],
        ])
    })
    expectedResponseBodyBytes = undefined
    expectedResponse = new DefaultQuasiHttpResponse({
        statusCode: 400,
        httpStatusMessage: keyStatusMessageBadRequest,
        httpVersion: keyHttpVersion1_0
    })
    yield {
        remoteEndpoint,
        sendOptions,
        request,
        expectedResponse,
        expectedResponseBodyBytes
    }

    // next...
    remoteEndpoint = endpointPascal
    sendOptions = undefined
    request = new DefaultQuasiHttpRequest({
        method: "PUT",
        target: "/compute",
        headers: new Map([
            [keyMathOp, [keyMathOpAdd]],
            [keyMathArg1, ["70"]],
            [keyMathArg2, ["2"]]
        ])
    })
    expectedResponseBodyBytes = undefined
    expectedResponse = new DefaultQuasiHttpResponse({
        statusCode: 200,
        httpStatusMessage: keyStatusMessageOK,
        httpVersion: keyHttpVersion1_0,
        headers: new Map([
            [keyMathResult, ["72"]]
        ])
    })
    yield {
        remoteEndpoint,
        sendOptions,
        request,
        expectedResponse,
        expectedResponseBodyBytes
    }
}

function createServer1(
        servers: Map<any, MemoryBasedServerTransport>,
        serverPromises: Array<any>) {
    const server = new StandardQuasiHttpServer({
        application: {
            processRequest: echoApplicationServer
        },
        defaultProcessingOptions: {
            timeoutMillis: 4_000
        }
    })
    const serverTransport = new MemoryBasedServerTransport({
        acceptConnectionFunc(c) {
            serverPromises.push(processAcceptConnection(c, server))
        },
    })
    server.transport = serverTransport

    servers.set(endpointParrot, serverTransport)
}

function createServer2(
        servers: Map<any, MemoryBasedServerTransport>,
        serverPromises: Array<any>) {
    const server = new StandardQuasiHttpServer({
        application: {
            processRequest: capitalizationApplicationServer
        }
    })
    const serverTransport = new MemoryBasedServerTransport({
        acceptConnectionFunc(c) {
            serverPromises.push(processAcceptConnection(c, server))
        },
    })
    server.transport = serverTransport

    servers.set(endpointLang, serverTransport)
}

function createServer3(
        servers: Map<any, MemoryBasedServerTransport>,
        serverPromises: Array<any>) {
    const server = new StandardQuasiHttpServer({
        application: {
            processRequest: arithmeticApplicationServer
        },
        defaultProcessingOptions: {
            maxChunkSize: 100,
            timeoutMillis: 2_000
        }
    })
    const serverTransport = new MemoryBasedServerTransport({
        acceptConnectionFunc(c) {
            serverPromises.push(processAcceptConnection(c, server))
        },
    })
    server.transport = serverTransport

    servers.set(endpointPascal, serverTransport)
}

async function echoApplicationServer(
        request: IQuasiHttpRequest) {
    let status = 0
    let statusReason = ''
    try {
        status = parseInt32(request.headers!.get(keyStatusCode)![0])
        statusReason = request.headers!.get(keyStatusPhrase)![0]
    }
    catch (e) {
        logger.error("error in echo app server\n" + 
            util.format(e))
        status = 200
        statusReason = keyStatusMessageOK
    }
    const resHeaders: any = new Map([
        [ keyRequestTarget, [ request.target ]],
        [ keyRequestMethod, [ request.method ]]
    ])
    const response = new DefaultQuasiHttpResponse({
        statusCode: status,
        httpStatusMessage: statusReason,
        httpVersion: request.httpVersion ?? keyHttpVersion1_1,
        headers: resHeaders,
        body: request.body
    })
    if (request.headers) {
        for (const item of request.headers) {
            resHeaders.set(item[0], item[1])
        }
    }
    return response
}

async function capitalizationApplicationServer(
        request: IQuasiHttpRequest) {
    let bodyAsString = bytesToString(
        await IOUtils.readAllBytes(getBodyReader(request.body)))
    bodyAsString = bodyAsString.toUpperCase()
    const res = new DefaultQuasiHttpResponse({
        body: new StringBody(bodyAsString)
    })
    res.body!.contentLength = -1
    return res
}

async function arithmeticApplicationServer(
        request: IQuasiHttpRequest) {
    let status = 200
    let statusReason = keyStatusMessageOK
    const resHeaders = new Map()
    const op = request.headers!.get(keyMathOp)![0]
    const arg1 = Number.parseFloat(request.headers!.get(keyMathArg1)![0])
    const arg2 = Number.parseFloat(request.headers!.get(keyMathArg2)![0])
    let result = 0
    if (op === keyMathOpAdd) {
        result = arg1 + arg2
    }
    else if (op === keyMathOpMul) {
        result = arg1 * arg2
    }
    else {
        status = 400
        statusReason = keyStatusMessageBadRequest
    }
    if (status === 200) {
        resHeaders.set(keyMathResult, [`${result}`])
    }
    const response = new DefaultQuasiHttpResponse({
        statusCode: status,
        httpStatusMessage: statusReason,
        httpVersion: keyHttpVersion1_0,
        headers: resHeaders
    })
    return response
}

async function processAcceptConnection(
        c: ConnectionAllocationResponse,
        server: StandardQuasiHttpServer) {
    await createYieldPromise()
    if (c.environment && c.environment.has(keyTransportDelayMs)) {
        const delay = parseInt32(c.environment.get(keyTransportDelayMs))
        await createDelayPromise(delay)
    }
    await server.acceptConnection(c)
}

interface Test1Data {
    remoteEndpoint: string
    sendOptions: QuasiHttpSendOptions | undefined
    request: IQuasiHttpRequest
    expectedResponse: IQuasiHttpResponse
    expectedResponseBodyBytes: Buffer | undefined
}