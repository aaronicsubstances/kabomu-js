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
            const reader = Readable.from(
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
})