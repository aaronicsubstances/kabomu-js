import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))

import * as MiscUtilsInternal from "../../src/MiscUtilsInternal"
import * as IOUtilsInternal from "../../src/IOUtilsInternal"
import {
    createContentLengthEnforcingStream
} from "../../src/tlv/TlvUtils"
import { createRandomizedReadSizeBufferReader } from "../shared/RandomizedReadSizeBufferReader"
import { Readable } from "stream"
import { readAllBytes } from "../shared/ComparisonUtils"
import { KabomuIOError } from "../../src/errors"

describe("TlvUtils", function() {    
    describe("#createContentLengthEnforcingStream", function() {
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
                contentLength: 6,
                srcData: "abcdefghi",
                expected: "abcdef"
            }
        ]
        testData.forEach(({contentLength, srcData, expected}, i) => {
            it(`should pass with input ${i}`, async function() {
                // arrange
                const stream = createRandomizedReadSizeBufferReader(
                    MiscUtilsInternal.stringToBytes(srcData))
                const instance = createContentLengthEnforcingStream(
                    stream, contentLength)

                // act
                let actual = MiscUtilsInternal.bytesToString(
                    await readAllBytes(instance))

                // assert
                assert.equal(actual, expected)

                // assert non-repeatability.
                actual = MiscUtilsInternal.bytesToString(
                    await readAllBytes(instance))
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
                    MiscUtilsInternal.stringToBytes(srcData))
                const instance = createContentLengthEnforcingStream(
                    stream, contentLength)
                
                // act and assert
                await nativeAssert.rejects(() => {
                    return readAllBytes(instance)
                }, (e: any) => {
                    assert.instanceOf(e, KabomuIOError);
                    expect(e.message).to.contain(`end of read`)
                    return true
                })
            })
        })

        it("should pass with zero byte reads", async function() {
            const stream = Readable.from(Buffer.from([0, 1, 2, 4]))
            const instance = createContentLengthEnforcingStream(
                stream, 3)
            
            let actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.readBytesFully(instance, 3);
            assert.equalBytes(actual, Buffer.from([0, 1, 2]))

            actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            // test aftermath reads
            actual = await readAllBytes(stream);
            assert.equalBytes(actual, Buffer.from([ 4 ]));
        });

        it("should pass with aftermath reads", async function() {
            const stream = Readable.from(async function*() {
                yield Buffer.from([1])
                yield Buffer.from([2, 3])
                yield Buffer.from([30, 28, 52, 45, 67, 9])
            }());

            const errorCb = () => {};
            stream.on("error", errorCb);
            assert.equal(stream.listenerCount("error"), 1);

            const instance = createContentLengthEnforcingStream(
                stream, 5);
            instance.on("error", errorCb);
            assert.equal(instance.listenerCount("error"), 1);
            
            let actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.readBytesFully(instance, 3);
            assert.equalBytes(actual, Buffer.from([1, 2, 3]))

            actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.tryReadBytesFully(instance, 3);
            assert.equalBytes(actual, Buffer.from([30, 28]))

            actual = await IOUtilsInternal.tryReadBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            // test that error listener was not removed after
            // finishing content length stream.
            assert.equal(instance.listenerCount("error"), 1);
            assert.equal(stream.listenerCount("error"), 1);

            // test aftermath reads
            actual = await IOUtilsInternal.readBytesFully(stream, 3);
            assert.equalBytes(actual, Buffer.from([52, 45, 67]))

            actual = await readAllBytes(stream);
            assert.equalBytes(actual, Buffer.from([ 9 ]));

            // can't test error listener count on stream here.
            // Because readAllBytes uses pipeline, which doesn't
            // try to remove all listeners, because it
            // assumes reader and writer arguments will not
            // be needed after the transfer since the
            // pipeline destroys them.
        });
    });
})