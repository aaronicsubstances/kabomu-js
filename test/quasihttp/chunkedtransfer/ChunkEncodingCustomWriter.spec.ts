const { assert } = require('chai').use(require('chai-bytes'))
import { Readable, Writable } from "stream"
import { createChunkEncodingCustomWriter } from "../../../src/quasihttp/chunkedtransfer/ChunkEncodingCustomWriter"
import { createRandomizedReadSizeBufferReader } from "../../shared/RandomizedReadSizeBufferReader"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"

describe("ChunkEncodingCustomWriter", function() {
    it("should pass (1)", async function() {
        // arrange
        const chunks = new Array<Buffer>()
        const destStream = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })
        const maxChunkSize = 2
        const instance = createChunkEncodingCustomWriter(destStream,
            maxChunkSize)
        
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
        const maxChunkSize = 6
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
        const maxChunkSize = 25
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
})