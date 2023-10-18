import nativeAssert from "assert/strict"
const { expect, assert } = require('chai').use(require('chai-bytes'))

import * as MiscUtilsInternal from "../../src/MiscUtilsInternal"
import * as IOUtilsInternal from "../../src/IOUtilsInternal"
import {
    createTlvEncodingReadableStream,
    createTlvDecodingReadableStream,
    encodeTagAndLength,
    decodeTag,
    decodeLength,
} from "../../src/tlv/TlvUtils"
import { createRandomizedReadSizeBufferReader } from "../shared/RandomizedReadSizeBufferReader"
import { Readable } from "stream"
import { readAllBytes } from "../shared/ComparisonUtils"
import { KabomuIOError } from "../../src/errors"

describe("TlvUtils", function() {
    describe("#encodeTagAndLength", function() {
        const testData = [
            {
                tag: 0x15c0,
                length: 2,
                expected: Buffer.from([0, 0, 0x15, 0xc0,
                    0, 0, 0, 2])
            },
            {
                tag: 0x12342143,
                length: 0,
                expected: Buffer.from([0x12, 0x34, 0x21, 0x43,
                    0, 0, 0, 0])
            },
            {
                tag: 1,
                length: 0x78cdef01,
                expected: Buffer.from([0, 0, 0, 1,
                    0x78, 0xcd, 0xef, 0x01])
            }
        ]
        testData.forEach(({ tag, length, expected }, i) => {
            it(`should pass with input ${i}`, async () => {
                const actual = encodeTagAndLength(tag, length);
                assert.deepEqual(actual, expected);
            })
        })

        const testErrorData = [
            {
                tag: 0,
                length: 1
            },
            {
                tag: -1,
                length: 1
            },
            {
                tag: 2,
                length: -1
            }
        ]
        testErrorData.forEach(({ tag, length }, i) => {
            it(`should fail with input ${i}`, async () => {
                assert.throws(() => {
                    encodeTagAndLength(tag, length)
                })
            })
        })
    })

    describe("#decodeTag", function() {
        const testData = [
            {
                data: Buffer.from([0, 0, 0, 1]),
                offset: 0,
                expected: 1
            },
            {
                data: Buffer.from([0x03, 0x40, 0x89, 0x11]),
                offset: 0,
                expected: 0x03408911
            },
            {
                data: Buffer.from([1, 0x56, 0x10, 0x01, 0x20, 2]),
                offset: 1,
                expected: 0x56100120
            }
        ]
        testData.forEach(({ data, offset, expected }, i) => {
            it(`should pass with input ${i}`, async () => {
                const actual = decodeTag(data, offset);
                assert.deepEqual(actual, expected);
            })
        })

        const testErrorData = [
            {
                data: Buffer.from([1, 1, 1]),
                offset: 0
            },
            {
                data: Buffer.alloc(4),
                offset: 0
            },
            {
                data: Buffer.from([5, 1, 200, 3, 0, 3 ]),
                offset: 2
            }
        ]
        testErrorData.forEach(({ data, offset }, i) => {
            it(`should fail with input ${i}`, async () => {
                assert.throws(() => decodeTag(data, offset));
            })
        })
    })

    describe("#decodeLength", function() {
        const testData = [
            {
                data: Buffer.alloc(4),
                offset: 0,
                expected: 0
            },
            {
                data: Buffer.from([1, 2, 0, 0, 0, 1]),
                offset: 2,
                expected: 1
            },
            {
                data: Buffer.from([0x03, 0x40, 0x89, 0x11]),
                offset: 0,
                expected: 0x03408911
            },
            {
                data: Buffer.from([1, 0x56, 0x10, 0x01, 0x20, 2]),
                offset: 1,
                expected: 0x56100120
            }
        ]
        testData.forEach(({ data, offset, expected }, i) => {
            it(`should pass with input ${i}`, async () => {
                const actual = decodeLength(data, offset);
                assert.deepEqual(actual, expected);
            })
        })

        const testErrorData = [
            {
                data: Buffer.from([1, 1, 1]),
                offset: 0
            },
            {
                data: Buffer.from([5, 1, 200, 3, 0, 3 ]),
                offset: 2
            }
        ]
        testErrorData.forEach(({ data, offset }, i) => {
            it(`should fail with input ${i}`, async () => {
                assert.throws(() => decodeLength(data, offset));
            })
        })
    })

    describe("#createTlvEncodingReadableStream", function() {
        // NB: Test method only tests with one and zero bytes,
        // so as to guarantee that data will not be split,
        // even when test is ported to other languages.
        it("should pass", async function() {
            const srcByte = 45;
            const tagToUse = 16
            const backingStream = Readable.from(Buffer.from([ srcByte ]))
            const expected = Buffer.from([
                0, 0, 0, 16,
                0, 0, 0, 1,
                srcByte,
                0, 0, 0, 16,
                0, 0, 0, 0
            ])
            const instance = createTlvEncodingReadableStream(backingStream,
                tagToUse)
            const actual = await readAllBytes(instance)
            assert.equalBytes(actual, expected)
        })
    })

    describe("#createTlvDecodingReadableStream", function() {
        const testData = [
            {
                srcData: Buffer.from([
                    0, 0, 0, 89,
                    0, 0, 0, 0
                ]),
                expectedTag: 89,
                tagToIgnore: 5,
                expected: Buffer.alloc(0)
            },
            {
                srcData: Buffer.from([
                    0, 0, 0, 15,
                    0, 0, 0, 2,
                    2, 3,
                    0, 0, 0, 8,
                    0, 0, 0, 0
                ]),
                expectedTag: 8,
                tagToIgnore: 15,
                expected: Buffer.alloc(0)
            },
            {
                srcData: Buffer.from([
                    0, 0, 0, 8,
                    0, 0, 0, 2,
                    2, 3,
                    0, 0, 0, 8,
                    0, 0, 0, 0
                ]),
                expectedTag: 8,
                tagToIgnore: 15,
                expected: Buffer.from([2, 3])
            },
            {
                srcData: Buffer.from([
                    0, 0, 0, 8,
                    0, 0, 0, 1,
                    2,
                    0, 0, 0, 8,
                    0, 0, 0, 1,
                    3,
                    0, 0, 0, 8,
                    0, 0, 0, 0
                ]),
                expectedTag: 8,
                tagToIgnore: 15,
                expected: Buffer.from([2, 3])
            },
            {
                srcData: Buffer.from([
                    0, 0, 0x3d, 0x15,
                    0, 0, 0, 0,
                    0x30, 0xa3, 0xb5, 0x17,
                    0, 0, 0, 1,
                    2,
                    0, 0, 0x3d, 0x15,
                    0, 0, 0, 7,
                    0, 0, 0, 0, 0, 0, 0,
                    0x30, 0xa3, 0xb5, 0x17,
                    0, 0, 0, 1,
                    3,
                    0, 0, 0x3d, 0x15,
                    0, 0, 0, 0,
                    0x30, 0xa3, 0xb5, 0x17,
                    0, 0, 0, 4,
                    2, 3, 45, 62,
                    0, 0, 0x3d, 0x15,
                    0, 0, 0, 1,
                    1,
                    0x30, 0xa3, 0xb5, 0x17,
                    0, 0, 0, 8,
                    91, 100, 2, 3, 45, 62, 70, 87,
                    0x30, 0xa3, 0xb5, 0x17,
                    0, 0, 0, 0
                ]),
                expectedTag: 0x30a3b517,
                tagToIgnore: 0x3d15,
                expected: Buffer.from([2, 3, 2, 3, 45, 62,
                    91, 100, 2, 3, 45, 62, 70, 87])
            }
        ]
        testData.forEach(({ srcData, expectedTag,
                tagToIgnore, expected }, i) => {
            it(`should pass with input ${i}`, async () => {
                // arrange
                let instance = createRandomizedReadSizeBufferReader(
                    srcData)
                instance = createTlvDecodingReadableStream(
                    instance, expectedTag, tagToIgnore)
                
                // act
                const actual = await readAllBytes(instance)

                // assert
                assert.equalBytes(actual, expected)
            })
        })
        
        const testDataWithLeftOvers = [
            {
                srcData: Buffer.concat([
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 0
                    ]),
                    MiscUtilsInternal.stringToBytes("sea blue")
                ]),
                expected: "",
                leftOver: "sea blue"
            },
            {
                srcData: Buffer.concat([
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 1,
                        97,
                        0, 0, 0, 1,
                        0, 0, 0, 0,
                    ])
                ]),
                expected: "a",
                leftOver: ""
            },
            {
                srcData: Buffer.concat([
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 3
                    ]),
                    MiscUtilsInternal.stringToBytes("abc"),
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 1
                    ]),
                    MiscUtilsInternal.stringToBytes("d"),
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 0
                    ]),
                    MiscUtilsInternal.stringToBytes("xyz\n")
                ]),
                expected: "abcd",
                leftOver: "xyz\n"
            },
            {
                srcData: Buffer.concat([
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 1
                    ]),
                    MiscUtilsInternal.stringToBytes("a"),
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 7
                    ]),
                    MiscUtilsInternal.stringToBytes("bcdefgh"),
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 1
                    ]),
                    MiscUtilsInternal.stringToBytes("i"),
                    Buffer.from([
                        0, 0, 0, 1,
                        0, 0, 0, 0
                    ]),
                    MiscUtilsInternal.stringToBytes("-done with extra\nthat's it")
                ]),
                expected: "abcdefghi",
                leftOver: "-done with extra\nthat's it"
            }
        ];
        testDataWithLeftOvers.forEach(({ srcData, expected, leftOver }, i) => {
            it(`should pass left over test with input ${i}`, async function() {
                // arrange.
                let srcStream = Readable.from(srcData);
                const instance = createTlvDecodingReadableStream(srcStream,
                    1, 0);

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
                srcData: Buffer.from([
                    0, 0, 0x09, 0,
                    0, 0, 0, 12
                ]),
                expectedTag: 0x0900,
                tagToIgnore: 0,
                expectedError: "unexpected end of read"
            },
            {
                srcData: Buffer.from([
                    0, 0, 0x09, 0,
                    0, 0, 0, 12
                ]),
                expectedTag: 10,
                tagToIgnore: 30,
                expectedError: "unexpected tag"
            },
            {
                srcData: Buffer.from([
                    0, 0, 0, 0,
                    0, 0xff, 0xff, 0xec,
                    2, 3,
                    0, 0, 0, 14,
                    0, 0, 0, 0,
                    2, 3,
                    0, 0, 0, 8,
                    0, 0, 0, 0
                ]),
                expectedTag: 14,
                tagToIgnore: 8,
                expectedError: "invalid tag: 0"
            },
            {
                srcData: Buffer.from([
                    0, 0, 0, 14,
                    0xff, 0xff, 0xff, 0xec,
                    2, 3,
                    0, 0, 0, 14,
                    0, 0, 0, 0,
                    2, 3,
                    0, 0, 0, 8,
                    0, 0, 0, 0
                ]),
                expectedTag: 14,
                tagToIgnore: 15,
                expectedError: "invalid tag value length: -20"
            }
        ]
        testErrorData.forEach(({ srcData, expectedTag,
                tagToIgnore, expectedError }, i) => {
            it(`should fail with input ${i}`, async function() {
                // arrange
                let instance = Readable.from(srcData)
                instance = createTlvDecodingReadableStream(
                    instance, expectedTag, tagToIgnore)

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
            {
                expected: "",
                tagToUse: 1
            },
            {
                expected: "a",
                tagToUse: 4
            },
            {
                expected: "ab",
                tagToUse: 45
            },
            {
                expected: "abc",
                tagToUse: 60
            },
            {
                expected: "abcd",
                tagToUse: 120_000_000
            },
            {
                expected: "abcde",
                tagToUse: 34_000_000
            },
            {
                expected: "abcdefghi",
                tagToUse: 0x3245671d
            },
            {
                expected: "xdg".padEnd(50_0000, 'z'), // test back pressure.
                tagToUse: 5
            }
        ];
        testData.forEach(({ expected, tagToUse }, i) => {
            it(`should pass with input ${i}`, async () => {
                // arrange
                let instance = createRandomizedReadSizeBufferReader(
                    MiscUtilsInternal.stringToBytes(expected))
                instance = createTlvEncodingReadableStream(instance, tagToUse)
                instance = createTlvDecodingReadableStream(instance,
                    tagToUse, 0)

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