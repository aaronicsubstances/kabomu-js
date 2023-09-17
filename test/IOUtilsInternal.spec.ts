import nativeAssert from "assert/strict";
const { expect, assert } = require('chai').use(require('chai-bytes'))

import { Readable } from "stream"
import * as IOUtilsInternal from "../src/IOUtilsInternal"
import {
    createRandomizedReadSizeBufferReader
} from "./shared/RandomizedReadSizeBufferReader";

describe("IOUtilsInternal", function() {
    describe("#tryReadBytesFully", function() {
        it("should pass (1)", async function() {
            const stream = Readable.from(Buffer.from([1, 2, 3]))
            const errorCb = () => {};
            stream.on("error", errorCb);
            assert.equal(stream.listenerCount("error"), 1);

            let actual = await IOUtilsInternal.tryReadBytesFully(stream, 2)
            assert.equalBytes(actual, Buffer.from([1, 2]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 0)
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 2)
            assert.equalBytes(actual, Buffer.from([3]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.alloc(0));

            // verify that finished only removed its extra
            // listeners.
            assert.equal(stream.listenerCount("error"), 1);
        })

        it('should pass (2)', async function() {
            const stream = Readable.from(async function*() {
                yield Buffer.from([1])
                yield Buffer.from([2])
                yield Buffer.from([3])
            }());
            let actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.from([1]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.from([2]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 0)
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.from([3]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.alloc(0));
        })

        it('should pass (2)', async function() {
            const stream = Readable.from(async function*() {
                yield Buffer.from([1])
                yield Buffer.from([2, 3])
                yield Buffer.from([30, 28, 52, 45, 67, 9])
            }());
            let actual = await IOUtilsInternal.tryReadBytesFully(stream, 2)
            assert.equalBytes(actual, Buffer.from([1, 2]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.from([3]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 0)
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.from([30]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 3)
            assert.equalBytes(actual, Buffer.from([28, 52, 45]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 3)
            assert.equalBytes(actual, Buffer.from([67, 9]))

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 0)
            assert.equalBytes(actual, Buffer.alloc(0));

            actual = await IOUtilsInternal.tryReadBytesFully(stream, 1)
            assert.equalBytes(actual, Buffer.alloc(0));
        })

        it("should fail (1)", async function() {
            await nativeAssert.rejects(async () => {
                await IOUtilsInternal.tryReadBytesFully(null as any, 2);
            });
        })

        it("should fail (2)", async function() {
            await nativeAssert.rejects(async () => {
                const reader = Readable.from(Buffer.alloc(2));
                reader.destroy(new Error("failed"))
                await IOUtilsInternal.tryReadBytesFully(reader, 2);
            }, {
                message: "failed"
            });
        })

        it("should fail (3)", async function() {
            await nativeAssert.rejects(async () => {
                const reader = Readable.from((function*(){
                    yield Buffer.alloc(1)
                    yield "problematic chunk"
                })());
                // either of these reads should get
                // to the problematic chunk.
                await IOUtilsInternal.tryReadBytesFully(reader, 2);
                await IOUtilsInternal.tryReadBytesFully(reader, 2);
            }, {
                name: "KabomuIOError",
                message: "expected Buffer chunks but got chunk of type string"
            });
        })
    })

    describe("#readBytesFully", function() {
        it("should pass", async function() {
            // arrange
            const reader = createRandomizedReadSizeBufferReader(
                Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])
            )

            // act
            let readBuffer = await IOUtilsInternal.readBytesFully(reader, 3)

            // assert
            assert.equalBytes(readBuffer,
                Buffer.from([0, 1, 2]))
            
            // assert that zero length reading doesn't cause problems.
            readBuffer = await IOUtilsInternal.readBytesFully(reader, 0)
            assert.equalBytes(readBuffer, Buffer.alloc(0))

            // act again
            readBuffer = await IOUtilsInternal.readBytesFully(reader, 3)
            
            // assert
            assert.equalBytes(readBuffer, Buffer.from([3, 4, 5]))
            
            // act again
            readBuffer = await IOUtilsInternal.readBytesFully(reader, 2)
            
            // assert
            assert.equalBytes(readBuffer, Buffer.from([6, 7]))

            // test zero byte reads.
            readBuffer = await IOUtilsInternal.readBytesFully(reader, 0)
            assert.equalBytes(readBuffer, Buffer.alloc(0))
        })

        it("should fail (1)", async function() {
            // arrange
            const reader = createRandomizedReadSizeBufferReader(
                Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])
            )

            // act
            let readBuffer = await IOUtilsInternal.readBytesFully(reader, 5)
            
            // assert
            assert.equalBytes(readBuffer,
                Buffer.from([0, 1, 2, 3, 4]))
            
            // act and assert unexpected end of read
            await nativeAssert.rejects(async function() {
                await IOUtilsInternal.readBytesFully(reader, 5);
            }, (err: any) => {
                expect(err.message).to.contain("end of read")
                return true
            })
        })

        it("should fail (2)", async function() {
            await nativeAssert.rejects(async () => {
                const reader = Readable.from((function*(){
                    yield Buffer.alloc(1)
                    yield 20
                })());
                await IOUtilsInternal.readBytesFully(reader, 5);
            }, {
                name: "KabomuIOError",
                message: "expected Buffer chunks but got chunk of type number"
            });
        })
    })

    describe("#readAllBytesUpToGivenLimit", function() {
        const testData = [
            {
                bufferingLimit: 0,
                expected: Buffer.alloc(0)
            },
            {
                bufferingLimit: 0,
                expected: Buffer.from([2])
            },
            {
                bufferingLimit: 6,
                expected: Buffer.from([0, 1, 2, 5, 6, 7])
            },
            {
                bufferingLimit: 0,
                expected: Buffer.from([0, 1, 4, 5, 6, 7])
            },
            {
                bufferingLimit: 10,
                expected: Buffer.from([0, 1, 2, 4, 5, 6, 7, 9])
            },
            {
                bufferingLimit: -1,
                expected: Buffer.from([3, 0, 1, 2, 4, 5, 6, 7, 9,
                    8, 10, 11, 12, 113, 114])
            }
        ]
        testData.forEach(({bufferingLimit, expected}, i) => {
            it(`should pass with input ${i}`, async function() {
                // arrange
                const reader = createRandomizedReadSizeBufferReader(
                    expected
                )

                // act
                const actual = await IOUtilsInternal.readAllBytesUpToGivenLimit(reader,
                    bufferingLimit)

                // assert
                assert.equalBytes(actual, expected)

                // assert that reader has been exhausted.
                const actual2 = await IOUtilsInternal.readAllBytesUpToGivenLimit(reader, 1)
                assert.equalBytes(actual2, Buffer.alloc(0))
            })
        })
        testData.forEach(({bufferingLimit, expected}, i) => {
            it(`should pass with remaining data input ${i}`, async function() {
                // arrange by doubling the expectation and reading half way,
                // to test that remaining bytes are correctly copied
                const reader = createRandomizedReadSizeBufferReader(
                    Buffer.concat([expected, expected]))
                const temp = await IOUtilsInternal.readBytesFully(reader,
                    expected.length)
                assert.equalBytes(temp, expected)
                
                // now continue to test readAllBytes() on
                // remaining data
                const actual = await IOUtilsInternal.readAllBytesUpToGivenLimit(reader,
                    bufferingLimit)

                // assert
                assert.equalBytes(actual, expected)

                // assert that reader has been exhausted.
                const actual2 = await IOUtilsInternal.readAllBytesUpToGivenLimit(reader, 1)
                assert.equalBytes(actual2, Buffer.alloc(0))
            })
        })

        const testErrorData = [
            {
                srcData: Buffer.from([0, 1, 2, 5, 6, 7]),
                bufferingLimit: 5
            },
            {
                srcData: Buffer.from([0, 1, 2, 4, 5, 6, 7, 9]),
                bufferingLimit: 7
            },
            {
                srcData: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 9]),
                bufferingLimit: 8
            },
        ]
        testErrorData.forEach(({srcData, bufferingLimit}, i) => {
            it(`should fail with input ${i}`, async function() {
                const reader = createRandomizedReadSizeBufferReader(
                    srcData
                );
                const actual = await IOUtilsInternal.readAllBytesUpToGivenLimit(reader,
                    bufferingLimit);
                assert.isNotOk(actual);
            })
        })
    })
})