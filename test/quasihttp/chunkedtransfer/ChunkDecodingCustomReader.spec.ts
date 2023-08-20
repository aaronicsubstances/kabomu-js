import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))
import { Readable, Writable } from "stream"
import { createChunkDecodingCustomReader } from "../../../src/quasihttp/chunkedtransfer/ChunkDecodingCustomReader"
import { createRandomizedReadSizeBufferReader } from "../../shared/RandomizedReadSizeBufferReader"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"

describe("ChunkDecodingCustomReader", function() {
    it("should pass (1)", async function(){
        // arrange
        const srcData = Buffer.from([0, 0, 2, 1, 0])
        const backingReader = Readable.from(srcData)
        const maxChunkSize = 2
        const instance = createChunkDecodingCustomReader(
            backingReader, maxChunkSize)
        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })
        const expected = ""

        // act
        await IOUtils.copyBytes(instance, writer)

        // assert
        assert.equal(ByteUtils.bytesToString(
            Buffer.concat(chunks)), expected)
        
        // ensure subsequent reading attempts return 0
        assert.equal(await IOUtils.readBytes(instance,
            Buffer.alloc(1), 0, 1), 0)
    })

    it("should pass (2)", async function(){
        // arrange
        const srcData = Buffer.concat([
            Buffer.from([0, 0, 22, 1, 0]),
            ByteUtils.stringToBytes("data bits and places"),
            Buffer.from([0, 0, 2, 1, 0])
        ])
        const backingReader = Readable.from(srcData)
        const maxChunkSize = 25
        const instance = createChunkDecodingCustomReader(
            backingReader, maxChunkSize)
        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })
        const expected = "data bits and places"

        // act
        await IOUtils.copyBytes(instance, writer)

        // assert
        assert.equal(ByteUtils.bytesToString(
            Buffer.concat(chunks)), expected)
        
        // ensure subsequent reading attempts return 0
        assert.equal(await IOUtils.readBytes(instance,
            Buffer.alloc(1), 0, 1), 0)
    })

    it("should pass (3)", async function(){
        // arrange
        const srcData = Buffer.concat([
            Buffer.from([0, 0, 8, 1, 0]),
            ByteUtils.stringToBytes("data b"),
            Buffer.from([0, 0, 8, 1, 0]),
            ByteUtils.stringToBytes("its an"),
            Buffer.from([0, 0, 8, 1, 0]),
            ByteUtils.stringToBytes("d byte"),
            Buffer.from([0, 0, 3, 1, 0]),
            ByteUtils.stringToBytes("s"),
            Buffer.from([0, 0, 2, 1, 0])
        ])
        // get randomized read request sizes.
        const backingReader = createRandomizedReadSizeBufferReader(srcData)
        const maxChunkSize = 6
        const instance = createChunkDecodingCustomReader(
            backingReader, maxChunkSize)
        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })
        const expected = "data bits and bytes"

        // act
        await IOUtils.copyBytes(instance, writer)

        // assert
        assert.equal(ByteUtils.bytesToString(
            Buffer.concat(chunks)), expected)
        
        // ensure subsequent reading attempts return 0
        assert.equal(await IOUtils.readBytes(instance,
            Buffer.alloc(1), 0, 1), 0)
    })

    it("should pass (4)", async function(){
        // arrange
        const srcData = Buffer.concat([
            Buffer.from([0, 0, 11, 1, 0]),
            ByteUtils.stringToBytes("data bits"),
            Buffer.from([0, 0, 11, 1, 0]),
            ByteUtils.stringToBytes(" and byte"),
            Buffer.from([0, 0, 2, 1, 0])
        ])
        // get randomized read request sizes.
        const backingReader = createRandomizedReadSizeBufferReader(srcData)
        const maxChunkSize = 9
        const instance = createChunkDecodingCustomReader(
            backingReader, maxChunkSize)
        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })
        const expected = "data bits and byte"

        // act
        await IOUtils.copyBytes(instance, writer)

        // assert
        assert.equal(ByteUtils.bytesToString(
            Buffer.concat(chunks)), expected)
        
        // ensure subsequent reading attempts return 0
        assert.equal(await IOUtils.readBytes(instance,
            Buffer.alloc(1), 0, 1), 0)
    })

    it("should fail (1)", async function() {
        // arrange
        const srcData = Buffer.from([0, 0, 11, 1])
        const backingReader = Readable.from(srcData)
        const maxChunkSize = 9
        const instance = createChunkDecodingCustomReader(
            backingReader, maxChunkSize)
        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })

        // act and assert
        await nativeAssert.rejects(async function() {
            await IOUtils.copyBytes(instance, writer)
        }, (e: any) => {
            expect(e.message).to.contain("subsequent chunk header")
            return true
        })
    })

    it("should fail (2)", async function() {
        // arrange
        const srcData = Buffer.concat([
            Buffer.from([0, 0, 11, 1]),
            ByteUtils.stringToBytes("data bi")
        ])
        const backingReader = Readable.from(srcData)
        const maxChunkSize = 9
        const instance = createChunkDecodingCustomReader(
            backingReader, maxChunkSize)
        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })

        // act and assert
        await nativeAssert.rejects(async function() {
            await IOUtils.copyBytes(instance, writer)
        }, (e: any) => {
            expect(e.message).to.contain("subsequent chunk body")
            return true
        })
    })
})