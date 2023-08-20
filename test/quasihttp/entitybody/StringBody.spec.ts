const { assert } = require("chai").use(require("chai-bytes"))
import { Writable } from "stream"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"
import { StringBody } from "../../../src/quasihttp/entitybody/StringBody"

describe("StringBody", function() {
    const testData = [
        {
            srcData: "",
            expectedContentLength: 0
        },
        {
            srcData: "ab",
            expectedContentLength: 2
        },
        {
            srcData: "abc",
            expectedContentLength: 3
        },
        {
            srcData: "\u0001\u0019\u0020\u007e",
            expectedContentLength: 4
        },
        {
            srcData: "abcdef",
            expectedContentLength: 6
        },
        {
            srcData: "Foo \u00c0\u00ff",
            expectedContentLength: 8
        }
    ]
    testData.forEach(({srcData, expectedContentLength}, i) => {
        it(`should pass reading test with input ${i}`, async function() {
            const instance = new StringBody(srcData)
            assert.equal(instance.contentLength, expectedContentLength)

            let actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance.getReader()))
            assert.equal(actual, srcData)

            // verify that release is a no-op
            await instance.release();

            // assert repeatability.
            actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance.getReader()))
            assert.equal(actual, srcData)
        })
    })

    testData.forEach(({srcData, expectedContentLength}, i) => {
        it(`should pass writing test with input ${i}`, async function() {
            const instance = new StringBody(srcData)
            assert.equal(instance.contentLength, expectedContentLength)

            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            await instance.writeBytesTo(writer)
            let actual = ByteUtils.bytesToString(Buffer.concat(chunks))
            assert.equal(actual, srcData)

            // verify that release is a no-op
            await instance.release();

            // assert repeatability
            chunks.length = 0 // reset
            instance.contentLength = -1 // should have no effect on expectations
            await instance.writeBytesTo(writer)
            actual = ByteUtils.bytesToString(Buffer.concat(chunks))
            assert.equal(actual, srcData)
        })
    })

    it ("should fail due to argument errors", function() {
        assert.throws(() => new StringBody(null as any))
    })
})