import nativeAssert from "assert/strict";
const { expect, assert } = require('chai').use(require('chai-bytes'))
import { Readable, Writable } from "stream"
import { DefaultQuasiHttpRequest } from "../src/DefaultQuasiHttpRequest"
import { DefaultQuasiHttpResponse } from "../src/DefaultQuasiHttpResponse"
import  {
    stringToBytes
} from "../src/MiscUtilsInternal"
import { IQuasiHttpRequest, QuasiHttpConnection, QuasiHttpProcessingOptions } from "../src/types"
import { StandardQuasiHttpClient } from "../src/StandardQuasiHttpClient"
import { StandardQuasiHttpServer } from "../src/StandardQuasiHttpServer"
import { createRandomizedReadSizeBufferReader } from "./shared/RandomizedReadSizeBufferReader"
import { compareRequests, compareResponses, readAllBytes } from "./shared/ComparisonUtils"

describe("StandardQuasiHttpClientServerTest", function() {
    describe("TestRequestSerialization", function() {
        const testDataGenerator = function*() {
            let expectedReqBodyBytes: Buffer | undefined = stringToBytes("tanner")
            let request = new DefaultQuasiHttpRequest({
                httpMethod: "GET",
                target: "/",
                httpVersion: "HTTP/1.0",
                contentLength: expectedReqBodyBytes.length,
                headers: new Map([
                    ["Accept", ["text/plain", "text/csv"]],
                    ["Content-Type", "application/json,charset=UTF-8" as any]
                ])
            })
            let expectedRequest = new DefaultQuasiHttpRequest({
                httpMethod: "GET",
                target: "/",
                httpVersion: "HTTP/1.0",
                contentLength: expectedReqBodyBytes.length,
                headers: new Map([
                    ["accept", ["text/plain", "text/csv"]],
                    ["content-type", "application/json,charset=UTF-8" as any]
                ])
            })
            let expectedSerializedReq: Buffer | undefined = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 90
                ]),
                stringToBytes("GET,/,HTTP/1.0,6\n"),
                stringToBytes("Accept,text/plain,text/csv\n"),
                stringToBytes("Content-Type,\"application/json,charset=UTF-8\"\n"),
                expectedReqBodyBytes
            ])
            yield {
                expectedReqBodyBytes,
                request,
                expectedRequest,
                expectedSerializedReq
            }

            expectedReqBodyBytes = undefined
            request = new DefaultQuasiHttpRequest()
            expectedRequest = new DefaultQuasiHttpRequest({
                httpMethod: "",
                target: "",
                httpVersion: "",
                contentLength: 0,
                headers: new Map()
            })
            expectedSerializedReq = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 11,
                ]),
                stringToBytes(`"","","",0\n`)
            ])
            yield {
                expectedReqBodyBytes,
                request,
                expectedRequest,
                expectedSerializedReq
            }

            expectedReqBodyBytes = Buffer.from([
                8, 7, 8, 9
            ])
            request = new DefaultQuasiHttpRequest({
                contentLength: -1
            })
            expectedRequest = new DefaultQuasiHttpRequest({
                httpMethod: "",
                target: "",
                httpVersion: "",
                contentLength: -1,
                headers: new Map()
            })
            expectedSerializedReq = undefined
            yield {
                expectedReqBodyBytes,
                request,
                expectedRequest,
                expectedSerializedReq
            }
        }
        let i = -1
        for (const testDataItem of testDataGenerator()) {
            i++
            it(`should pass with input ${i}`, async function() {
                const {
                    expectedReqBodyBytes,
                    request,
                    expectedRequest,
                    expectedSerializedReq
                } = testDataItem
                const remoteEndpoint = {}
                if (expectedReqBodyBytes) {
                    request.body = Readable.from(expectedReqBodyBytes)
                }
                const dummyRes = new DefaultQuasiHttpResponse()
                const chunks = new Array<Buffer>()
                const destStream = new Writable({
                    write(chunk, encoding, cb) {
                        chunks.push(chunk)
                        cb()
                    }
                })
                const sendOptions: any = {}
                const clientConnection: any = {
                    processingOptions: sendOptions,
                    writableStream: destStream
                }
                const clientTransport = createClientTransport(false)
                clientTransport.allocateConnection = async (endPt, opts) => {
                    assert.strictEqual(endPt, remoteEndpoint)
                    assert.strictEqual(opts, sendOptions)
                    return {
                        connection: clientConnection
                    }
                }
                clientTransport.responseDeserializer = async (conn) => {
                    assert.strictEqual(conn, clientConnection)
                    return dummyRes
                }
                const client = new StandardQuasiHttpClient({
                    transport: clientTransport
                })
                const actualRes = await client.send(remoteEndpoint,
                    request, sendOptions)
                assert.strictEqual(actualRes, dummyRes)
                if (expectedSerializedReq) {
                    assert.equalBytes(Buffer.concat(chunks), expectedSerializedReq)
                }

                // deserialize
                const memStream = createRandomizedReadSizeBufferReader(
                    Buffer.concat(chunks))
                let actualRequest: IQuasiHttpRequest | undefined
                const serverConnection: any = {
                    readableStream: memStream,
                    environment: new Map()
                }
                const serverTransport = createServerTransportImpl(false)
                serverTransport.responseSerializer = async (conn, res) => {
                    assert.strictEqual(conn, serverConnection)
                    assert.strictEqual(res, dummyRes)
                    return true
                }
                const server = new StandardQuasiHttpServer({
                    transport: serverTransport,
                    application: async (req) => {
                        actualRequest = req
                        return dummyRes
                    }
                })
                await server.acceptConnection(serverConnection)

                // assert
                await compareRequests(actualRequest, expectedRequest,
                    expectedReqBodyBytes);
                assert.strictEqual(serverConnection.environment,
                    actualRequest?.environment)
            })
        }
    })

    describe("TestRequestSerializationForErrors", function() {
        const testDataGenerator = function*() {
            let request = new DefaultQuasiHttpRequest({
                httpMethod: "POST",
                target: "/Update",
                contentLength: 8
            })
            let sendOptions: QuasiHttpProcessingOptions | undefined = {
                maxHeadersSize: 18
            }
            let expectedErrorMsg: string | undefined
            let expectedSerializedReq: Buffer | undefined = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 18
                ]),
                stringToBytes("POST,/Update,\"\",8\n")
            ])
            yield {
                request,
                sendOptions,
                expectedErrorMsg,
                expectedSerializedReq
            }

            let requestBodyBytes = Buffer.from([ 4 ]) 
            request = new DefaultQuasiHttpRequest({
                httpMethod: "PUT",
                target: "/Updates",
                contentLength: 0,
                body: Readable.from(requestBodyBytes)
            })
            sendOptions = {
                maxHeadersSize: 19
            }
            expectedErrorMsg = undefined
            expectedSerializedReq = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 18
                ]),
                stringToBytes("PUT,/Updates,\"\",0\n"),
                Buffer.from([
                    0x62, 0x64, 0x74, 0x61,
                    0, 0, 0, 1, 4,
                    0x62, 0x64, 0x74, 0x61,
                    0, 0, 0, 0
                ])
            ])
            yield {
                request,
                sendOptions,
                expectedErrorMsg,
                expectedSerializedReq
            }

            requestBodyBytes = Buffer.from([ 4, 5, 6 ])
            request = new DefaultQuasiHttpRequest({
                contentLength: 10,
                body: Readable.from(requestBodyBytes)
            })
            sendOptions = undefined
            expectedErrorMsg = undefined
            expectedSerializedReq = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 12
                ]),
                stringToBytes("\"\",\"\",\"\",10\n"),
                requestBodyBytes
            ])
            yield {
                request,
                sendOptions,
                expectedErrorMsg,
                expectedSerializedReq
            }

            request = new DefaultQuasiHttpRequest()
            sendOptions = {
                maxHeadersSize: 5
            }
            expectedErrorMsg = "quasi http headers exceed max size"
            expectedSerializedReq = undefined
            yield {
                request,
                sendOptions,
                expectedErrorMsg,
                expectedSerializedReq
            }

            request = new DefaultQuasiHttpRequest({
                httpVersion: "no-spaces-allowed",
                headers: new Map([
                    ["empty-prohibited", ["a: \nb"]]
                ])
            })
            sendOptions = undefined
            expectedErrorMsg = "quasi http header value contains newlines"
            expectedSerializedReq = undefined
            yield {
                request,
                sendOptions,
                expectedErrorMsg,
                expectedSerializedReq
            }
        }
        let i = -1
        for (const testDataItem of testDataGenerator()) {
            i++
            it(`should pass with input ${i}`, async function() {
                const {
                    request,
                    sendOptions,
                    expectedErrorMsg,
                    expectedSerializedReq
                } = testDataItem
                const remoteEndpoint = {}
                const dummyRes = new DefaultQuasiHttpResponse()
                const chunks = new Array<Buffer>()
                const destStream = new Writable({
                    write(chunk, encoding, cb) {
                        chunks.push(chunk)
                        cb()
                    }
                })
                const clientConnection: any = {
                    processingOptions: sendOptions,
                    writableStream: destStream
                }
                const clientTransport = createClientTransport(false)
                clientTransport.allocateConnection = async (endPt, opts) => {
                    assert.strictEqual(endPt, remoteEndpoint)
                    assert.strictEqual(opts, sendOptions)
                    return {
                        connection: clientConnection
                    }
                }
                clientTransport.responseDeserializer = async (conn) => {
                    assert.strictEqual(conn, clientConnection)
                    return dummyRes
                }
                const client = new StandardQuasiHttpClient({
                    transport: clientTransport
                })
                if (!expectedErrorMsg) {
                    const actualRes = await client.send(remoteEndpoint,
                        request, sendOptions)
                    assert.strictEqual(actualRes, dummyRes)
                    if (expectedSerializedReq) {
                        assert.equalBytes(Buffer.concat(chunks), expectedSerializedReq)
                    }
                }
                else {
                    await nativeAssert.rejects(async () => {
                        await client.send(remoteEndpoint, request, sendOptions)
                    }, (e: any) => {
                        expect(e.message).to.contain(expectedErrorMsg)
                        return true;
                    })
                }
            })
        }
    })

    describe("TestResponseSerialization", function() {
        const testDataGenerator = function*() {
            let expectedResBodyBytes: Buffer | undefined = stringToBytes("sent")
            let response = new DefaultQuasiHttpResponse({
                httpVersion: "HTTP/1.1",
                statusCode: 400,
                httpStatusMessage: "Bad, Request",
                contentLength: expectedResBodyBytes.length,
                headers: new Map([
                    ["Status", ["seen"]],
                ])
            })
            let expectedResponse = new DefaultQuasiHttpResponse({
                httpVersion: "HTTP/1.1",
                statusCode: 400,
                httpStatusMessage: "Bad, Request",
                contentLength: expectedResBodyBytes.length,
                headers: new Map([
                    ["status", ["seen"]],
                ])
            })
            let expectedSerializedRes: Buffer | undefined = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 42
                ]),
                stringToBytes("HTTP/1.1,400,\"Bad, Request\",4\n"),
                stringToBytes("Status,seen\n"),
                expectedResBodyBytes
            ])
            yield {
                expectedResBodyBytes,
                response,
                expectedResponse,
                expectedSerializedRes
            }
            
            expectedResBodyBytes = undefined
            response = new DefaultQuasiHttpResponse()
            expectedResponse = new DefaultQuasiHttpResponse({
                httpVersion: "",
                statusCode: 0,
                httpStatusMessage: "",
                contentLength: 0,
                headers: new Map()
            })
            expectedSerializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 10
                ]),
                stringToBytes("\"\",0,\"\",0\n"),
            ])
            yield {
                expectedResBodyBytes,
                response,
                expectedResponse,
                expectedSerializedRes
            }
            
            expectedResBodyBytes = Buffer.from([
                8, 7, 8, 9, 2
            ])
            response = new DefaultQuasiHttpResponse({
                contentLength: -5
            })
            expectedResponse = new DefaultQuasiHttpResponse({
                httpVersion: "",
                statusCode: 0,
                httpStatusMessage: "",
                contentLength: -5,
                headers: new Map()
            })
            expectedSerializedRes = undefined
            yield {
                expectedResBodyBytes,
                response,
                expectedResponse,
                expectedSerializedRes
            }
        }
        let i = -1
        for (const testDataItem of testDataGenerator()) {
            i++
            it(`should pass with input ${i}`, async function() {
                const {
                    expectedResBodyBytes,
                    response,
                    expectedResponse,
                    expectedSerializedRes
                } = testDataItem
                if (expectedResBodyBytes) {
                    response.body = Readable.from(expectedResBodyBytes)
                }
                const chunks = new Array<Buffer>()
                const destStream = new Writable({
                    write(chunk, encoding, cb) {
                        chunks.push(chunk)
                        cb()
                    },
                })
                const serverConnection: any = {
                    writableStream: destStream
                }
                const serverTransport = createServerTransportImpl(true)
                serverTransport.requestDeserializer = async (conn) => {
                    assert.strictEqual(conn, serverConnection)
                    return dummyReq
                }
                const dummyReq = new DefaultQuasiHttpRequest()
                const server = new StandardQuasiHttpServer({
                    transport: serverTransport,
                    application: async (req) => {
                        assert.strictEqual(req, dummyReq)
                        return response
                    }
                })
                await server.acceptConnection(serverConnection)

                if (expectedSerializedRes) {
                    assert.equalBytes(Buffer.concat(chunks),
                        expectedSerializedRes)
                }

                // deserialize
                const remoteEndpoint = {}
                const sendOptions: any = {}
                const memStream = createRandomizedReadSizeBufferReader(
                    Buffer.concat(chunks))
                const clientConnection: any = {
                    processingOptions: sendOptions,
                    readableStream: memStream
                }
                const clientTransport = createClientTransport(true)
                clientTransport.allocateConnection = async (endPt, opts) => {
                    assert.strictEqual(endPt, remoteEndpoint)
                    assert.strictEqual(opts, sendOptions)
                    return {
                        connection: clientConnection
                    }
                }
                clientTransport.requestSerializer = async (conn, req) => {
                    assert.strictEqual(conn, clientConnection)
                    assert.strictEqual(req, dummyReq)
                    return true
                }
                const client = new StandardQuasiHttpClient({
                    transport: clientTransport,
                })
                const actualRes = await client.send(remoteEndpoint, dummyReq,
                    sendOptions);
    
                // assert
                await compareResponses(actualRes,
                    expectedResponse, expectedResBodyBytes);
            })
        }
    })

    describe("TestResponseSerializationForErrors", function() {
        const testDataGenerator = function*() {
            let serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 30
                ]),
                stringToBytes("HTTP/1.1,400,\"Bad, Request\",x\n"),
                stringToBytes("sent")
            ])
            let sendOptions: QuasiHttpProcessingOptions | undefined
            let expectedErrorMsg: string | undefined =
                "invalid quasi http response content length"
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 10
                ]),
                stringToBytes("\"\",y,\"\",0\n")
            ])
            sendOptions = undefined
            expectedErrorMsg = "invalid quasi http response status code"
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x10,
                    0, 0, 0, 10
                ]),
                stringToBytes("\"\",1,\"\",0\n")
            ])
            sendOptions = undefined
            expectedErrorMsg = "unexpected quasi http headers tag"
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 10
                ]),
                stringToBytes("\"\",1,\"\",2\n"),
                stringToBytes("0d")
            ])
            sendOptions = {
                maxResponseBodySize: 2
            }
            expectedErrorMsg = undefined
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 10
                ]),
                stringToBytes("\"\",1,\"\",2\n"),
                stringToBytes("0d")
            ])
            sendOptions = {
                maxResponseBodySize: 1
            }
            expectedErrorMsg = "stream size exceeds limit"
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 10
                ]),
                stringToBytes("\"\",1,\"\",2\n"),
                stringToBytes("0d")
            ])
            sendOptions = {
                maxHeadersSize: 11,
                maxResponseBodySize: -1
            }
            expectedErrorMsg = undefined
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 11
                ]),
                stringToBytes("\"\",1,\"\",-1\n"),
                Buffer.from([
                    0x62, 0x65, 0x78, 0x74,
                    0, 0, 0, 3
                ]),
                stringToBytes("abc"),
                Buffer.from([
                    0x62,0x64, 0x74, 0x61,
                    0, 0, 0, 0
                ]),
            ])
            sendOptions = {
                maxHeadersSize: 11,
                maxResponseBodySize: 1
            }
            expectedErrorMsg = undefined
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 11
                ]),
                stringToBytes("\"\",1,\"\",-1\n"),
                Buffer.from([
                    0x62, 0x64, 0x74, 0x61,
                    0, 0, 0, 3
                ]),
                stringToBytes("abc"),
                Buffer.from([
                    0x62,0x64, 0x74, 0x61,
                    0, 0, 0, 0
                ]),
            ])
            sendOptions = {
                maxResponseBodySize: 1
            }
            expectedErrorMsg = "stream size exceeds limit"
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }

            serializedRes = Buffer.concat([
                Buffer.from([
                    0x68, 0x64, 0x72, 0x73,
                    0, 0, 0, 11
                ]),
                stringToBytes("\"\",1,\"\",82\n"),
                stringToBytes("abc")
            ])
            sendOptions = {
                maxResponseBodySize: -1
            }
            expectedErrorMsg = "end of read"
            yield {
                serializedRes,
                sendOptions,
                expectedErrorMsg
            }
        }
        let i = -1
        for (const testDataItem of testDataGenerator()) {
            i++
            it(`should pass with input ${i}`, async function() {
                const {
                    serializedRes,
                    sendOptions,
                    expectedErrorMsg
                } = testDataItem
                
                const dummyReq = new DefaultQuasiHttpRequest()

                // deserialize
                const remoteEndpoint = {}
                const memStream = createRandomizedReadSizeBufferReader(
                    serializedRes)
                const clientConnection: any = {
                    processingOptions: sendOptions,
                    readableStream: memStream,
                    environment: new Map()
                }
                const clientTransport = createClientTransport(true)
                clientTransport.allocateConnection = async (endPt, opts) => {
                    assert.strictEqual(endPt, remoteEndpoint)
                    assert.strictEqual(opts, sendOptions)
                    return {
                        connection: clientConnection
                    }
                }
                clientTransport.requestSerializer = async (conn, req) => {
                    assert.strictEqual(conn, clientConnection)
                    assert.strictEqual(req, dummyReq)
                    return true
                }
                const client = new StandardQuasiHttpClient({
                    transport: clientTransport,
                })

                if (!expectedErrorMsg) {
                    const res = await client.send2(remoteEndpoint,
                        async (env) => {
                            assert.strictEqual(env, clientConnection.environment)
                            return dummyReq
                        }, sendOptions);
                    if (res?.body) {
                        await readAllBytes(res.body)
                    }
                }
                else {
                    await nativeAssert.rejects(async () => {
                        const res = await client.send2(remoteEndpoint,
                            async (env) => {
                                return dummyReq
                            }, sendOptions);
                        if (res?.body) {
                            await readAllBytes(res.body)
                        }
                    }, (e: any) => {
                        expect(e.message).to.contain(expectedErrorMsg)
                        return true
                    })
                }
            })
        }
    })
})

function createClientTransport(
        initializeSerializerFunctions: boolean): any {
    const transport: any = {
        getReadableStream(connection: any) {
            return connection.readableStream
        },
        getWritableStream(connection: any) {
            return connection.writableStream
        },
        async releaseConnection(connection: any, response: any) {}
    }
    if (initializeSerializerFunctions) {
        transport.requestSerializer = () => Promise.resolve()
        transport.responseSerializer = () => Promise.resolve()
        transport.requestDeserializer = () => Promise.resolve()
        transport.responseDeserializer = () => Promise.resolve()
    }
    return transport
}

function createServerTransportImpl(
        initializeSerializerFunctions: boolean): any {
    const transport: any = {
        getReadableStream(connection: any) {
            return connection.readableStream
        },
        getWritableStream(connection: any) {
            return connection.writableStream
        },
        async releaseConnection(connection: any) {}
    }
    if (initializeSerializerFunctions) {
        transport.requestSerializer = () => Promise.resolve()
        transport.responseSerializer = () => Promise.resolve()
        transport.requestDeserializer = () => Promise.resolve()
        transport.responseDeserializer = () => Promise.resolve()
    }
    return transport
}