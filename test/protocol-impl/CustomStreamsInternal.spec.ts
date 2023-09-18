import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))

import * as MiscUtilsInternal from "../../src/MiscUtilsInternal"
import * as IOUtilsInternal from "../../src/IOUtilsInternal"
import {
    createBodyChunkDecodingStream,
    createBodyChunkEncodingStream,
    createContentLengthEnforcingStream
} from "../../src/protocol-impl/CustomStreamsInternal"
import { createRandomizedReadSizeBufferReader } from "../shared/RandomizedReadSizeBufferReader"
import { Readable } from "stream"
import { readAllBytes } from "../shared/ComparisonUtils"
import { KabomuIOError } from "../../src/errors"

describe("CustomStreamsInternal", function() {    
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
                    expect(e.message).to.contain(`length of ${contentLength}`)
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
            // pipeline destroy them.
        });
    });

    describe("#createBodyChunkEncodingStream", function() {
        const testData = [
            {
                srcData: "",
                expected: "01,0000000000"
            },
            {
                srcData: "a",
                expected: "01,0000000001a01,0000000000",
            },
            {
                srcData: "ab",
                expected: "01,0000000002ab01,0000000000"
            },
            {
                srcData: "abc",
                expected: "01,0000000003abc01,0000000000"
            },
            {
                srcData: "abcd",
                expected: "01,0000000004abcd01,0000000000"
            },
            {
                srcData: "abcde",
                expected: "01,0000000005abcde01,0000000000"
            },
            {
                srcData: "abcdefghi",
                expected: "01,0000000009abcdefghi01,0000000000"
            }
        ];
        testData.forEach(({ srcData, expected }, i) => {
            it(`should pass with input ${i}`, async function() {
                // arrange.
                let instance: Readable = Readable.from(
                    MiscUtilsInternal.stringToBytes(srcData));
                instance = createBodyChunkEncodingStream(instance);

                const actual = MiscUtilsInternal.bytesToString(
                    await readAllBytes(instance));

                // assert
                assert.equal(actual, expected);
            })
        })
    })

    describe("#createBodyChunkDecodingStream", function() {
        const testData = [
            {
                srcData: "01,0000000000",
                expected: "",
            },
            {
                srcData: "01,0000000001a01,0000000000",
                expected: "a",
            },
            {
                srcData: "01,0000000002ab01,0000000000",
                expected: "ab",
            },
            {
                srcData: "01,0000000003abc01,0000000000",
                expected: "abc",
            },
            {
                srcData: "01,0000000001a01,0000000002bc01,0000000000",
                expected: "abc",
            },
            {
                srcData: "01,0000000004abcd01,0000000000",
                expected: "abcd",
            },
            {
                srcData: "01,0000000003abc01,0000000001d01,0000000000",
                expected: "abcd"
            },
            {
                srcData: "01,0000000005abcde01,0000000000",
                expected: "abcde",
            },
            {
                srcData: "01,0000000001a01,0000000004bcde01,0000000000",
                expected: "abcde"
            },
            {
                srcData: "01,0000000009abcdefghi01,0000000000",
                expected: "abcdefghi",
            },
            {
                srcData: "01,0000000001a01,0000000007bcdefgh01,0000000001i01,0000000000",
                expected: "abcdefghi"
            }
        ];
        testData.forEach(({ srcData, expected }, i) => {
            it(`should pass with input ${i}`, async function() {
                // arrange.
                let instance: Readable = Readable.from(
                    MiscUtilsInternal.stringToBytes(srcData));
                instance = createBodyChunkDecodingStream(instance);

                const actual = MiscUtilsInternal.bytesToString(
                    await readAllBytes(instance));

                // assert
                assert.equal(actual, expected);
            })
        })

        const testDataWithLeftOvers = [
            {
                srcData: "01,0000000000sea blue",
                expected: "",
                leftOver: "sea blue"
            },
            {
                srcData: "01,0000000001a01,0000000000",
                expected: "a",
                leftOver: ""
            },
            {
                srcData: "01,0000000003abc01,0000000001d01,0000000000xyz\n",
                expected: "abcd",
                leftOver: "xyz\n"
            },
            {
                srcData: "01,0000000001a01,0000000007bcdefgh01,0000000001i01,0000000000" +
                    "-done with extra\nthat's it",
                expected: "abcdefghi",
                leftOver: "-done with extra\nthat's it"
            }
        ];
        testDataWithLeftOvers.forEach(({ srcData, expected, leftOver }, i) => {
            it(`should pass left over test with input ${i}`, async function() {
                // arrange.
                let srcStream = Readable.from(
                    MiscUtilsInternal.stringToBytes(srcData));
                const instance = createBodyChunkDecodingStream(srcStream);

                let actual = MiscUtilsInternal.bytesToString(
                    await readAllBytes(instance));

                // assert expected
                assert.equal(actual, expected);

                // assert left over
                actual = MiscUtilsInternal.bytesToString(
                    await readAllBytes(srcStream));
                assert.equal(actual, leftOver);
            })
        })

        const testErrorData = [
            {
                srcData: "",
                expectedError: "unexpected end of read"
            },
            {
                srcData: "01",
                expectedError: "unexpected end of read"
            },
            {
                srcData: "01,0000000001qabc,",
                expectedError: "unexpected end of read"
            },
            {
                srcData: "01,0000000012qabc,",
                expectedError: "unexpected end of read"
            },
            {
                srcData: "01234567890123456",
                expectedError: "invalid quasi http body chunk header"
            },
            {
                srcData: "01,0000000001h00,234567890123456",
                expectedError: "invalid quasi http body chunk header"
            },
            {
                srcData: "01,0000000tea",
                expectedError: "length: 0000000tea"
            },
            {
                srcData: "01,-000000001",
                expectedError: "length: -1"
            }
        ]
        testErrorData.forEach(({ srcData, expectedError }, i) => {
            it(`should fail with input ${i}`, async function() {
                // arrange
                const stream = Readable.from(
                    MiscUtilsInternal.stringToBytes(srcData))
                const instance = createBodyChunkDecodingStream(
                    stream)

                // act and assert
                await nativeAssert.rejects(() => {
                    return readAllBytes(instance)
                }, (e: any) => {
                    assert.instanceOf(e, KabomuIOError);
                    expect(e.message).to.contain(expectedError)
                    return true
                })
            })
        })
    })

    describe("BodyChunkCodecStreamsInternalTest", function() {
        const testData = [
            "", "a", "ab", "abc", "abcd", "abcde",
            "abcdefghi",
            "xdg".padEnd(50_0000, 'z') // test back pressure.
        ];
        testData.forEach((expected, i) => {
            it(`should pass with input ${i}`, async () => {
                // arrange
                let instance = createRandomizedReadSizeBufferReader(
                    MiscUtilsInternal.stringToBytes(expected))
                instance = createBodyChunkEncodingStream(instance)
                instance = createBodyChunkDecodingStream(instance)

                // act in bits to test back pressure
                const actual1 = await IOUtilsInternal.tryReadBytesFully(
                    instance, 4)
                const actual2 = await IOUtilsInternal.tryReadBytesFully(
                    instance, 30_000)
                const actual3 = await readAllBytes(instance)

                // assert
                const actual = Buffer.concat([
                    actual1, actual2, actual3
                ])
                assert.equal(actual, expected);
            })
        })
    })
})