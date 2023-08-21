import nativeAssert from "assert/strict";
const { expect, assert } = require('chai').use(require('chai-bytes'))

import { Readable, Writable } from "stream"
import * as IOUtils from "../../src/common/IOUtils"
import * as ByteUtils from "../../src/common/ByteUtils"
import { createRandomizedReadSizeBufferReader } from "../shared/RandomizedReadSizeBufferReader";

describe("IOUtils", function() {
    describe("#readBytes", function() {
        it("should pass (1)", async function() {
            const stream = Readable.from(Buffer.from([1, 2, 3]))
            let actual = Buffer.alloc(3)
            let actualReadLen = await IOUtils.readBytes(stream, actual, 0,
                2)
            assert.equal(actualReadLen, 2)
            assert.equalBytes(actual.subarray(0, 2),
                Buffer.from([1, 2]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 1, 0)
            assert.equal(actualReadLen, 0)
            assert.equalBytes(actual, Buffer.from([1, 2, 0]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 1, 2)
            assert.equal(actualReadLen, 1)
            assert.equalBytes(actual.subarray(1, 2),
                Buffer.from([3]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 2, 1)
            assert.equal(actualReadLen, 0)
            assert.equalBytes(actual, Buffer.from([1, 3, 0]))
        })

        it('should pass (2)', async function() {
            const stream = Readable.from(async function*() {
                yield Buffer.from([1])
                yield Buffer.from([2])
                yield Buffer.from([3])
            }());
            let actual = Buffer.alloc(3)
            let actualReadLen = await IOUtils.readBytes(stream, actual, 0,
                2)
            assert.equal(actualReadLen, 1)
            assert.equalBytes(actual.subarray(0, 2),
                Buffer.from([1, 0]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 1, 2)
            assert.equal(actualReadLen, 1)
            assert.equalBytes(actual.subarray(1, 2),
                Buffer.from([2]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 2, 0)
            assert.equal(actualReadLen, 0)
            assert.equalBytes(actual, Buffer.from([1, 2, 0]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 2, 1)
            assert.equal(actualReadLen, 1)
            assert.equalBytes(actual.subarray(2, 3),
                Buffer.from([3]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 2, 1)
            assert.equal(actualReadLen, 0)
            assert.equalBytes(actual, Buffer.from([1, 2, 3]))
        })

        it("should fail (1)", async function() {
            await nativeAssert.rejects(async () => {
                await IOUtils.readBytes(null as any,
                    Buffer.alloc(3), 0, 2 );
            });
        })

        it("should fail (2)", async function() {
            await nativeAssert.rejects(async () => {
                const reader = Readable.from(Buffer.alloc(2));
                reader.destroy(new Error("failed"))
                await IOUtils.readBytes(reader,
                    Buffer.alloc(3), 0, 2 );
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
                await IOUtils.readBytes(reader,
                    Buffer.alloc(3), 0, 2 );
                await IOUtils.readBytes(reader,
                    Buffer.alloc(3), 0, 2 );
            }, {
                name: "CustomIOError",
                message: "expected Buffer chunks but got chunk of type string"
            });
        })
    })

    describe("#writeBytes", function() {
        it("should pass (1)", async function() {
            const chunks = new Array<Buffer>();
            const stream = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                }
            })
            await IOUtils.writeBytes(stream, Buffer.from([1, 2, 3]), 0, 2);
            await IOUtils.writeBytes(stream, Buffer.from([0, 3, 2, 1]), 1, 2);
            const actual = Buffer.concat(chunks);
            assert.equalBytes(actual, Buffer.from([1, 2, 3, 2]))
        })

        it("should pass (2)", async function() {
            const chunks = new Array<Buffer>();
            const stream = new Writable({
                highWaterMark: 2,
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                }
            })
            await IOUtils.writeBytes(stream, Buffer.from([]), 0, 0);
            await IOUtils.writeBytes(stream, Buffer.from([1, 2, 3]), 0, 2);
            await IOUtils.writeBytes(stream, Buffer.from([]), 0, 0);
            await IOUtils.writeBytes(stream, Buffer.from([0, 3, 2, 1]), 1, 2);
            const actual = Buffer.concat(chunks);
            assert.equalBytes(actual, Buffer.from([1, 2, 3, 2]))
        })

        it("should fail (1)", async function() {
            await nativeAssert.rejects(async () => {
                await IOUtils.writeBytes(null as any,
                    Buffer.alloc(3), 0, 2 );
            });
        })

        it("should fail (2)", async function() {
            await nativeAssert.rejects(async () => {
                const writer = new Writable({
                    write(chunk, encoding, cb) {
                        cb()
                    }
                })
                writer.destroy()
                await IOUtils.writeBytes(writer,
                    Buffer.alloc(3), 0, 2 );
            });
        })

        it("should fail (3)", async function() {
            await nativeAssert.rejects(async () => {
                const writer = new Writable({
                    write(chunk, encoding, cb) {
                        cb(new Error("write failure"))
                    },
                    destroy(error, cb) {
                        // without this test fails with
                        // stack trace similar to unhandled
                        // exception
                        cb(null)
                    }
                })
                await IOUtils.writeBytes(writer,
                    Buffer.alloc(3), 0, 2 );
            }, {
                message: "write failure"
            });
        })
    })

    describe("#readBytesFully", function() {
        it("should pass", async function() {
            // arrange
            const reader = createRandomizedReadSizeBufferReader(
                Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])
            )
            let readBuffer = Buffer.alloc(6)

            // act
            await IOUtils.readBytesFully(reader, readBuffer, 0, 3)

            // assert
            assert.equalBytes(readBuffer.subarray(0, 3),
                Buffer.from([0, 1, 2]))
            
            // assert that zero length reading doesn't cause problems.
            await IOUtils.readBytesFully(reader, readBuffer, 3, 0)

            // act again
            await IOUtils.readBytesFully(reader, readBuffer, 1, 3)
            
            // assert
            assert.equalBytes(readBuffer.subarray(1, 4),
                Buffer.from([3, 4, 5]))
            
            // act again
            await IOUtils.readBytesFully(reader, readBuffer, 3, 2)
            
            // assert
            assert.equalBytes(readBuffer.subarray(3, 5),
                Buffer.from([6, 7]))

            // test zero byte reads.
            readBuffer = Buffer.from([2, 3, 5, 8])
            await IOUtils.readBytesFully(reader, readBuffer, 0, 0)
            assert.equalBytes(readBuffer, Buffer.from([2, 3, 5, 8]))
        })

        it("should fail (1)", async function() {
            // arrange
            const reader = createRandomizedReadSizeBufferReader(
                Buffer.from([0, 1, 2, 3, 4, 5, 6, 7])
            )
            let readBuffer = Buffer.alloc(5)

            // act
            await IOUtils.readBytesFully(reader, readBuffer,
                0, readBuffer.length)
            
            // assert
            assert.equalBytes(readBuffer,
                Buffer.from([0, 1, 2, 3, 4]))
            
            // act and assert unexpected end of read
            await nativeAssert.rejects(async function() {
                await IOUtils.readBytesFully(reader, readBuffer, 0,
                    readBuffer.length);
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
                await IOUtils.readBytesFully(reader,
                    Buffer.alloc(10), 0, 5 );
            }, {
                name: "CustomIOError",
                message: "expected Buffer chunks but got chunk of type number"
            });
        })
    })

    describe("#readAllBytes", function() {
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
                const actual = await IOUtils.readAllBytes(reader,
                    bufferingLimit)

                // assert
                assert.equalBytes(actual, expected)

                // assert that reader has been exhausted.
                const actual2 = await IOUtils.readBytes(reader, Buffer.alloc(1),
                    0, 1)
                assert.equal(actual2, 0)
            })
        })
        testData.forEach(({bufferingLimit, expected}, i) => {
            it(`should pass with remaining data input ${i}`, async function() {
                // arrange by doubling the expectation and reading half way,
                // to test that remaining bytes are correctly copied
                const reader = createRandomizedReadSizeBufferReader(
                    Buffer.concat([expected, expected]))
                const temp = Buffer.alloc(expected.length)
                await IOUtils.readBytesFully(reader, temp, 0,
                    temp.length)
                assert.equalBytes(temp, expected)
                
                // now continue to test readAllBytes() on
                // remaining data
                const actual = await IOUtils.readAllBytes(reader,
                    bufferingLimit)

                // assert
                assert.equalBytes(actual, expected)

                // assert that reader has been exhausted.
                const actual2 = await IOUtils.readBytes(reader, Buffer.alloc(1),
                    0, 1)
                assert.equal(actual2, 0)
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
                // arrange
                const reader = createRandomizedReadSizeBufferReader(
                    srcData
                )

                // act
                await nativeAssert.rejects(async () => {
                    await IOUtils.readAllBytes(reader,
                        bufferingLimit)
                }, (e: any) => {
                    expect(e.message).to.contain(`limit of ${bufferingLimit}`)
                    return true;
                })
            })
        })
    })

    describe("#copyBytes", function() {
        const testData = [
            "", "ab", "abc", "abcd", "abcde", "abcdef"
        ]
        testData.forEach((x, i) => {
            it(`it should pass with buffered reader ${i}`, async function() {
                // arrange
                const expected = ByteUtils.stringToBytes(x)
                const reader = Readable.from(expected)
                const chunks = new Array<Buffer>()
                const writer = new Writable({
                    write(chunk, encoding, cb) {
                        chunks.push(chunk)
                        cb()
                    }
                })

                // act
                await IOUtils.copyBytes(reader, writer)

                // assert
                assert.equalBytes(Buffer.concat(chunks), expected)

                // assert that reader has been exhausted.
                const actual2 = await IOUtils.readBytes(reader, Buffer.alloc(1),
                    0, 1)
                assert.equal(actual2, 0)
            })
        })
        testData.forEach((x, i) => {
            it(`it should pass with remaining bytes in generator-based reader ${i}`, async function() {
                // arrange
                const expected = ByteUtils.stringToBytes(x)

                // double the expectation and read half way,
                // to test that remaining bytes are correctly copied
                const reader = createRandomizedReadSizeBufferReader(
                    Buffer.concat([expected, expected]))
                const temp = Buffer.alloc(expected.length)
                await IOUtils.readBytesFully(reader, temp, 0,
                    temp.length)
                assert.equalBytes(temp, expected)

                // now continue to test copyBytes() on
                // remaining data
                const chunks = new Array<Buffer>()
                const writer = new Writable({
                    write(chunk, encoding, cb) {
                        chunks.push(chunk)
                        cb()
                    }
                })

                // act
                await IOUtils.copyBytes(reader, writer)

                // assert
                assert.equalBytes(Buffer.concat(chunks), expected)

                // assert that reader has been exhausted.
                const actual2 = await IOUtils.readBytes(reader, Buffer.alloc(1),
                    0, 1)
                assert.equal(actual2, 0)
            })
        })
    })

    describe("#endWrites", function() {
        it("should pass with yet-to-end writer", async function() {
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                }
            })

            await IOUtils.writeBytes(writer,
                Buffer.from([3, 4]), 0, 2)

            await IOUtils.endWrites(writer)

            await nativeAssert.rejects(async () =>
                IOUtils.writeBytes(writer,
                    Buffer.from([3, 4]), 0, 2))

            assert.equalBytes(Buffer.concat(chunks),
                Buffer.from([3, 4]))
        })

        it("should pass with ended writer", async function() {
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                }
            })

            await IOUtils.endWrites(writer)

            await nativeAssert.rejects(async () =>
                IOUtils.writeBytes(writer,
                    Buffer.from([3, 4]), 0, 2))

            assert.equalBytes(Buffer.concat(chunks),
                Buffer.from([]))
        })

        it("should pass with destroyed writer", async function() {
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                }
            })

            writer.destroy()

            await IOUtils.endWrites(writer)

            await nativeAssert.rejects(async () =>
                IOUtils.writeBytes(writer,
                    Buffer.from([3, 4]), 0, 2))

            assert.equalBytes(Buffer.concat(chunks),
                Buffer.from([]))
        })

        it("should pass with errored writer", async function() {
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    cb(new Error("write problem!"))
                },
                destroy(e, cb) {
                    // without this test fails with
                    // stack trace similar to unhandled
                    // exception
                    cb(null)
                }
            })

            await nativeAssert.rejects(async () =>
                IOUtils.writeBytes(writer,
                    Buffer.from([3, 4]), 0, 2), {
                message: "write problem!"
            })

            await nativeAssert.rejects(async () => {
                await IOUtils.endWrites(writer)
            }, {
                message: "write problem!"
            })

            await nativeAssert.rejects(async () =>
                IOUtils.writeBytes(writer,
                    Buffer.from([3, 4]), 0, 2), {
                message: "write problem!"
            })

            assert.equalBytes(Buffer.concat(chunks),
                Buffer.from([]))
        })
    })
})