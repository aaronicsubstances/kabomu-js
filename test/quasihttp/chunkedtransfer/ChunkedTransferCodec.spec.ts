import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))

import { ChunkedTransferCodec } from "../../../src/quasihttp/chunkedtransfer/ChunkedTransferCodec"
import * as ByteUtils from "../../../src/common/ByteUtils"
import { Readable, Writable } from "stream"
import { IQuasiHttpRequest, IQuasiHttpResponse, LeadChunk } from "../../../src/quasihttp/types"
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody"
import { compareLeadChunks } from "../../shared/common/ComparisonUtils"

describe("ChunkedTransferCodec", function() {
    describe("internal tests without chunk length encoding/decoding", function() {
        it("should pass (1)", async function() {
            const expectedChunk: LeadChunk ={
                version: ChunkedTransferCodec.VERSION_01,
                contentLength: 0,
                flags: 0,
                statusCode: 0
            }
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            })
            const instance = new ChunkedTransferCodec()
            instance._updateSerializedRepresentation(expectedChunk)
            const computedByteCount = instance._calculateSizeInBytesOfSerializedRepresentation()
            await instance._writeOutSerializedRepresentation(writer)
            const actualBytes = Buffer.concat(chunks)

            const expectedBytes = ByteUtils.stringToBytes(
                "\u0001\u00000,\"\",0,0,0,\"\",0,\"\",0,\"\"\n")
            assert.equalBytes(actualBytes, expectedBytes)
            assert.equal(computedByteCount, expectedBytes.length)

            const actualChunk = ChunkedTransferCodec._deserialize(
                actualBytes)
            assert.deepEqual(actualChunk, expectedChunk)
        })

        it("should pass (2)", function() {
            const expectedChunk: LeadChunk ={
                version: ChunkedTransferCodec.VERSION_01,
                contentLength: 0,
                flags: 0,
                statusCode: 0
            }
            const equivalentBytes = ByteUtils.stringToBytes(
                "\u0001\u0000true,\"\",0,0,false,\"\",\"\",\"\",2,\"\"\n")
            const actualChunk = ChunkedTransferCodec._deserialize(
                equivalentBytes)
            assert.deepEqual(actualChunk, expectedChunk)
        })

        it("should pass (3)", async function() {
            const expectedChunk: LeadChunk ={
                version: ChunkedTransferCodec.VERSION_01,
                flags: 2,
                requestTarget: "/detail",
                httpStatusMessage: "ok",
                contentLength: 20,
                statusCode: 200,
                httpVersion: "1.0",
                method: "POST",
            }
            expectedChunk.headers = new Map<string, string[]>()
            expectedChunk.headers.set("accept", ["text/plain", "text/xml"])
            expectedChunk.headers.set("a", [])
            expectedChunk.headers.set("b", ["myinside\u00c6.team"])
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            })
            const instance = new ChunkedTransferCodec()
            instance._updateSerializedRepresentation(expectedChunk)
            const computedByteCount = instance._calculateSizeInBytesOfSerializedRepresentation()
            await instance._writeOutSerializedRepresentation(writer)
            const actualBytes = Buffer.concat(chunks)

            const expectedBytes = ByteUtils.stringToBytes(
                "\u0001\u00021,/detail,200,20,1,POST,1,1.0,1,ok\n" +
                "accept,text/plain,text/xml\n" +
                "b,myinside\u00c6.team\n")
            assert.equalBytes(actualBytes, expectedBytes)
            assert.equal(computedByteCount, expectedBytes.length)

            const actualChunk = ChunkedTransferCodec._deserialize(
                actualBytes)
            compareLeadChunks(actualChunk, expectedChunk)
        })

        it("should pass (4)", async function() {
            const expectedChunk: LeadChunk ={
                version: ChunkedTransferCodec.VERSION_01,
                flags: 2,
                requestTarget: "/detail",
                httpStatusMessage: "ok",
                contentLength: 20,
                statusCode: 200,
                httpVersion: "1.0",
                method: "POST",
            }
            expectedChunk.headers = new Map<string, string[]>()
            expectedChunk.headers.set("accept", ["text/plain", "", "text/xml"])
            expectedChunk.headers.set("b", ["myinside\u00c6.team"])
            
            const equivalentBytes = ByteUtils.stringToBytes(
                "\u0001\u00021,/detail,200,20,1,POST,1,1.0,1,ok\n" +
                "accept,text/plain\n" +
                "accept,\"\"\n" +
                "accept\n" +
                "a\n" +
                "b,myinside\u00c6.team\n" +
                "accept,text/xml\n")

            const actualChunk = ChunkedTransferCodec._deserialize(
                equivalentBytes)
            compareLeadChunks(actualChunk, expectedChunk)
        })

        it("should pass (5)", async function() {
            const expectedChunk: LeadChunk ={
                version: ChunkedTransferCodec.VERSION_01,
                flags: 2,
                requestTarget: "/detail",
                httpStatusMessage: "ok",
                contentLength: 20,
                statusCode: 200,
                httpVersion: "1.0",
                method: "POST",
            }
            expectedChunk.headers = new Map<string, string[]>()
            expectedChunk.headers.set("accept", [ null as any, "text/plain", "text/xml"])
            expectedChunk.headers.set("a", null as any)
            expectedChunk.headers.set("b", "myinside\u00c6.team" as any)
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            })
            const instance = new ChunkedTransferCodec()
            instance._updateSerializedRepresentation(expectedChunk)
            const computedByteCount = instance._calculateSizeInBytesOfSerializedRepresentation()
            await instance._writeOutSerializedRepresentation(writer)
            const actualBytes = Buffer.concat(chunks)

            const expectedBytes = ByteUtils.stringToBytes(
                "\u0001\u00021,/detail,200,20,1,POST,1,1.0,1,ok\n" +
                "accept,\"\",text/plain,text/xml\n" +
                "b,myinside\u00c6.team\n")
            assert.equalBytes(actualBytes, expectedBytes)
            assert.equal(computedByteCount, expectedBytes.length)
        })

        it("should pass (6)", function() {
            const expectedChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 0,
                requestTarget: "http://www.yoursite.com/category/keyword1,keyword2",
                httpStatusMessage: "ok",
                contentLength: 140_737_488_355_327,
                statusCode: 2_147_483_647,
                method: "PUT"
            }
            expectedChunk.headers = new Map<string, string[]>()
            expectedChunk.headers.set("content-type", ["application/json"])
            expectedChunk.headers.set("allow", ["GET,POST"])

            const srcBytes = ByteUtils.stringToBytes(
                "\u0001\u00001,\"http://www.yoursite.com/category/keyword1,keyword2\"," +
                "2147483647,140737488355327,1,PUT,0,\"\",1,ok\n" +
                "content-type,application/json\n" +
                "allow,\"GET,POST\"\n")
            const actualChunk = ChunkedTransferCodec._deserialize(
                srcBytes)
            assert.deepEqual(actualChunk, expectedChunk)
        })

        it("should succeed in verifying expected failure (1)", function() {
            assert.throws(() =>
                ChunkedTransferCodec._deserialize(null as any))
        })

        it("should succeed in verifying expected failure (2)", function() {
            assert.throws(() =>
                ChunkedTransferCodec._deserialize(Buffer.alloc(7)))
        })

        it("should succeed in verifying expected failure (3)", function() {
            assert.throws(() =>
                ChunkedTransferCodec._deserialize(
                    Buffer.from([1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 9])))
        })

        it("should succeed in verifying expected failure (4)", async function() {
            await nativeAssert.rejects(async () => {
                const data = ByteUtils.stringToBytes(
                    "\u0000\u00001,1,1," +
                    "1,1,1,1," +
                    "1,1,1," +
                    "1,1,1," +
                    "1,1\n"
                )
                ChunkedTransferCodec._deserialize(data)
            }, (e: any) => {
                expect(e.message).to.contain("version")
                return true
            })
        })

        it("should succeed in verifying expected failure (6)", async function() {
            await nativeAssert.rejects(async () => {
                const data = ByteUtils.stringToBytes(
                    "\u0001\u00001,\"http://www.yoursite.com/category/keyword1,keyword2\"," +
                    "2147483647,140737488355328,1,PUT,0,\"\",1,ok\n" +
                    "content-type,application/json\n" +
                    "allow,\"GET,POST\"\n"
                )
                ChunkedTransferCodec._deserialize(data)
            }, (e: any) => {
                expect(e.message).to.contain("invalid content length")
                return true
            })
        })

        it("should succeed in verifying expected failure (7)", async function() {
            await nativeAssert.rejects(async () => {
                const data = ByteUtils.stringToBytes(
                    "\u0001\u00001,\"http://www.yoursite.com/category/keyword1,keyword2\"," +
                    "2147483648,140737488355327,1,PUT,0,\"\",1,ok\n" +
                    "content-type,application/json\n" +
                    "allow,\"GET,POST\"\n"
                )
                ChunkedTransferCodec._deserialize(data)
            }, (e: any) => {
                expect(e.message).to.contain("invalid status code")
                return true
            })
        })
    })

    describe("#encodeSubsequentChunkV1Header", function() {
        const testData = [
            {
                chunkDataLength: 0,
                expected: Buffer.from([0, 0, 2, 1, 0])
            },
            {
                chunkDataLength: 555,
                expected: Buffer.from([0, 2, 0x2d, 1, 0])
            },
            {
                chunkDataLength: 511_665,
                expected: Buffer.from([7, 0xce, 0xb3, 1, 0])
            }
        ]
        testData.forEach(({chunkDataLength, expected}, i) => {
            it(`should pass with input ${i}`, async function() {
                const chunks = new Array<Buffer>()
                const destStream = new Writable({
                    write(chunk, encoding, cb) {
                        chunks.push(chunk)
                        cb()
                    }
                })
                await new ChunkedTransferCodec().encodeSubsequentChunkV1Header(
                    chunkDataLength, destStream)
                assert.equalBytes(Buffer.concat(chunks), expected)
            })
        })
    })

    describe("#decodeSubsequentChunkV1Header", function() {
        const testData = [
            {
                srcData: Buffer.from([0, 0, 2, 1, 0]),
                maxChunkSize: 40,
                expected: 0,
            },
            {
                srcData: Buffer.from([0, 0xea, 0x62, 1, 0]),
                maxChunkSize: "-1" as any,
                expected: 60_000,
            },
            {
                srcData: Buffer.from([0, 0, 3, 1, 0]),
                maxChunkSize: 0,
                expected: 1,
            },
            {
                srcData: Buffer.from([0, 2, 0x2d, 1, 0]),
                maxChunkSize: 400,  // ok because it is below hard limit
                expected: 555,
            },
            {
                srcData: Buffer.from([7, 0xce, 0xb3, 1, 0]),
                maxChunkSize: 600_000,
                expected: 511_665,
            },
        ]
        testData.forEach(({srcData, maxChunkSize, expected}, i) => {
            it(`should pass with input ${i}`, async function() {
                let actual = await new ChunkedTransferCodec().decodeSubsequentChunkV1Header(
                    srcData, undefined, maxChunkSize)
                assert.equal(actual, expected)

                // should work indirectly with stream
                actual = await new ChunkedTransferCodec().decodeSubsequentChunkV1Header(
                    null as any, Readable.from(srcData), maxChunkSize)
                assert.equal(actual, expected)
            })
        })

        it("should fail with argument error (1)", async function() {
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().decodeSubsequentChunkV1Header(
                    null as any, undefined, 0)
            }, (e: any) => {
                expect(e.message).to.contain("reader")
                return true
            })
        })

        it("should fail with argument error (2)", async function() {
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().decodeSubsequentChunkV1Header(
                    Buffer.from([0, 0, 2, 1, 0]), undefined, true as any)
            }, (e: any) => {
                expect(e.message).to.contain("invalid 32-bit")
                return true
            })
        })

        const testErrorData = [
            {
                srcData: Buffer.from([7, 0xce, 0xb3, 1, 0]), // 511,665
                maxChunkSize: 65_536
            },
            {
                srcData: Buffer.from([0xf7, 2, 9, 1, 0]), // negative
                maxChunkSize: 30_000
            },
            {
                srcData: Buffer.from([0, 2, 9, 0, 0]),  // version not set
                maxChunkSize: 15_437
            }
        ]
        testErrorData.forEach(({srcData, maxChunkSize}, i) => {
            it(`should fail with usage ${i}`, async function() {
                await nativeAssert.rejects(async () => {
                    await new ChunkedTransferCodec().decodeSubsequentChunkV1Header(
                        srcData, undefined, maxChunkSize)
                })
            })
        })
    })

    describe("#writeLeadChunk", function() {
        it("should pass (1)", async function() {
            // arrange
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01
            }
            const serializedLeadChunkSuffix = ByteUtils.stringToBytes(
                "0,\"\",0,0,0,\"\",0,\"\",0,\"\"\n")
            const expectedStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 26, 1, 0]), serializedLeadChunkSuffix])

            const chunks = new Array<Buffer>()
            const destStream = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            // act
            await new ChunkedTransferCodec().writeLeadChunk(destStream,
                leadChunk)

            // assert
            assert.equalBytes(Buffer.concat(chunks), expectedStreamContents)
        })

        it("should pass (2)", async function() {
            // arrange
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 5
            }
            const serializedLeadChunkSuffix = ByteUtils.stringToBytes(
                "0,\"\",0,0,0,\"\",0,\"\",0,\"\"\n")
            const expectedStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 26, 1, 5]), serializedLeadChunkSuffix])

            const chunks = new Array<Buffer>()
            const destStream = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            // act
            await new ChunkedTransferCodec().writeLeadChunk(destStream,
                leadChunk, "-1" as any)

            // assert
            assert.equalBytes(Buffer.concat(chunks), expectedStreamContents)
        })

        it("should pass (3)", async function() {
            // arrange
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 3,
                requestTarget: "/foo/bar",
                statusCode: 201,
                contentLength: -4000 as any,
                method: "GET",
                httpVersion: "1.1",
                httpStatusMessage: "Accepted for processing"
            }
            leadChunk.headers = new Map<string, string[]>()
            leadChunk.headers.set("zero", [])
            leadChunk.headers.set("one", ["1"])
            leadChunk.headers.set("two", ["2", "2"])
            const serializedLeadChunkSuffix = ByteUtils.stringToBytes(
                "1,/foo/bar,201,-4000,1,GET,1,1.1,1,Accepted for processing\n" +
                "one,1\n" +
                "two,2,2\n"
            )
            const expectedStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 75, 1, 3]), serializedLeadChunkSuffix])

            const chunks = new Array<Buffer>()
            const destStream = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            // act
            await new ChunkedTransferCodec().writeLeadChunk(
                destStream, leadChunk, 100)

            // assert
            assert.equalBytes(Buffer.concat(chunks), expectedStreamContents)
        })

        it("should fail due to argument errors", async function() {
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    callback()
                },
            })
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01
            }
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().writeLeadChunk(
                    writer, leadChunk, true as any)
            }, /invalid 32-bit/)
        })

        it("should fail (1)", async function() {
            // arrange
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 3,
                requestTarget: "/foo/bar",
                statusCode: 201,
                contentLength: -4000 as any,
                method: "GET",
                httpVersion: "1.1",
                httpStatusMessage: "Accepted for processing"
            }
            leadChunk.headers = new Map<string, string[]>()
            leadChunk.headers.set("zero", [])
            leadChunk.headers.set("one", ["1"])
            leadChunk.headers.set("two", ["2", "2"])

            const destStream = new Writable({
                write(chunk, encoding, cb) {
                    cb()
                },
            })

            // act
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().writeLeadChunk(
                    destStream, leadChunk, 10)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                expect(e.message).to.contain("exceed")
                expect(e.message).to.contain("chunk size")
                return true
            })
        })

        it("should fail (2)", async function() {
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 1,
                requestTarget: "1",
                statusCode: 1,
                contentLength: 1,
                method: "1",
                httpVersion: "1",
                httpStatusMessage: "1"
            }
            leadChunk.headers = new Map()
            for (let i = 0; i < 40_000; i++) {
                const key = `${i}`.padStart(5, '0')
                leadChunk.headers.set(key, ["1"])
            }

            const destStream = new Writable({
                write(chunk, encoding, cb) {
                    cb()
                },
            })

            // act
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().writeLeadChunk(
                    destStream, leadChunk, "" as any)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                expect(e.message).to.contain("exceed")
                expect(e.message).to.contain("chunk size")
                return true
            })
        })

        it("should fail (3)", async function() {
            const leadChunk: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 1,
                requestTarget: "1",
                statusCode: 1,
                contentLength: 1,
                method: "1",
                httpVersion: "1",
                httpStatusMessage: "1"
            }
            leadChunk.headers = new Map()
            for (let i = 0; i < 40_000; i++) {
                const key = `${i}`.padStart(5, '0')
                leadChunk.headers.set(key, ["1"])
            }

            const destStream = new Writable({
                write(chunk, encoding, cb) {
                    cb()
                },
            })

            // act
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().writeLeadChunk(
                    destStream, leadChunk,
                    1 + ChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                expect(e.message).to.contain("exceed")
                expect(e.message).to.contain("chunk size")
                return true
            })
        })
    })

    describe("#readLeadChunk", function() {
        it("should pass (1)", async function() {
            // arrange
            const serializedLeadChunkSuffix = ByteUtils.stringToBytes(
                "0,\"\",0,0,0,\"\",0,\"\",0,\"\"\n")
            const srcStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 26, 1, 0]), serializedLeadChunkSuffix])
            const srcStream = Readable.from(srcStreamContents)
            const expected: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 0,
                statusCode: 0,
                contentLength: 0
            }

            // act
            const actual = await new ChunkedTransferCodec().readLeadChunk(
                srcStream)

            // assert
            assert.deepEqual(actual, expected)
        })

        it("should pass (2)", async function() {
            // arrange
            const serializedLeadChunkSuffix = ByteUtils.stringToBytes(
                "0,\"\",100,1,0,\"\",0,\"\",0,\"\"\n")
            const srcStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 28, 1, 0]), serializedLeadChunkSuffix])
            const srcStream = Readable.from(srcStreamContents)
            const expected: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 0,
                statusCode: 100,
                contentLength: 1
            }

            // act
            const actual = await new ChunkedTransferCodec().readLeadChunk(
                srcStream, -1)

            // assert
            assert.deepEqual(actual, expected)
        })

        it("should read null lead chunk", async function() {
            // arrange
            const srcStream = Readable.from([])
            const maxChunkSize = "0" as any

            // act
            const actual = await new ChunkedTransferCodec().readLeadChunk(
                srcStream, maxChunkSize)

            // assert
            assert.equal(actual, null)
        })

        it("should pass with laxity in chunk size check", async function() {
            // arrange
            const serializedLeadChunkSuffix = ByteUtils.stringToBytes(
                "1,/abcdefghijklmop,0,0,0,\"\",0,\"\",0,\"\"\n")
            const srcStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 40, 1, 0]), serializedLeadChunkSuffix])
            const srcStream = Readable.from(srcStreamContents)
            const maxChunkSize = 10 // definitely less than actual serialized 
                                    // value but ok once it is less than 64K
            const expected: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 0,
                requestTarget: "/abcdefghijklmop",
                statusCode: 0,
                contentLength: 0
            }

            // act
            const actual = await new ChunkedTransferCodec().readLeadChunk(
                srcStream, maxChunkSize)

            // assert
            assert.deepEqual(actual, expected)
        })

        it ("should pass even though default max chunk limit is exceeded", async function() {
            // arrange
            const srcStream = Readable.from((function*(){
                 // length = 320_022, which exceeds 64kb
                yield Buffer.from([0x04, 0xe2, 0x16, 1, 1])
                yield ByteUtils.stringToBytes("1,1,1,1,1,1,1,1,1,1\n")
                for (let i = 0; i < 40_000; i++) {
                    const key = `${i}`.padStart(5, '0')
                    yield ByteUtils.stringToBytes(
                        `${key},1\n`)
                }
            })())
            const maxChunkSize = 400_000
            const expected: LeadChunk = {
                version: ChunkedTransferCodec.VERSION_01,
                flags: 1,
                requestTarget: "1",
                statusCode: 1,
                contentLength: 1,
                method: "1",
                httpVersion: "1",
                httpStatusMessage: "1"
            }
            expected.headers = new Map()
            for (let i = 0; i < 40_000; i++) {
                const key = `${i}`.padStart(5, '0')
                expected.headers.set(key, ["1"])
            }

            // act
            const actual = await new ChunkedTransferCodec().readLeadChunk(
                srcStream, maxChunkSize)

            // assert
            assert.deepEqual(actual, expected)
        })

        it("should fail due to argument errors", async function() {
            const srcStream = Readable.from(Buffer.alloc(6))
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(
                    srcStream, true as any)
            }, /invalid 32-bit/)
        })

        it("should fail due to max chunk exceeded error (1)", async function() {
            const srcStream = Readable.from(
                Buffer.from([0xf, 0x42, 0x40])) // length of 1 million
            const maxChunkSize = 40
 
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(srcStream,
                    maxChunkSize)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                assert.ok(e.cause)
                expect(e.cause.message).to.contain("exceed")
                expect(e.cause.message).to.contain("chunk size")
                return true
            })
        })

        it("should fail due to max chunk exceeded error (1)", async function() {
            const srcStream = Readable.from(
                Buffer.from([0xf, 0x42, 0x40])) // length of 1 million
            const maxChunkSize = 400_000
 
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(srcStream,
                    maxChunkSize)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                assert.ok(e.cause)
                expect(e.cause.message).to.contain("exceed")
                expect(e.cause.message).to.contain("chunk size")
                return true
            })
        })

        it("should fail due to insufficient data for length", async function() {
            const srcStream = Readable.from(
                Buffer.alloc(2)) // insufficient because even 
                                 // prefix length is 3 bytes
            const maxChunkSize = 40
 
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(srcStream,
                    maxChunkSize)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                assert.ok(e.cause)
                expect(e.cause.message).to.contain("unexpected end of read")
                return true
            })
        })

        it("should fail due to insufficient data", async function() {
            const srcStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 77]), Buffer.alloc(76)])
            const srcStream = Readable.from(srcStreamContents)
            const maxChunkSize = 40
 
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(srcStream,
                    maxChunkSize)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                assert.ok(e.cause)
                expect(e.cause.message).to.contain("unexpected end of read")
                return true
            })
        })

        it("should fail due to error from lead chunk deserialization", async function() {
            // should fail because version is not set
            const srcStreamContents = Buffer.concat(
                [Buffer.from([0, 0, 100]), Buffer.alloc(100)])
            const srcStream = Readable.from(srcStreamContents)
            const maxChunkSize = 100
 
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(srcStream,
                    maxChunkSize)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                expect(e.message).to.contain("invalid chunk")
                assert.ok(e.cause)
                expect(e.cause.message).to.contain("version")
                return true
            })
        })

        it("should fail due to invalid chunk length", async function() {
            const srcStreamContents = Buffer.concat(
                [Buffer.from([0xf0, 1, 3]), Buffer.alloc(100)])
            const srcStream = Readable.from(srcStreamContents)
            const maxChunkSize = 100
 
            await nativeAssert.rejects(async () => {
                await new ChunkedTransferCodec().readLeadChunk(srcStream,
                    maxChunkSize)
            }, (e: any) => {
                expect(e.message).to.contain("headers")
                assert.ok(e.cause)
                expect(e.cause.message).to.contain("negative chunk size")
                return true
            })
        })
    })

    describe("#updateRequest", function() {
        it("should pass", function() {
            const request: IQuasiHttpRequest = {
                async release() {
                    
                }
            }
            const headers = new Map([["a", ["apple"]]])
            const leadChunk: LeadChunk = {
                version: 0,
                method: "GET",
                requestTarget: "/",
                headers,
                httpVersion: "1.0"
            }
            ChunkedTransferCodec.updateRequest(request,
                leadChunk)
            assert.equal(request.method, "GET")
            assert.equal(request.target, "/")
            assert.strictEqual(request.headers, headers)
            assert.equal(request.httpVersion, "1.0")
        })
    })

    describe("#updateResponse", function() {
        it("should pass", function() {
            const response: IQuasiHttpResponse = {
                statusCode: 0,
                async release() {
                    
                }
            }
            const headers = new Map([["b", ["ball", "BALL"]]])
            const leadChunk: LeadChunk = {
                version: 0,
                statusCode: 202,
                httpStatusMessage: "No content",
                headers,
                httpVersion: "1.1"
            }
            ChunkedTransferCodec.updateResponse(response,
                leadChunk)
            assert.equal(response.statusCode, 202)
            assert.equal(response.httpStatusMessage, "No content")
            assert.strictEqual(response.headers, headers)
            assert.equal(response.httpVersion, "1.1")
        })
    })

    describe("#createFromRequest", function() {
        it("should pass (1)", function() {
            // arrange
            const request: IQuasiHttpRequest = {
                async release() {
                    
                }
            }
            const expected: LeadChunk = {
                version: 1,
                flags: 0,
                requestTarget: undefined,
                method: undefined,
                headers: undefined,
                httpVersion: undefined,
                contentLength: 0
            }

            // act
            const actual = ChunkedTransferCodec.createFromRequest(
                request)
            
            // assert
            assert.deepEqual(actual, expected)
        })

        it("should pass (2)", function() {
            // arrange
            const headers = new Map([["c", ["can"]]])
            const body = new StringBody("")
            body.contentLength = -13
            const request: IQuasiHttpRequest = {
                target: "/index.html",
                method: "POST",
                headers,
                httpVersion: "2",
                body,
                async release() {
                    
                }
            }
            const expected: LeadChunk = {
                version: 1,
                flags: 0,
                requestTarget: "/index.html",
                method: "POST",
                headers,
                httpVersion: "2",
                contentLength: -13
            }

            // act
            const actual = ChunkedTransferCodec.createFromRequest(
                request)
            
            // assert
            assert.deepEqual(actual, expected)
        })

        it("should pass (3)", function() {
            // arrange
            const headers = new Map()
            const body = new StringBody("")
            body.contentLength = "40" as any
            const request: IQuasiHttpRequest = {
                target: "",
                method: "",
                headers,
                httpVersion: "",
                body,
                async release() {
                    
                }
            }
            const expected: LeadChunk = {
                version: 1,
                flags: 0,
                requestTarget: "",
                method: "",
                headers,
                httpVersion: "",
                contentLength: 40
            }

            // act
            const actual = ChunkedTransferCodec.createFromRequest(
                request)

            // assert
            assert.deepEqual(actual, expected)
        })

        it("should fail (1)", function() {
            // arrange
            const body = new StringBody("")
            body.contentLength = "p40" as any
            const request: IQuasiHttpRequest = {
                body,
                async release() {
                    
                }
            }

            // act
            assert.throws(() => {
                ChunkedTransferCodec.createFromRequest(
                    request)
            }, /invalid 48-bit/)
        })
    })

    describe("#createFromResponse", function() {
        it("should pass (1)", function() {
            // arrange
            const response: IQuasiHttpResponse = {
                statusCode: "-1" as any,
                async release() {
                    
                }
            }
            const expected: LeadChunk = {
                version: 1,
                flags: 0,
                statusCode: -1,
                httpStatusMessage: undefined,
                headers: undefined,
                httpVersion: undefined,
                contentLength: 0
            }

            // act
            const actual = ChunkedTransferCodec.createFromResponse(
                response)
            
            // assert
            assert.deepEqual(actual, expected)
        })

        it("should pass (2)", function() {
            // arrange
            const headers = new Map([["b", ["ball", "BALL"]]])
            const body = new StringBody("pineapple")
            const response: IQuasiHttpResponse = {
                statusCode: 200,
                httpStatusMessage: "Ok",
                headers,
                httpVersion: "1.1",
                body,
                async release() {
                    
                }
            }
            const expected: LeadChunk = {
                version: 1,
                flags: 0,
                statusCode: 200,
                httpStatusMessage: "Ok",
                headers,
                httpVersion: "1.1",
                contentLength: 9
            }

            // act
            const actual = ChunkedTransferCodec.createFromResponse(
                response)
            
            // assert
            assert.deepEqual(actual, expected)
        })

        it("should pass (3)", function() {
            // arrange
            const headers = new Map()
            const body = new StringBody("v")
            body.contentLength = "" as any
            const response: IQuasiHttpResponse = {
                statusCode: "4" as any,
                httpStatusMessage: "",
                headers,
                httpVersion: "",
                body,
                async release() {
                    
                }
            }
            const expected: LeadChunk = {
                version: 1,
                flags: 0,
                statusCode: 4,
                httpStatusMessage: "",
                headers,
                httpVersion: "",
                contentLength: 0
            }

            // act
            const actual = ChunkedTransferCodec.createFromResponse(
                response)

            // assert
            assert.deepEqual(actual, expected)
        })

        it("should fail (1)", function() {
            // arrange
            const response: IQuasiHttpResponse = {
                statusCode: "p4" as any,
                async release() {
                    
                }
            }

            // act
            assert.throws(() => {
                ChunkedTransferCodec.createFromResponse(
                    response)
            }, /invalid 32-bit/)
        })

        it("should fail (2)", function() {
            // arrange
            const body = new StringBody("abc")
            body.contentLength = "3 bytes" as any
            const response: IQuasiHttpResponse = {
                statusCode: 0,
                body,
                async release() {
                    
                }
            }

            // act
            assert.throws(() => {
                ChunkedTransferCodec.createFromResponse(
                    response)
            }, /invalid 48-bit/)
        })
    })
})