import nativeAssert from "assert/strict";
import { assert } from "chai"
import { Readable, Writable } from "stream"
import * as ByteUtils from "../../../src/common/ByteUtils"
import * as IOUtils from "../../../src/common/IOUtils"
import { LambdaBasedQuasiHttpBody } from "../../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody"
import { ISelfWritable } from "../../../src/common/types";

describe("LambdaBasedQuasiHttpBody", function() {
    const testData = [
        "", "1", "ab", "\u0019\u0020\u0021",
        "abcd", "\u0150\u0151\u0169\u0172\u0280"
    ]
    testData.forEach((srcData, i) => {
        it(`should pass reading test with input ${i}`, async function() {
            const stream = Readable.from(
                ByteUtils.stringToBytes(srcData))
            const instance = new LambdaBasedQuasiHttpBody(
                () => stream)
            assert.equal(instance.contentLength, -1)

            let actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance.getReader()!))
            assert.equal(actual, srcData)

            // verify that release is a no-op
            await instance.release();

            // assert non-repeatability.
            actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance.getReader()!))
            assert.equal(actual, "")
        })
    })

    testData.forEach((srcData, i) => {
        it(`should pass reading and release test with input ${i}`, async function() {
            const stream = Readable.from(
                ByteUtils.stringToBytes(srcData))
            let endOfReadError;
            const instance = new LambdaBasedQuasiHttpBody(
                () => {
                    if (endOfReadError) {
                        throw endOfReadError
                    }
                    return stream
                })
            instance.releaseFunc = async () => {
                endOfReadError = new Error("released")
            }
            assert.equal(instance.contentLength, -1)

            const actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance.getReader()!))
            assert.equal(actual, srcData)

            // verify that release kicks in
            await instance.release();
            await nativeAssert.rejects(async () => {
                await IOUtils.readAllBytes(instance.getReader()!)
            }, {
                message: "released"
            })
        })
    })

    testData.forEach((expected, i) => {
        it(`should pass writing test with input ${i}`, async function() {
            const instance = new LambdaBasedQuasiHttpBody(
                () => Readable.from(ByteUtils.stringToBytes(
                    expected)))
            assert.equal(instance.contentLength, -1)

            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            await instance.writeBytesTo(writer)
            let actual = ByteUtils.bytesToString(
                Buffer.concat(chunks))
            assert.equal(actual, expected)

            // verify that release is a no-op
            await instance.release();

            // assert repeatability.
            chunks.length = 0 // reset
            await instance.writeBytesTo(writer)
            actual = ByteUtils.bytesToString(
                Buffer.concat(chunks))
            assert.equal(actual, expected)
        })
    })

    testData.forEach((expected, i) => {
        it(`should pass writing and release test with input ${i}`, async function() {
            const stream = Readable.from(
                ByteUtils.stringToBytes(expected))
            let endOfReadError;
            const instance = new LambdaBasedQuasiHttpBody(
                () => {
                    if (endOfReadError) {
                        throw endOfReadError
                    }
                    return stream
                })
            instance.releaseFunc = async () => {
                endOfReadError = new Error("released")
            }
            assert.equal(instance.contentLength, -1)

            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })

            await instance.writeBytesTo(writer)
            const actual = ByteUtils.bytesToString(
                Buffer.concat(chunks))
            assert.equal(actual, expected)

            // verify that release kicks in
            await instance.release();
            await nativeAssert.rejects(async () => {
                await instance.writeBytesTo(writer)
            }, {
                message: "released"
            })
        })
    })

    it("should pass with delegate writable", async function() {
        const expected = "sea"
        const srcData = ByteUtils.stringToBytes(expected)
        const selfWritable: ISelfWritable = {
            async writeBytesTo(writer) {
                await IOUtils.writeBytes(writer,
                    srcData)
            }
        }
        const instance = new LambdaBasedQuasiHttpBody(null,
            selfWritable)
        assert.equal(instance.contentLength, -1)

        const chunks = new Array<Buffer>()
        const writer = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk)
                callback()
            },
        })

        await instance.writeBytesTo(writer)
        let actual = ByteUtils.bytesToString(
            Buffer.concat(chunks))
        assert.equal(actual, expected)

        // verify that release is a no-op
        await instance.release()

        // assert continuation.
        await instance.writeBytesTo(writer)
        actual = ByteUtils.bytesToString(
            Buffer.concat(chunks))
        assert.equal(actual, expected + expected)
    })

    it('should fail due to absence of writable or readFunc', async function() {
        const writer = new Writable({
            write(chunk, encoding, callback) {
                callback()
            },
        })
        await nativeAssert.rejects(() =>
            new LambdaBasedQuasiHttpBody().writeBytesTo(writer), {
               name: "MissingDependencyError" 
            })
    })
})