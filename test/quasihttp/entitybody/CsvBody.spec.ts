const { assert } = require("chai").use(require("chai-bytes"))
import { Writable } from "stream"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"
import { CsvBody } from "../../../src/quasihttp/entitybody/CsvBody"

describe("CsvBody", function() {
    it("should pass reading test (1)", async function() {
        const srcData = new Map<string, string[]>()
        const expected = ""
        const instance = new CsvBody(srcData)
        assert.equal(instance.contentLength, -1)

        let actual = ByteUtils.bytesToString(
            await IOUtils.readAllBytes(instance.getReader()))
        assert.equal(actual, expected)

        // verify that release is a no-op
        await instance.release()

        // assert repeatability.
        actual = ByteUtils.bytesToString(
            await IOUtils.readAllBytes(instance.getReader()))
        assert.equal(actual, expected)
    })

    it("should pass reading test (2)", async function() {
        const srcData = new Map<string, string[]>()
        srcData.set("A", ["b", "2"])
        srcData.set("B", ["2"])
        srcData.set("C", [])
        srcData.set("D", ["Fire"])
        const expected = "A,b,2\nB,2\nC\nD,Fire\n"
        const instance = new CsvBody(srcData)
        assert.equal(instance.contentLength, -1)

        let actual = ByteUtils.bytesToString(
            await IOUtils.readAllBytes(instance.getReader()))
        assert.equal(actual, expected)

        // verify that release is a no-op
        await instance.release()

        // assert repeatability.
        actual = ByteUtils.bytesToString(
            await IOUtils.readAllBytes(instance.getReader()))
        assert.equal(actual, expected)
    })
    
    it(`should pass writing test (1)`, async function() {
        const srcData = new Map<string, string[]>()
        const expected = ""
        const instance = new CsvBody(srcData)
        assert.equal(instance.contentLength, -1)

        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })

        await instance.writeBytesTo(writer)
        let actual = ByteUtils.bytesToString(Buffer.concat(chunks))
        assert.equal(actual, expected)

        // verify that release is a no-op
        await instance.release();

        // assert repeatability
        chunks.length = 0 // reset
        instance.contentLength = -1 // should have no effect on expectations
        await instance.writeBytesTo(writer)
        actual = ByteUtils.bytesToString(Buffer.concat(chunks))
        assert.equal(actual, expected)
    })
    
    it(`should pass writing test (2)`, async function() {
        const srcData = new Map<string, string[]>()
        srcData.set("A", ["b", "2"])
        srcData.set("B", ["2"])
        srcData.set("C", [])
        srcData.set("D", ["Fire"])
        const expected = "A,b,2\nB,2\nC\nD,Fire\n"
        const instance = new CsvBody(srcData)
        assert.equal(instance.contentLength, -1)

        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, cb) {
                chunks.push(chunk)
                cb()
            },
        })

        await instance.writeBytesTo(writer)
        let actual = ByteUtils.bytesToString(Buffer.concat(chunks))
        assert.equal(actual, expected)

        // verify that release is a no-op
        await instance.release();

        // assert repeatability
        chunks.length = 0 // reset
        instance.contentLength = -1 // should have no effect on expectations
        await instance.writeBytesTo(writer)
        actual = ByteUtils.bytesToString(Buffer.concat(chunks))
        assert.equal(actual, expected)
    })

    it ("should fail due to argument errors", function() {
        assert.throws(() => new CsvBody(null as any))
    })
})