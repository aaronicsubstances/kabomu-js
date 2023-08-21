const { assert } = require('chai').use(require('chai-bytes'))
import { Readable, Writable } from "stream"
import { createChunkEncodingCustomWriter } from "../../../src/quasihttp/chunkedtransfer/ChunkEncodingCustomWriter"
import { createRandomizedReadSizeBufferReader } from "../../shared/RandomizedReadSizeBufferReader"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"
import { ChunkedTransferCodec } from "../../../src/quasihttp/chunkedtransfer/ChunkedTransferCodec"

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

    it("should fail due to creation errors (2)", function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            }
        })
        assert.throws(() => {
            createChunkEncodingCustomWriter(
                writer, 10_000_000)
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
        await IOUtils.endWrites(instance)

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
        await IOUtils.endWrites(instance)
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
        await IOUtils.endWrites(instance)

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
        await IOUtils.endWrites(instance)

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
        await IOUtils.endWrites(instance)

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
        const maxChunkSize = ChunkedTransferCodec.HardMaxChunkSizeLimit
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
        await IOUtils.endWrites(instance)

        // assert
        const actual = Buffer.concat(chunks)
        assert.equalBytes(actual, expected)
    })
})