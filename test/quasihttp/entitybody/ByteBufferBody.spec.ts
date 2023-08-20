const { assert } = require("chai").use(require("chai-bytes"))
import { Writable } from "stream"
import * as IOUtils from "../../../src/common/IOUtils"
import { ByteBufferBody } from "../../../src/quasihttp/entitybody/ByteBufferBody"

describe("ByteBufferBody", function() {
    const testData = [
        {
            srcData: Buffer.alloc(0),
            expectedContentLength: 0
        },
        {
            srcData: Buffer.from([50]),
            expectedContentLength: 1
        },
        {
            srcData: Buffer.from([1, 2]),
            expectedContentLength: 2
        },
        {
            srcData: Buffer.from([130, 148, 199]),
            expectedContentLength: 3
        },
        {
            srcData: Buffer.from([97, 98, 99, 100]),
            expectedContentLength: 4
        }
    ]
    testData.forEach(({srcData, expectedContentLength}, i) => {
        it(`should pass reading test with input ${i}`, async function() {
            const instance = new ByteBufferBody(srcData)
            assert.equal(instance.contentLength, expectedContentLength)

            let actual = await IOUtils.readAllBytes(instance.getReader())
            assert.equalBytes(actual, srcData)

            // verify that release is a no-op
            await instance.release();

            // assert repeatability.
            actual = await IOUtils.readAllBytes(instance.getReader())
            assert.equalBytes(actual, srcData)
        })
    })

    testData.forEach(({srcData, expectedContentLength}, i) => {
        it(`should pass writing test with input ${i}`, async function() {
            const instance = new ByteBufferBody(srcData)
            assert.equal(instance.contentLength, expectedContentLength)

            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            await instance.writeBytesTo(writer)
            assert.equalBytes(Buffer.concat(chunks), srcData)

            // verify that release is a no-op
            await instance.release();

            // assert repeatability
            chunks.length = 0 // reset
            instance.contentLength = -1 // should have no effect on expectations
            await instance.writeBytesTo(writer)
            assert.equalBytes(Buffer.concat(chunks), srcData)
        })
    })

    it ("should fail due to argument errors", function() {
        assert.throws(() => new ByteBufferBody(null as any))
    })
})