import nativeAssert from "assert/strict"
const { expect, assert } = require("chai").use(require("chai-bytes"))
import { Readable, Writable } from "stream";
import {
    IQuasiHttpApplication,
    IQuasiHttpRequest,
    IQuasiHttpResponse
} from "../../../src/quasihttp/types";
import { ISelfWritable } from "../../../src/common/types";
import * as IOUtils from "../../../src/common/IOUtils"
import { CustomChunkedTransferCodec } from "../../../src/quasihttp/chunkedtransfer/CustomChunkedTransferCodec"
import { createChunkEncodingCustomWriter } from "../../../src/quasihttp/chunkedtransfer/ChunkEncodingCustomWriter"
import { SequenceCustomWriter } from "../../shared/quasihttp/SequenceCustomWriter";
import { createSequenceCustomReader } from "../../shared/quasihttp/SequenceCustomReader";
import { MissingDependencyError } from "../../../src/common/errors";
import { DefaultReceiveProtocolInternal } from "../../../src/quasihttp/server/DefaultReceiveProtocolInternal"
import { DefaultQuasiHttpRequest } from "../../../src/quasihttp/DefaultQuasiHttpRequest";
import { DefaultQuasiHttpResponse } from "../../../src/quasihttp/DefaultQuasiHttpResponse";
import { ChunkDecodingError, ChunkEncodingError, QuasiHttpRequestProcessingError } from "../../../src/quasihttp/errors";
import { DemoQuasiHttpTransport } from "../../shared/quasihttp/DemoQuasiHttpTransport";
import { LambdaBasedQuasiHttpBody } from "../../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody";
import { compareLeadChunks, compareRequests } from "../../shared/common/ComparisonUtils"
import { createChunkDecodingCustomReader } from "../../../src/quasihttp/chunkedtransfer/ChunkDecodingCustomReader";
import { stringToBytes } from "../../../src/common/ByteUtils";
import { ByteBufferBody } from "../../../src/quasihttp/entitybody/ByteBufferBody";
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody";
import * as QuasiHttpUtils from "../../../src/quasihttp/QuasiHttpUtils"
import { getBodyReader } from "../../../src/quasihttp/entitybody/EntityBodyUtils";

function setUpReceivingOfResponseToBeWritten(
        response: IQuasiHttpResponse,
        expectedResBodyBytes: Buffer | undefined,
        headerReceiver: Writable,
        bodyReceiver: Writable) {
    const backingWriters = new Array<Writable>()
    const helpingWriter = new SequenceCustomWriter(
        backingWriters)
    backingWriters.push(headerReceiver)
    if (response.body?.contentLength) {
        backingWriters.push(bodyReceiver)
        // update body with writable.
        response.body["selfWritable"] = {
            async writeBytesTo(writer) {
                helpingWriter.switchOver()
                await IOUtils.writeBytes(writer, expectedResBodyBytes!)
            },
        } as ISelfWritable
    }
    return helpingWriter
}

