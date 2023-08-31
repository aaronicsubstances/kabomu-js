const { assert } = require('chai').use(require('chai-bytes'))
import { Readable, Writable } from "stream"
import { createChunkEncodingCustomWriter } from "../../../src/quasihttp/chunkedtransfer/ChunkEncodingCustomWriter"
import { createRandomizedReadSizeBufferReader } from "../../shared/common/RandomizedReadSizeBufferReader"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"
import { CustomChunkedTransferCodec } from "../../../src/quasihttp/chunkedtransfer/CustomChunkedTransferCodec"

describe("ChunkEncodingCustomWriter", function() {
    it("should succeed in creation (1)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        createChunkEncodingCustomWriter(writer, 1_000_000)
    })

    it("should succeed in creation (2)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        createChunkEncodingCustomWriter(writer, -34)
    })

    it("should succeed in creation (3)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        createChunkEncodingCustomWriter(writer, "" as any)
    })

    it("should succeed in creation (4)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        createChunkEncodingCustomWriter(writer, false as any)
    })

    it("should fail due to creation errors (1)", async function() {
        assert.throws(() => {
            createChunkEncodingCustomWriter(null as any, 1)
        })
    })

    it("should fail due to creation errors (3)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        assert.throws(() => {
            createChunkEncodingCustomWriter(writer, true as any)
        })
    })

    it("should fail due to creation errors (4)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        assert.throws(() => {
            createChunkEncodingCustomWriter(writer, {} as any)
        })
    })

    it("should pass (1)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const instance = createChunkEncodingCustomWriter(
            destStream)
        
        const reader = Readable.from(Buffer.alloc(0))

        const expected = Buffer.concat([
            Buffer.from([0, 0, 2, 1, 0 ]),
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    it("should pass (2)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = "6" as any
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)
        
        const srcData = "data bits and bytes"
        // get randomized read request sizes.
        const reader = createRandomizedReadSizeBufferReader(
            ByteUtils.stringToBytes(srcData))

        const expected = Buffer.concat([
            Buffer.from([0, 0, 8, 1, 0 ]),
            ByteUtils.stringToBytes("data b"),
            Buffer.from([0, 0, 8, 1, 0 ]),
            ByteUtils.stringToBytes("its an"),
            Buffer.from([0, 0, 8, 1, 0 ]),
            ByteUtils.stringToBytes("d byte"),
            Buffer.from([0, 0, 3, 1, 0 ]),
            ByteUtils.stringToBytes("s"),
            Buffer.from([0, 0, 2, 1, 0 ]),
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    it("should pass (3)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = 9
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)
        
        const srcData = "data bits and byte"
        // get randomized read request sizes.
        const reader = createRandomizedReadSizeBufferReader(
            ByteUtils.stringToBytes(srcData))

        const expected = Buffer.concat([
            Buffer.from([0, 0, 11, 1, 0 ]),
            ByteUtils.stringToBytes("data bits"),
            Buffer.from([0, 0, 11, 1, 0 ]),
            ByteUtils.stringToBytes(" and byte"),
            Buffer.from([0, 0, 2, 1, 0 ]),
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    it("should pass (4)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = 20
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)
        
        const srcData = "data bits and pieces"
        // get randomized read request sizes.
        const reader = createRandomizedReadSizeBufferReader(
            ByteUtils.stringToBytes(srcData))

        const expected = Buffer.concat([
            Buffer.from([0, 0, 22, 1, 0 ]),
            ByteUtils.stringToBytes(srcData),
            Buffer.from([0, 0, 2, 1, 0 ]),
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    it("should pass (5)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = -25
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)
        
        const srcData = "data bits and places"
        // get randomized read request sizes.
        const reader = createRandomizedReadSizeBufferReader(
            ByteUtils.stringToBytes(srcData))

        const expected = Buffer.concat([
            Buffer.from([0, 0, 22, 1, 0 ]),
            ByteUtils.stringToBytes(srcData),
            Buffer.from([0, 0, 2, 1, 0 ]),
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    // Test acceptance of hard limit as max chunk size
    it("should pass (6)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)
        
        const srcData = "it is finished."
        // get randomized read request sizes.
        const reader = createRandomizedReadSizeBufferReader(
            ByteUtils.stringToBytes(srcData))

        const expected = Buffer.concat([
            Buffer.from([0, 0, 17, 1, 0 ]),
            ByteUtils.stringToBytes(srcData),
            Buffer.from([0, 0, 2, 1, 0 ]),
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    // Test hard limit usage for data exceeding default limit.
    it("should pass (7)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)

        const srcChunks = Buffer.concat([
            ByteUtils.stringToBytes("1".padEnd(10_000)),
            ByteUtils.stringToBytes("2".padEnd(10_000)),
            ByteUtils.stringToBytes("3".padEnd(10_000)),
            ByteUtils.stringToBytes("4".padEnd(10_000)),
            ByteUtils.stringToBytes("5".padEnd(10_000)),
            ByteUtils.stringToBytes("6".padEnd(10_000)),
            ByteUtils.stringToBytes("7".padEnd(10_000)),
            ByteUtils.stringToBytes("8".padEnd(10_000))
        ])
        const reader = Readable.from(srcChunks)
         
        // create expectation
        const expected = Buffer.concat([
            Buffer.from([1, 0x38, 0x82, 1, 0]),
            ByteUtils.stringToBytes("1".padEnd(10_000)),
            ByteUtils.stringToBytes("2".padEnd(10_000)),
            ByteUtils.stringToBytes("3".padEnd(10_000)),
            ByteUtils.stringToBytes("4".padEnd(10_000)),
            ByteUtils.stringToBytes("5".padEnd(10_000)),
            ByteUtils.stringToBytes("6".padEnd(10_000)),
            ByteUtils.stringToBytes("7".padEnd(10_000)),
            ByteUtils.stringToBytes("8".padEnd(10_000)),
            Buffer.from([0, 0, 2, 1, 0])
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })

    // Test truncation of hard limit excesses to default max chunk size
    it("should pass (8)", async function() {
        // arrange first with default max chunk size
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = 8192
        let instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)

        const srcChunks = Buffer.concat([
            ByteUtils.stringToBytes("1".padEnd(1_000)),
            ByteUtils.stringToBytes("2".padEnd(1_000)),
            ByteUtils.stringToBytes("3".padEnd(1_000)),
            ByteUtils.stringToBytes("4".padEnd(1_000)),
            ByteUtils.stringToBytes("5".padEnd(1_000)),
            ByteUtils.stringToBytes("6".padEnd(1_000)),
            ByteUtils.stringToBytes("7".padEnd(1_000)),
            ByteUtils.stringToBytes("8".padEnd(1_000)),
            ByteUtils.stringToBytes("9".padEnd(1_000))
        ])
        let reader = Readable.from(srcChunks)
         
        // create expectation
        const expected = Buffer.concat([
            Buffer.from([0, 0x20, 0x02, 1, 0]),
            ByteUtils.stringToBytes("1".padEnd(1_000)),
            ByteUtils.stringToBytes("2".padEnd(1_000)),
            ByteUtils.stringToBytes("3".padEnd(1_000)),
            ByteUtils.stringToBytes("4".padEnd(1_000)),
            ByteUtils.stringToBytes("5".padEnd(1_000)),
            ByteUtils.stringToBytes("6".padEnd(1_000)),
            ByteUtils.stringToBytes("7".padEnd(1_000)),
            ByteUtils.stringToBytes("8".padEnd(1_000)),
            ByteUtils.stringToBytes("9".padEnd(192)),
            Buffer.from([0, 0x03, 0x2a, 1, 0]),
            ByteUtils.stringToBytes("".padEnd(808)),
            Buffer.from([0, 0, 2, 1, 0])
        ])

        // act
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()

        // assert
        let actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)

        // try again with too large max chunk size.
        reader = Readable.from(srcChunks)  // reset for another reading.
        chunks.length = 0 // reset for another writing
        instance = createChunkEncodingCustomWriter(destStream,
            CustomChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT + 1)
        await IOUtils.copyBytes(reader, instance)
        await instance.endWrites()
        actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })
})