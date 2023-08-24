import nativeAssert from "assert/strict"
const { expect, assert } = require("chai").use(require("chai-bytes"))
import { Readable, Writable } from "stream";
import {
    IQuasiHttpRequest,
    IQuasiHttpResponse
} from "../../../src/quasihttp/types";
import { ISelfWritable } from "../../../src/common/types";
import * as IOUtils from "../../../src/common/IOUtils"
import { CustomChunkedTransferCodec } from "../../../src/quasihttp/chunkedtransfer/CustomChunkedTransferCodec"
import { createChunkEncodingCustomWriter } from "../../../src/quasihttp/chunkedtransfer/ChunkEncodingCustomWriter"
import { SequenceCustomWriter } from "../../shared/quasihttp/SequenceCustomWriter";
import { createSequenceCustomReader } from "../../shared/quasihttp/SequenceCustomReader";
import { ExpectationViolationError, MissingDependencyError } from "../../../src/common/errors";
import { DefaultSendProtocolInternal } from "../../../src/quasihttp/client/DefaultSendProtocolInternal"
import { DefaultQuasiHttpRequest } from "../../../src/quasihttp/DefaultQuasiHttpRequest";
import { DefaultQuasiHttpResponse } from "../../../src/quasihttp/DefaultQuasiHttpResponse";
import { ChunkDecodingError, ChunkEncodingError, QuasiHttpRequestProcessingError } from "../../../src/quasihttp/errors";
import { DemoQuasiHttpTransport } from "../../shared/quasihttp/DemoQuasiHttpTransport";
import { LambdaBasedQuasiHttpBody } from "../../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody";
import { compareLeadChunks, compareResponses } from "../../shared/common/ComparisonUtils"
import { createChunkDecodingCustomReader } from "../../../src/quasihttp/chunkedtransfer/ChunkDecodingCustomReader";
import { stringToBytes } from "../../../src/common/ByteUtils";
import { ByteBufferBody } from "../../../src/quasihttp/entitybody/ByteBufferBody";
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody";
import * as QuasiHttpUtils from "../../../src/quasihttp/QuasiHttpUtils"
import { getBodyReader } from "../../../src/quasihttp/entitybody/EntityBodyUtils";

function setUpReceivingOfRequestToBeWritten(
        request: IQuasiHttpRequest,
        delegateWritableForBody: ISelfWritable | undefined,
        headerReceiver: Writable,
        bodyReceiver: Writable) {
    const backingWriters = new Array<Writable>()
    const helpingWriter = new SequenceCustomWriter(
        backingWriters)
    backingWriters.push(headerReceiver)
    if (request.body?.contentLength) {
        backingWriters.push(bodyReceiver)
        // update body with writable.
        request.body["selfWritable"] = {
            async writeBytesTo(writer) {
                helpingWriter.switchOver()
                await delegateWritableForBody!.writeBytesTo(writer)
            },
        } as ISelfWritable
    }
    return helpingWriter
}

