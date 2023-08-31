import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))

import * as ByteUtils from "../../src/common/ByteUtils"
import * as IOUtils from "../../src/common/IOUtils"
import { createContentLengthEnforcingCustomReader } from "../../src/common/ContentLengthEnforcingCustomReader"
import { createRandomizedReadSizeBufferReader } from "../shared/common/RandomizedReadSizeBufferReader"
import { Readable } from "stream"

describe("ContentLengthEnforcingCustomReader", function() {
    const testData = [
        {
            contentLength: 0,
            srcData: "",
            expected: ""
        },
        {
            contentLength: 0,
            srcData: "a",
            expected: ""
        },
        {
            contentLength: 1,
            srcData: "ab",
            expected: "a"
        },
        {
            contentLength: -2,
            srcData: "ab",
            expected: "ab"
        },
        {
            contentLength: 2,
            srcData: "abc",
            expected: "ab"
        },
        {
            contentLength: 3,
            srcData: "abc",
            expected: "abc"
        },
        {
            contentLength: 4,
            srcData: "abcd",
            expected: "abcd"
        },
        {
            contentLength: 5,
            srcData: "abcde",
            expected: "abcde"
        },
        {
            contentLength: -1,
            srcData: "abcdef",
            expected: "abcdef"
        }
    ]
    testData.forEach(({contentLength, srcData, expected}, i) => {
        it(`should pass with input ${i}`, async function() {
            // arrange
            const stream = createRandomizedReadSizeBufferReader(
                ByteUtils.stringToBytes(srcData))
            const instance = createContentLengthEnforcingCustomReader(
                stream, contentLength)

            // act
            let actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance))

            // assert
            assert.equal(actual, expected)

            // assert non-repeatability.
            actual = ByteUtils.bytesToString(
                await IOUtils.readAllBytes(instance))
            assert.equal(actual, "")
        })
    })

    const testErrorData = [
        {
            contentLength: 2,
            srcData: ""
        },
        {
            contentLength: 4,
            srcData: "abc"
        },
        {
            contentLength: 5,
            srcData: "abcd"
        },
        {
            contentLength: 15,
            srcData: "abcdef"
        }
    ]
    testErrorData.forEach(({contentLength, srcData}, i) => {
        it(`should fail with input ${i}`, async function() {
            // arrange
            const stream = Readable.from(
                ByteUtils.stringToBytes(srcData))
            const instance = createContentLengthEnforcingCustomReader(
                stream, contentLength)
            
            // act and assert
            await nativeAssert.rejects(() => {
                return IOUtils.readAllBytes(instance)
            }, (e: any) => {
                expect(e.message).to.contain(`length of ${contentLength}`)
                return true
            })
        })
    })

    it("should pass with zero byte reads (1)", async function() {
        const stream = Readable.from(Buffer.from([0, 1, 2]))
        const instance = createContentLengthEnforcingCustomReader(
            stream, -1)
        
        let actual = await IOUtils.readBytes(instance, 0)
        assert.isNotOk(actual)

        actual = await IOUtils.readBytes(instance, 3)
        assert.equal(actual?.length, 3)
        assert.equalBytes(actual, Buffer.from([0, 1, 2]))

        actual = await IOUtils.readBytes(instance, 0)
        assert.isNotOk(actual)
    })

    it("should pass with zero byte reads (2)", async function() {
        const stream = Readable.from(Buffer.from([0, 1, 2]))
        const instance = createContentLengthEnforcingCustomReader(
            stream, 3)
        
        let actual = await IOUtils.readBytes(instance, 0)
        assert.isNotOk(actual)

        actual = await IOUtils.readBytes(instance, 3)
        assert.equal(actual?.length, 3)
        assert.equalBytes(actual, Buffer.from([0, 1, 2]))

        actual = await IOUtils.readBytes(instance, 0)
        assert.isNotOk(actual)
    })

    it("should pass with zero byte reads (3)", async function() {
        const stream = Readable.from(Buffer.from([0, 1, 2]))
        const contentLength = 4
        const instance = createContentLengthEnforcingCustomReader(
            stream, contentLength)
        
        // due to buffering, the only guaranteed way to test
        // is to first encounter exception before attempting
        // zero-byte reads.
        
        await nativeAssert.rejects(async () => {
            await IOUtils.readBytesFully(instance, contentLength)
        }, (e: any) => {
            expect(e.message).to.contain(`length of ${contentLength}`)
            return true
        })
        
        await nativeAssert.rejects(async () => {
            await IOUtils.readBytes(instance, 0)
        }, (e: any) => {
            expect(e.message).to.contain(`length of ${contentLength}`)
            return true
        })
    })
})