import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))

import * as MiscUtilsInternal from "../../src/MiscUtilsInternal"
import * as IOUtilsInternal from "../../src/IOUtilsInternal"
import {
    createMaxLengthEnforcingStream
} from "../../src/tlv/TlvUtils"
import { createRandomizedReadSizeBufferReader } from "../shared/RandomizedReadSizeBufferReader"
import { Readable } from "stream"
import { readAllBytes } from "../shared/ComparisonUtils"
import { KabomuIOError } from "../../src/errors"

describe("TlvUtils", function() {    
    describe("#createMaxLengthEnforcingStream", function() {
        const testData = [
            {
                maxLength: 0,
                expected: ""
            },
            {
                maxLength: 0,
                expected: "a"
            },
            {
                maxLength: 2,
                expected: "a"
            },
            {
                maxLength: 2,
                expected: "ab"
            },
            {
                maxLength: 3,
                expected: "a"
            },
            {
                maxLength: 3,
                expected: "abc"
            },
            {
                maxLength: 4,
                expected: "abcd"
            },
            {
                maxLength: 5,
                expected: "abcde"
            },
            {
                maxLength: 60,
                expected: "abcdefghi",
            }
        ]
        testData.forEach(({ maxLength, expected }, i) => {
            it(`should pass with input ${i}`, async function() {
                // arrange
                const stream = createRandomizedReadSizeBufferReader(
                    MiscUtilsInternal.stringToBytes(expected))
                const instance = createMaxLengthEnforcingStream(
                    stream, maxLength)

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
                maxLength: 1,
                srcData: "ab"
            },
            {
                maxLength: 2,
                srcData: "abc"
            },
            {
                maxLength: 3,
                srcData: "abcd"
            },
            {
                maxLength: 5,
                srcData: "abcdefxyz"
            }
        ]
        testErrorData.forEach(({ maxLength, srcData }, i) => {
            it(`should fail with input ${i}`, async function() {
                // arrange
                const stream = Readable.from(
                    MiscUtilsInternal.stringToBytes(srcData))
                const instance = createMaxLengthEnforcingStream(
                    stream, maxLength)
                
                // act and assert
                await nativeAssert.rejects(() => {
                    return readAllBytes(instance)
                }, (e: any) => {
                    assert.instanceOf(e, KabomuIOError);
                    expect(e.message).to.contain(
                        `exceeds limit of ${maxLength}`)
                    return true
                })
            })
        })

        it("should pass with zero byte reads", async function() {
            let instance = Readable.from(Buffer.from([0, 1, 2, 4]))
            instance = createMaxLengthEnforcingStream(
                instance)
            
            let actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.readBytesFully(instance, 3);
            assert.equalBytes(actual, Buffer.from([0, 1, 2]))

            actual = await readAllBytes(instance);
            assert.equalBytes(actual, Buffer.from([ 4 ]));

            actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));
        });

        it("should pass with reads from generator", async function() {
            let instance = Readable.from(async function*() {
                yield Buffer.from([1])
                yield Buffer.from([2, 3])
                yield Buffer.from([30, 28, 52, 45, 67, 9])
            }());
            instance = createMaxLengthEnforcingStream(
                instance);
            
            let actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.readBytesFully(instance, 3);
            assert.equalBytes(actual, Buffer.from([1, 2, 3]))

            actual = await IOUtilsInternal.readBytesFully(instance, 0);
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.tryReadBytesFully(instance, 3);
            assert.equalBytes(actual, Buffer.from([30, 28, 52]))

            actual = await IOUtilsInternal.tryReadBytesFully(instance, 2);
            assert.equalBytes(actual, Buffer.from([45, 67]))

            actual = await readAllBytes(instance);
            assert.equalBytes(actual, Buffer.from([ 9 ]));
        });
    });
})