async function serializeResponseToBeRead(
        res: IQuasiHttpRequest, resBodyBytes: Buffer | undefined) {
    const resChunk = CustomChunkedTransferCodec.createFromResponse(
        res)
    const helpingReaders = new Array<Readable>()
    const chunks = new Array<Buffer>()
    const writer = new Writable({
        async write(chunk, encoding, cb) {
            chunks.push(chunk)
            cb()
        }
    })
    await new CustomChunkedTransferCodec().writeLeadChunk(writer,
        resChunk, CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
    const headerStream = Readable.from(Buffer.concat(
        chunks))
    helpingReaders.push(headerStream)
    if (res.body) {
        chunks.length = 0 // reuse writer
        let resBodyWriter = writer
        let endWrites = false
        if (resChunk.contentLength! < 0) {
            resBodyWriter = createChunkEncodingCustomWriter(
                resBodyWriter)
            endWrites = true
        }
        await IOUtils.writeBytes(resBodyWriter, resBodyBytes!)
        if (endWrites) {
            await IOUtils.endWrites(resBodyWriter)
        }
        const resBodyStream = Readable.from(Buffer.concat(
            chunks))
        helpingReaders.push(resBodyStream)
    }
    return createSequenceCustomReader(helpingReaders)
}

async function createResStream(
        res: IQuasiHttpResponse,
        maxChunkSize: number,
        bodyMaxChunkSize: number) {
    const resChunks = new Array<Buffer>()
    const resWriter = new Writable({
        write(chunk, encoding, cb) {
            resChunks.push(chunk)
            cb()
        },
    })
    await new CustomChunkedTransferCodec()
        .writeLeadChunk(resWriter, 
            CustomChunkedTransferCodec.createFromResponse(res),
            maxChunkSize)
    if (res.body) {
        if (res.body.contentLength < 0) {
            const encoder = createChunkEncodingCustomWriter(resWriter,
                bodyMaxChunkSize)
            await res.body.writeBytesTo(encoder)
            await IOUtils.endWrites(encoder)
        }
        else {
            await res.body.writeBytesTo(resWriter)
        }
    }
    return Readable.from(Buffer.concat(resChunks))
}

describe("DefaultSendProtocolInternal", function() {
    it("test send for dependency errors", async function() {
        await nativeAssert.rejects(async () => {
            const instance = new DefaultSendProtocolInternal({
                request: new DefaultQuasiHttpRequest(),
                transport: null as any
            })
            await instance.send()
        }, MissingDependencyError)

        await nativeAssert.rejects(async () => {
            const instance = new DefaultSendProtocolInternal({
                request: null as any,
                transport: new DemoQuasiHttpTransport(null,
                    null as any, null as any) 
            })
            await instance.send()
        }, ExpectationViolationError)
    })

    it("test no writer for request headers error", async function() {
        const connection = {}
        const resStream = await createResStream(
            new DefaultQuasiHttpResponse(), 0, 0)
        const transport = new DemoQuasiHttpTransport(connection,
            resStream, null as any)
        const instance = new DefaultSendProtocolInternal({
            request: new DefaultQuasiHttpRequest(),
            transport,
            connection
        })

        await nativeAssert.rejects(async () => {
            await instance.send()
        }, (err: any) => {
            assert.instanceOf(err, QuasiHttpRequestProcessingError)
            expect(err.message).to.contain("no writer for connection")
            return true
        })
    })

    it("test no reader for response headers error", async function() {
        const connection = {}
        const reqStream = new Writable({
            write(chunk, encoding, callback) {
                callback()
            },
        })
        const transport = new DemoQuasiHttpTransport(connection,
            null as any, reqStream)
        const instance = new DefaultSendProtocolInternal({
            request: new DefaultQuasiHttpRequest(),
            transport,
            connection
        })

        await nativeAssert.rejects(async () => {
            await instance.send()
        }, (err: any) => {
            assert.instanceOf(err, QuasiHttpRequestProcessingError)
            expect(err.message).to.contain("no reader for connection")
            return true
        })
    })

    describe("#send", function() {
        const createTestSendData = function*() {
            // NB: all response bodies are specified with LambdaBasedQuasiHttpBody class
            // through just the ContentLength property.
            // body will be created as an ISelfWritable from any resBodyBytes
            // as long as ContentLength is not zero.

            // next...
            let connection: any = "vgh"
            let maxChunkSize = 115
            let responseBufferingEnabled = true
            let expectedRequest = new DefaultQuasiHttpRequest({
                method: "POST",
                target: "/koobi",
                headers: new Map([
                    ["variant", ["sea", "drive"]]
                ])
            })
            let expectedReqBodyBytes: Buffer | undefined
            /*expectedReqBodyBytes: Buffer | undefined = stringToBytes("this is our king")
            expectedRequest.body = new LambdaBasedQuasiHttpBody()
            expectedRequest.body.contentLength = expectedReqBodyBytes.length*/

            let response = new DefaultQuasiHttpResponse({
                statusCode: 200,
                httpStatusMessage: "ok",
                headers: new Map([
                    ["dkt", ["bb"]]
                ])
            })
            let resBodyBytes: Buffer | undefined = stringToBytes("and this is our queen")
            response.body = new ByteBufferBody(resBodyBytes)
            yield {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            }

            // next...
            connection = 123
            maxChunkSize = 90
            responseBufferingEnabled = false
            expectedRequest = new DefaultQuasiHttpRequest({
                target: "/p"
            })
            expectedReqBodyBytes = undefined

            response = new DefaultQuasiHttpResponse({
                statusCode: 400,
                httpStatusMessage: "not found"
            })
            resBodyBytes = undefined
            yield {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            }

            // next..
            connection = {}
            maxChunkSize = 100
            responseBufferingEnabled = true
            expectedRequest = new DefaultQuasiHttpRequest({
                target: "/fxn",
                headers: new Map([
                    ["x", []],
                    ["a", ["A"]],
                    ["bb", ["B1", "B2"]],
                    ["ccc", ["C1", "C2", "C3"]]
                ])
            })
            expectedReqBodyBytes = undefined

            response = new DefaultQuasiHttpResponse({
                statusCode: 500,
                httpStatusMessage: "server error",
                headers: new Map([
                    ["x", ["A"]],
                    ["y", ["B1", "B2", "C1", "C2", "C3"]]
                ])
            })
            resBodyBytes = stringToBytes("<a>this is news</a>")
            response.body = new ByteBufferBody(resBodyBytes)
            response.body.contentLength = -1
            yield {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            }

            // next...
            // zero content length in request
            connection = "..";
            maxChunkSize = 50;
            responseBufferingEnabled = false;
            expectedRequest = new DefaultQuasiHttpRequest();
            expectedReqBodyBytes = Buffer.alloc(0)
            expectedRequest.body = new LambdaBasedQuasiHttpBody()
            expectedRequest.body.contentLength = 0

            response = new DefaultQuasiHttpResponse({
                statusCode: 200,
                headers: new Map()
            })
            resBodyBytes = Buffer.alloc(1)
            response.body = new ByteBufferBody(resBodyBytes)
            yield {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            }

            // exceed buffering limit of 100 specified in test method
            connection = true;
            maxChunkSize = 40;
            responseBufferingEnabled = false;
            expectedRequest = new DefaultQuasiHttpRequest();
            expectedReqBodyBytes = undefined;

            response = new DefaultQuasiHttpResponse({
                statusCode: 200,
                headers: new Map()
            })
            resBodyBytes = stringToBytes("dk".padEnd(120))
            response.body = new ByteBufferBody(resBodyBytes)
            response.body.contentLength = -1
            yield {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            }

            // next...
            connection = []
            maxChunkSize = 150_000
            responseBufferingEnabled = false;
            expectedRequest = new DefaultQuasiHttpRequest({
                target: "/fxn".padStart(70_000)
            })
            /*expectedReqBodyBytes = Buffer.alloc(80_000)
            expectedRequest.body = new LambdaBasedQuasiHttpBody()
            expectedRequest.body.contentLength = -1*/

            response = new DefaultQuasiHttpResponse({
                httpStatusMessage: "ok".padStart(90_000)
            })
            resBodyBytes = Buffer.alloc(100_000)
            response.body = new ByteBufferBody(resBodyBytes)
            response.body.contentLength = -1
            yield {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            }
        }
        let i = 0
        for (const testDataItem of createTestSendData()) {
            i++
            const {
                connection,
                maxChunkSize,
                responseBufferingEnabled,
                expectedRequest,
                expectedReqBodyBytes,
                response,
                resBodyBytes
            } = testDataItem
            it(`should pass with input ${i}`, async function() {
                // prepare response for reading.
                const helpingReader = await serializeResponseToBeRead(
                    response, resBodyBytes);

                // prepare to receive request to be written
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
                let bodyWritable: ISelfWritable | undefined
                if (expectedReqBodyBytes) {
                    bodyWritable = {
                        async writeBytesTo(writer) {
                            await IOUtils.writeBytes(writer, expectedReqBodyBytes)
                        },
                    } as ISelfWritable
                }
                const helpingWriter = setUpReceivingOfRequestToBeWritten(
                    expectedRequest, bodyWritable,
                    headerReceiver, bodyReceiver)

                // set up instance
                const transport = new DemoQuasiHttpTransport(connection,
                    helpingReader, helpingWriter)
                const instance = new DefaultSendProtocolInternal({
                    request: expectedRequest,
                    transport,
                    connection,
                    maxChunkSize,
                    responseBufferingEnabled,
                    responseBodyBufferingSizeLimit: 100,
                    ensureTruthyResponse: true
                })

                // set up expected request headers
                const expectedReqChunk = CustomChunkedTransferCodec
                    .createFromRequest(expectedRequest)
                expectedReqChunk.statusCode = 0 // just to pass tests.

                // act
                const actualResponse = await instance.send()

                // begin assert
                assert.isOk(actualResponse)
                assert.isOk(actualResponse?.response)
                assert.equal(transport.releaseCallCount, 0)
                assert.equal(actualResponse?.responseBufferingApplied,
                    responseBufferingEnabled)

                // assert read response
                await compareResponses(actualResponse?.response,
                    response, resBodyBytes)

                // assert written request.
                headerReceiver = Readable.from(Buffer.concat(
                    hChunks))
                const actualReqChunk = await new CustomChunkedTransferCodec()
                    .readLeadChunk(headerReceiver,
                        CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
                // verify all contents of headerReceiver was used
                // before comparing lead chunks
                assert.equal(await IOUtils.readBytes(headerReceiver,
                    Buffer.alloc(1)), 0)
                compareLeadChunks(actualReqChunk, expectedReqChunk)

                bodyReceiver = Readable.from(Buffer.concat(
                    bChunks))
                if (expectedReqChunk.contentLength! < 0) {
                    bodyReceiver = createChunkDecodingCustomReader(
                        bodyReceiver, CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
                }
                const actualReqBodyBytes = await IOUtils.readAllBytes(bodyReceiver)
                if (expectedRequest.body) {
                    assert.equalBytes(actualReqBodyBytes, expectedReqBodyBytes)
                }
                else {
                    assert.isEmpty(actualReqBodyBytes)
                }

                // verify cancel expectations
                await instance.cancel()
                await actualResponse?.response?.release()
                if (actualResponse?.response?.body && !responseBufferingEnabled) {
                    assert.equal(transport.releaseCallCount, 2)
                }
                else {
                    assert.equal(transport.releaseCallCount, 1)
                }
            })
        }
    })

    /*it("test send for abort on request body read error", async function() {
        // arrange
        const connection = "drew"
        let maxChunkSize = 80
    })*/
})