async function serializeRequestToBeRead(
        req: IQuasiHttpRequest, reqBodyBytes: Buffer | undefined) {
    const reqChunk = CustomChunkedTransferCodec.createFromRequest(
        req)
    const helpingReaders = new Array<Readable>()
    const chunks = new Array<Buffer>()
    const writer = new Writable({
        async write(chunk, encoding, cb) {
            chunks.push(chunk)
            cb()
        }
    })
    await new CustomChunkedTransferCodec().writeLeadChunk(writer,
        reqChunk, CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
    const headerStream = Readable.from(Buffer.concat(
        chunks))
    helpingReaders.push(headerStream)
    if (req.body) {
        chunks.length = 0 // reuse writer
        let reqBodyWriter = writer
        let endWrites = false
        if (reqChunk.contentLength! < 0) {
            reqBodyWriter = createChunkEncodingCustomWriter(
                reqBodyWriter)
            endWrites = true
        }
        await IOUtils.writeBytes(reqBodyWriter, reqBodyBytes!)
        if (endWrites) {
            await IOUtils.endWrites(reqBodyWriter)
        }
        const reqBodyStream = Readable.from(Buffer.concat(
            chunks))
        helpingReaders.push(reqBodyStream)
    }
    return createSequenceCustomReader(helpingReaders)
}

async function createReqStream(
        req: IQuasiHttpRequest,
        maxChunkSize: number,
        bodyMaxChunkSize: number) {
    const reqChunks = new Array<Buffer>()
    const reqWriter = new Writable({
        write(chunk, encoding, cb) {
            reqChunks.push(chunk)
            cb()
        },
    })
    await new CustomChunkedTransferCodec()
        .writeLeadChunk(reqWriter, 
            CustomChunkedTransferCodec.createFromRequest(req),
            maxChunkSize)
    if (req.body) {
        if (req.body.contentLength < 0) {
            const encoder = createChunkEncodingCustomWriter(reqWriter,
                bodyMaxChunkSize)
            await req.body.writeBytesTo(encoder)
            await IOUtils.endWrites(encoder)
        }
        else {
            await req.body.writeBytesTo(reqWriter)
        }
    }
    return Readable.from(Buffer.concat(reqChunks))
}

describe("DefaultReceiveProtocolInternal", function() {
    it("test receive for dependency errors", async function() {
        await nativeAssert.rejects(async () => {
            const instance = new DefaultReceiveProtocolInternal({
                transport: {} as any,
                application: null as any
            })
            await instance.receive()
        }, MissingDependencyError)

        await nativeAssert.rejects(async () => {
            const instance = new DefaultReceiveProtocolInternal({
                application: {} as any,
                transport: null as any 
            })
            await instance.receive()
        }, MissingDependencyError)
    })

    it("test no reader for request headers error", async function() {
        const connection = []
        const application: IQuasiHttpApplication = {
            async processRequest(request) {
                return new DefaultQuasiHttpResponse()
            },
        }
        const resStream = new Writable({
            write(chunk, encoding, callback) {
                callback()
            },
        })
        const transport = new DemoQuasiHttpTransport(connection,
            null as any, resStream)
        const instance = new DefaultReceiveProtocolInternal({
            application,
            transport,
            connection
        })

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, (err: any) => {
            assert.instanceOf(err, QuasiHttpRequestProcessingError)
            expect(err.message).to.contain("no reader for connection")
            return true
        })
    })

    it("test no writer for response headers error", async function() {
        const connection = []
        const request = new DefaultQuasiHttpRequest()
        const reqStream = await createReqStream(request,
            0, 0);
        const application: IQuasiHttpApplication = {
            async processRequest(request) {
                return new DefaultQuasiHttpResponse()
            },
        }
        const transport = new DemoQuasiHttpTransport(connection,
            reqStream, null as any)
        const instance = new DefaultReceiveProtocolInternal({
            application,
            transport,
            connection
        })

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, (err: any) => {
            assert.instanceOf(err, QuasiHttpRequestProcessingError)
            expect(err.message).to.contain(
                "no writer for connection")
            return true
        })
    })

    it("test receive for rejection of null responses", async function() {
        const connection = "example"
        const request = new DefaultQuasiHttpRequest()
        const expectedResponse = undefined
        
        const helpingReader = await serializeRequestToBeRead(
            request, undefined)
        const chunks = new Array<Buffer>()
        const headerReceiver = new Writable({
            async write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            }
        })

        const transport = new DemoQuasiHttpTransport(
            connection, helpingReader, headerReceiver)
        
        const app: IQuasiHttpApplication = {
            async processRequest(request) {
                return expectedResponse
            }
        }
        const instance = new DefaultReceiveProtocolInternal({
            application: app,
            transport: transport,
            maxChunkSize: 50,
            connection: connection
        })

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, (err: any) => {
            assert.instanceOf(err, QuasiHttpRequestProcessingError)
            expect(err.message).to.contain("no response")
            return true
        })
        assert.equal(transport.releaseCallCount, 0)

        await instance.cancel()
        assert.equal(transport.releaseCallCount, 1)
    })

    it("test receive ensures release on non-null response", async function() {
        const connection = ["example"]
        const request = new DefaultQuasiHttpRequest()
        let responseReleaseCallCount = 0
        const expectedResponse: IQuasiHttpResponse = {
            async release() {
                responseReleaseCallCount++
                throw new Error("should be ignored");
            },
            body: new LambdaBasedQuasiHttpBody(() => {
                throw new Error("NIE");
            })
        }

        const helpingReader = await serializeRequestToBeRead(
            request, undefined)
        const chunks = new Array<Buffer>()
        let headerReceiver: any = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()    
            }
        })

        const transport = new DemoQuasiHttpTransport(connection,
            helpingReader, headerReceiver)

        const app: IQuasiHttpApplication = {
            async processRequest(request) {
                return expectedResponse
            }
        }
        const instance = new DefaultReceiveProtocolInternal({
            application: app,
            transport,
            maxChunkSize: 50,
            connection
        })

        // set up expected response headers
        const expectedResChunk =
            CustomChunkedTransferCodec.createFromResponse(expectedResponse)

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, {
            message: "NIE"
        })

        assert.equal(responseReleaseCallCount, 1)
        assert.equal(transport.releaseCallCount, 0)

        // assert written response
        headerReceiver = Readable.from(Buffer.concat(chunks))
        const actualResChunk = await new CustomChunkedTransferCodec()
            .readLeadChunk(headerReceiver)
        // verify all contents of headerReceiver was used
        // before comparing lead chunks
        assert.equal(await IOUtils.readBytes(headerReceiver,
            Buffer.alloc(1)), 0)
        compareLeadChunks(actualResChunk, expectedResChunk)
        
        await instance.cancel()
        assert.equal(transport.releaseCallCount, 1)
    })

    describe("#receive", function() {
        const createTestReceiveData = function*() {
            // NB: all request bodies are specified with LambdaBasedQuasiHttpBody class
            // through just the ContentLength property.
            // body will be created as an ISelfWritable from any reqBodyBytes
            // as long as ContentLength is not zero.

            // next...
            let connection: any = "vgh"
            let maxChunkSize = 100
            let reqEnv: Map<string, any> | undefined;
            let request = new DefaultQuasiHttpRequest({
                method: "POST",
                target: "/koobi",
                headers: new Map([
                    ["variant", ["sea", "drive"]]
                ])
            })
            let requestBodyBytes: Buffer | undefined = stringToBytes("this is our king")
            request.body = new ByteBufferBody(requestBodyBytes)
            let expectedResponse = new DefaultQuasiHttpResponse({
                statusCode: 200,
                httpStatusMessage: "ok",
                headers: new Map([
                    ["dkt", ["bb"]]
                ])
            })
            let expectedResBodyBytes: Buffer | undefined = stringToBytes("and this is our queen")
            expectedResponse.body = new LambdaBasedQuasiHttpBody()
            expectedResponse.body.contentLength = expectedResBodyBytes.length
            yield {
                connection,
                maxChunkSize,
                request,
                requestBodyBytes,
                reqEnv,
                expectedResponse,
                expectedResBodyBytes
            }

            // next...
            connection = 123
            maxChunkSize = 95
            reqEnv = new Map([
                ["is_ssl", "true"]
            ])
            request = new DefaultQuasiHttpRequest({
                target: "/p"
            })
            requestBodyBytes = undefined
            expectedResponse = new DefaultQuasiHttpResponse({
                statusCode: 400,
                httpStatusMessage: "not found"
            })
            expectedResBodyBytes = undefined
            yield {
                connection,
                maxChunkSize,
                request,
                requestBodyBytes,
                reqEnv,
                expectedResponse,
                expectedResBodyBytes
            }

            // next...
            connection = undefined
            maxChunkSize = 90
            reqEnv = new Map()
            request = new DefaultQuasiHttpRequest({
                httpVersion: "1.1",
                target: "/bread"
            })
            requestBodyBytes = stringToBytes("<a>this is news</a>")
            request.body = new ByteBufferBody(requestBodyBytes)
            request.body.contentLength = -1
            expectedResponse = new DefaultQuasiHttpResponse({
                httpVersion: "1.1",
                statusCode: 500,
                httpStatusMessage: "server error"
            })
            expectedResBodyBytes = undefined
            yield {
                connection,
                maxChunkSize,
                request,
                requestBodyBytes,
                reqEnv,
                expectedResponse,
                expectedResBodyBytes
            }

            // next...
            connection = {}
            maxChunkSize = 150
            reqEnv = new Map<string, any>([
                ["r", 2], ["tea", Buffer.alloc(3)]
            ])
            request = new DefaultQuasiHttpRequest({
                target: "/fxn",
                headers: new Map([
                    ["x", []],
                    ["a", ["A"]],
                    ["bb", ["B1", "B2"]],
                    ["ccc", ["C1", "C2", "C3"]]
                ])
            })
            requestBodyBytes = undefined
            expectedResponse = new DefaultQuasiHttpResponse({
                statusCode: 200,
                httpStatusMessage: "ok",
                headers: new Map([
                    ["x", ["A"]],
                    ["y", ["B1", "B2", "C1", "C2", "C3"]]
                ])
            })
            expectedResBodyBytes = stringToBytes("<a>this is news</a>")
            expectedResponse.body = new LambdaBasedQuasiHttpBody()
            expectedResponse.body.contentLength = expectedResBodyBytes.length
            yield {
                connection,
                maxChunkSize,
                request,
                requestBodyBytes,
                reqEnv,
                expectedResponse,
                expectedResBodyBytes
            }

            // next...
            connection = []
            maxChunkSize = 150_000
            reqEnv = undefined
            request = new DefaultQuasiHttpRequest({
                target: "/fxn".padStart(70_000)
            })
            requestBodyBytes = Buffer.alloc(80_000)
            request.body = new ByteBufferBody(requestBodyBytes)
            request.body.contentLength = -1
            expectedResponse = new DefaultQuasiHttpResponse({
                httpStatusMessage: "ok".padStart(90_000)
            })
            expectedResBodyBytes = Buffer.alloc(100_000)
            expectedResponse.body = new LambdaBasedQuasiHttpBody()
            expectedResponse.body.contentLength = -1
            yield {
                connection,
                maxChunkSize,
                request,
                requestBodyBytes,
                reqEnv,
                expectedResponse,
                expectedResBodyBytes
            }
        }

        let i = 0
        for (const testDataItem of createTestReceiveData()) {
            i++
            const {
                connection,
                maxChunkSize,
                request,
                requestBodyBytes,
                reqEnv,
                expectedResponse,
                expectedResBodyBytes
            } = testDataItem
            it(`should pass with input ${i}`, async function() {
                // prepare request for reading.
                const helpingReader = await serializeRequestToBeRead(
                    request, requestBodyBytes);
                
                // prepare to receive response to be written
                const hChunks = new Array<Buffer>()
                let headerReceiver: any = new Writable({
                    write(chunk, encoding, cb) {
                        hChunks.push(chunk)
                        cb()
                    },
                })
                const bChunks = new Array<Buffer>()
                let bodyReceiver: any = new Writable({
                    write(chunk, encoding, cb) {
                        bChunks.push(chunk)
                        cb()
                    },
                })
                const helpingWriter = setUpReceivingOfResponseToBeWritten(
                    expectedResponse, expectedResBodyBytes,
                    headerReceiver, bodyReceiver)
                
                // set up instance
                const transport = new DemoQuasiHttpTransport(
                    connection, helpingReader, helpingWriter)
                let actualRequest: IQuasiHttpRequest | undefined;
                const application: IQuasiHttpApplication = {
                    async processRequest(request) {
                        actualRequest = request
                        return expectedResponse
                    },
                }
                const instance = new DefaultReceiveProtocolInternal({
                    application,
                    transport,
                    connection,
                    maxChunkSize,
                    requestEnvironment: reqEnv
                })

                // set up expected response headers
                const expectedResChunk = CustomChunkedTransferCodec
                    .createFromResponse(expectedResponse)

                // act
                const recvResult = await instance.receive()

                // begin assert
                assert.isNotOk(recvResult)
                assert.equal(transport.releaseCallCount, 0)

                // assert read request.
                await compareRequests(actualRequest, request,
                    requestBodyBytes)
                assert.deepEqual(actualRequest?.environment, reqEnv)

                // assert written response
                headerReceiver = Readable.from(Buffer.concat(
                    hChunks))
                const actualResChunk = await new CustomChunkedTransferCodec()
                    .readLeadChunk(headerReceiver,
                        CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
                // verify all contents of headerReceiver was used
                // before comparing lead chunks
                assert.equal(await IOUtils.readBytes(headerReceiver,
                    Buffer.alloc(1)), 0)
                compareLeadChunks(actualResChunk, expectedResChunk)

                bodyReceiver = Readable.from(Buffer.concat(
                    bChunks))
                if (expectedResChunk.contentLength! < 0) {
                    bodyReceiver = createChunkDecodingCustomReader(
                        bodyReceiver, CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
                }
                const actualResBodyBytes = await IOUtils.readAllBytes(bodyReceiver)
                if (expectedResponse.body) {
                    assert.equalBytes(actualResBodyBytes, expectedResBodyBytes)
                }
                else {
                    assert.isEmpty(actualResBodyBytes)
                }

                // verify cancel expectations
                await instance.cancel()
                assert.equal(transport.releaseCallCount, 1)
            })
        }
    })

    it("test receive involving not sending response", async function() {
        const connection = "fire and forget example";
        const request = new DefaultQuasiHttpRequest();

        const helpingReader = await serializeRequestToBeRead(
            request, undefined);
        const chunks = new Array<Buffer>()
        let headerReceiver = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })

        const transport = new DemoQuasiHttpTransport(connection,
            helpingReader, headerReceiver)
        let responseReleaseCallCount = 0
        const expecteedResponse: IQuasiHttpResponse = {
            environment: new Map([
                [
                    QuasiHttpUtils.RES_ENV_KEY_SKIP_RESPONSE_SENDING,
                    true
                ]
            ]),
            async release() {
                responseReleaseCallCount++
            },
        }
        const app: IQuasiHttpApplication = {
            async processRequest(request) {
                return expecteedResponse
            },
        }
        const instance = new DefaultReceiveProtocolInternal({
            application: app,
            transport,
            maxChunkSize: 50,
            connection
        })

        const recvResult = await instance.receive()
        assert.isNotOk(recvResult)
        assert.equal(responseReleaseCallCount, 1)
        assert.equal(transport.releaseCallCount, 0)
        assert.isEmpty(chunks)

        await instance.cancel()
        assert.equal(transport.releaseCallCount, 1)
    })

    it("test request headers exceed max chunk size error", async function() {
        const connection = []
        const request = new DefaultQuasiHttpRequest({
            target: "/fxn".padStart(70_000)
        })
        const reqStream = await createReqStream(request,
            100_000, 0);
        const application: IQuasiHttpApplication = {
            async processRequest(request) {
                return new DefaultQuasiHttpResponse()
            },
        }
        const resStream = new Writable({
            write(chunk, encoding, callback) {
                callback()
            },
        })
        const transport = new DemoQuasiHttpTransport(connection,
            reqStream, resStream)
        const instance = new DefaultReceiveProtocolInternal({
            application,
            transport,
            connection,
            maxChunkSize: 65_000
        })

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, (err: any) => {
            assert.instanceOf(err, ChunkDecodingError)
            expect(err.message).to.contain("quasi http headers")
            assert.isOk(err.cause)
            expect(err.cause.message).to.contain("chunk size exceeding max")
            return true
        })
    })

    it("test request body with chunks exceeding max chunk size error", async function() {
        const connection = []
        const request = new DefaultQuasiHttpRequest()
        request.body = new StringBody("data".padStart(70_000))
        request.body.contentLength = -1
        const reqStream = await createReqStream(request,
            0, 100_000);
        const application: IQuasiHttpApplication = {
            async processRequest(request) {
                // readAllBytes should throw error
                await IOUtils.readAllBytes(getBodyReader(request.body))
                return new DefaultQuasiHttpResponse()
            },
        }
        const resStream = new Writable({
            write(chunk, encoding, callback) {
                callback()
            },
        })
        const transport = new DemoQuasiHttpTransport(connection,
            reqStream, resStream)
        const instance = new DefaultReceiveProtocolInternal({
            application,
            transport,
            connection,
            maxChunkSize: 69_000
        })

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, (err: any) => {
            assert.instanceOf(err, ChunkDecodingError)
            expect(err.message).to.contain("quasi http body")
            assert.isOk(err.cause)
            expect(err.cause.message).to.contain("chunk size exceeding max")
            return true
        })
    })

    it("test response headers exceed max chunk size error", async function() {
        const connection = []
        const request = new DefaultQuasiHttpRequest()
        const reqStream = await createReqStream(request,
            0, 0);
        const application: IQuasiHttpApplication = {
            async processRequest(request) {
                return new DefaultQuasiHttpResponse({
                    headers: new Map([
                        ["h1", ["1".padStart(90)]]
                    ])
                })
            },
        }
        const resStream = new Writable({
            write(chunk, encoding, callback) {
                callback()
            },
        })
        const transport = new DemoQuasiHttpTransport(connection,
            reqStream, resStream)
        const instance = new DefaultReceiveProtocolInternal({
            application,
            transport,
            connection,
            maxChunkSize: 81
        })

        await nativeAssert.rejects(async () => {
            await instance.receive()
        }, (err: any) => {
            assert.instanceOf(err, ChunkEncodingError)
            expect(err.message).to.contain(
                "quasi http headers exceed max")
            return true
        })
    })

    describe("test response body with various max chunk sizes", function() {
        const testData = [
            {
                maxChunkSize: 0,
                shouldWork: false
            },
            {
                maxChunkSize: 8_192,
                shouldWork: false,
            },
            {
                maxChunkSize: 10_000,
                shouldWork: false,
            },
            {
                maxChunkSize: 100_000,
                shouldWork: true,
            },
            {
                maxChunkSize: 8_000_000,
                shouldWork: true,
            },
            {
                maxChunkSize: 10_000_000,
                shouldWork: true,
            }
        ]
        testData.forEach(({maxChunkSize, shouldWork}, i) => {
            it(`should pass with input ${i}`, async function() {
                const connection = {}
                const request = new DefaultQuasiHttpRequest()
                request.body = new StringBody("data".padStart(70_000))
                request.body.contentLength = -1
                const reqStream = await createReqStream(request,
                    0, 100_000);
                const application: IQuasiHttpApplication = {
                    async processRequest(request) {
                        const res = new DefaultQuasiHttpResponse()
                        res.body = new StringBody("1".padStart(95_000))
                        res.body.contentLength = -1
                        return res;
                    },
                }
                const chunks = new Array<Buffer>()
                let resStream: any = new Writable({
                    write(chunk, encoding, callback) {
                        chunks.push(chunk)
                        callback()
                    }
                })
                const transport = new DemoQuasiHttpTransport(connection,
                    reqStream, resStream)
                const instance = new DefaultReceiveProtocolInternal({
                    application,
                    transport,
                    connection,
                    maxChunkSize: 82_0000
                })

                await instance.receive()

                resStream = createChunkDecodingCustomReader(
                    Readable.from(Buffer.concat(chunks)),
                    maxChunkSize)

                if (shouldWork) {
                    await IOUtils.readAllBytes(resStream)
                    return;
                }

                await nativeAssert.rejects(async () => {
                    await IOUtils.readAllBytes(resStream)
                }, (err: any) => {
                    assert.instanceOf(err, ChunkDecodingError)
                    expect(err.message).to.contain("quasi http body")
                    assert.isOk(err.cause)
                    expect(err.cause.message).to.contain("chunk size exceeding max")
                    return true
                })
            })
        })
    })
})