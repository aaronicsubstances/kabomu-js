const { assert } = require('chai').use(require('chai-bytes'))

import * as ByteUtils from "../../src/common/ByteUtils"

describe("ByteUtils", function() {
    describe("#isValidByteBufferSlice", function() {
        const testData = [
            {
                data: null,
                offset: 0,
                length: 0,
                expected: false
            },
            {
                data: Buffer.from([]),
                offset: 0,
                length: 0,
                expected: true
            },
            {
                data: Buffer.from([]),
                offset: 1,
                length: 0,
                expected: false
            },
            {
                data: Buffer.from([]),
                offset: 0,
                length: 1,
                expected: false
            },
            {
                data: Buffer.alloc(1),
                offset: 0,
                length: 1,
                expected: true
            },
            {
                data: Buffer.alloc(1),
                offset: -1,
                length: 0,
                expected: false
            },
            {
                data: Buffer.alloc(1),
                offset: 1,
                length: 1,
                expected: false
            },
            {
                data: Buffer.alloc(2),
                offset: 1,
                length: 1,
                expected: true
            },
            {
                data: Buffer.alloc(2),
                offset: 0,
                length: 2,
                expected: true
            },
            {
                data: Buffer.alloc(3),
                offset: 2,
                length: 2,
                expected: false
            }
        ]
        testData.forEach(({data, offset, length, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = ByteUtils.isValidByteBufferSlice(data, offset, length);
                assert.equal(actual, expected);
            })
        })
    })
    describe("#stringToBytes", function() {
        it("should pass", function() {
            let actual = ByteUtils.stringToBytes("")
            assert.equalBytes(actual, Buffer.alloc(0))

            actual = ByteUtils.stringToBytes("abc")
            assert.equalBytes(actual, Buffer.from([97, 98, 99]))

            actual = ByteUtils.stringToBytes("Foo \u00a9 bar \ud834\udf06 baz \u2603 qux")
            assert.equalBytes(actual,Buffer.from([
                0x46, 0x6f, 0x6f, 0x20, 0xc2, 0xa9, 0x20, 0x62, 0x61, 0x72, 0x20,
                0xf0, 0x9d, 0x8c, 0x86, 0x20, 0x62, 0x61, 0x7a, 0x20, 0xe2, 0x98, 0x83,
                0x20, 0x71, 0x75, 0x78]))
        })
    })
    describe("#bytesToString", function() {
        it("should pass", function() {
            let data = Buffer.from([])
            let offset = 0
            let length = 0
            let expected = ""
            let actual = ByteUtils.bytesToString(data, offset, length)
            assert.equal(actual, expected)
            actual = ByteUtils.bytesToString(data)
            assert.equal(actual, expected)

            data = Buffer.from([97, 98, 99])
            offset = 0
            length = data.length
            expected = "abc"
            actual = ByteUtils.bytesToString(data, offset, length)
            assert.equal(actual, expected)
            actual = ByteUtils.bytesToString(data)
            assert.equal(actual, expected)

            data = Buffer.from([0x46, 0x6f, 0x6f, 0x20, 0xc2, 0xa9, 0x20, 0x62, 0x61, 0x72, 0x20,
                0xf0, 0x9d, 0x8c, 0x86, 0x20, 0x62, 0x61, 0x7a, 0x20, 0xe2, 0x98, 0x83,
                0x20, 0x71, 0x75, 0x78])
            offset = 1
            length = data.length - 2
            expected = "oo \u00a9 bar \ud834\udf06 baz \u2603 qu"
            actual = ByteUtils.bytesToString(data, offset, length)
            assert.equal(actual, expected)
        })
    })

    describe("#serializeUpToInt32BigEndian", function() {
        const testData = [
            {
                v: 12,
                data: Buffer.alloc(1),
                offset: 0,
                length: 1,
                expected: Buffer.from([12])
            },
            {
                v: 12,
                data: Buffer.from([8, 2]),
                offset: 0,
                length: 2,
                expected: Buffer.from([0, 12])
            },
            {
                v: 2001,
                data: Buffer.from([8, 2, 3, 4]),
                offset: 1,
                length: 2,
                expected: Buffer.from([8, 7, 0xd1, 4])
            },
            {
                v: 2001,
                data: Buffer.from([8, 2, 3, 4]),
                offset: 0,
                length: 3,
                expected: Buffer.from([0, 7, 0xd1, 4])
            },
            {
                v: 2001,
                data: Buffer.from([8, 2, 3, 4]),
                offset: 0,
                length: 4,
                expected: Buffer.from([0, 0, 7, 0xd1])
            },
            {
                v: -10_999,
                data: Buffer.alloc(2),
                offset: 0,
                length: 2,
                expected: Buffer.from([0xd5, 9])
            },
            {
                v: -10_999,
                data: Buffer.alloc(3),
                offset: 0,
                length: 3,
                expected: Buffer.from([0xff, 0xd5, 9])
            },
            {
                v: -10_999,
                data: Buffer.alloc(4),
                offset: 0,
                length: 4,
                expected: Buffer.from([0xff, 0xff, 0xd5, 9])
            },
            {
                v: 35536,
                data: Buffer.from([8, 2]),
                offset: 0,
                length: 2,
                expected: Buffer.from([138, 208])
            },
            {
                v: 65535,
                data: Buffer.from([0, 1, 2]),
                offset: 0,
                length: 2,
                expected: Buffer.from([255, 255, 2])
            },
            {
                v: 1_000_000,
                data: Buffer.from([10, 20, 30, 40]),
                offset: 1,
                length: 3,
                expected: Buffer.from([10, 0xf, 0x42, 0x40])
            },
            {
                v: -1_000_000,
                data: Buffer.alloc(3),
                offset: 0,
                length: 3,
                expected: Buffer.from([0xf0, 0xbd, 0xc0])
            },
            {
                v: 1_000_000,
                data: Buffer.alloc(4),
                offset: 0,
                length: 4,
                expected: Buffer.from([0, 0xf, 0x42, 0x40])
            },
            {
                v: 1_000_000_000,
                data: Buffer.from([10, 20, 30, 40, 50]),
                offset: 0,
                length: 4,
                expected: Buffer.from([0x3b, 0x9a, 0xca, 0, 50])
            },
            {
                v: -1_000_000_000,
                data: Buffer.alloc(4),
                offset: 0,
                length: 4,
                expected: Buffer.from([0xc4, 0x65, 0x36, 0])
            }
        ]
        testData.forEach(({v, data, offset, length, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                ByteUtils.serializeUpToInt32BigEndian(v,
                    data, offset, length)
                assert.equalBytes(data, expected)
            })
        })

        it("should fail (1)", function() {
            assert.throws(() => {
                ByteUtils.serializeUpToInt32BigEndian(1,
                    Buffer.alloc(2), -1, 0)
            })
        })

        it("should fail (2)", function() {
            assert.throws(() => {
                ByteUtils.serializeUpToInt32BigEndian(1,
                    Buffer.alloc(2), 0, -1)
            })
        })

        it("should fail (3)", function() {
            assert.throws(() => {
                ByteUtils.serializeUpToInt32BigEndian(1,
                    Buffer.alloc(20), 0, 10)
            })
        })
    })

    describe("#deserializeUpToInt32BigEndian", function() {
        const testData = [
            {
                rawBytes: Buffer.from([138, 208]),
                offset: 0,
                length: 2,
                signed: false,
                expected: 35536
            },
            {
                rawBytes: Buffer.from([255, 255, 2]),
                offset: 0,
                length: 2,
                signed: false,
                expected: 65535
            },
            {
                rawBytes: Buffer.from([255, 255, 2]),
                offset: 0,
                length: 2,
                signed: true,
                expected: -1
            },
            {
                rawBytes: Buffer.from([12]),
                offset: 0,
                length: 1,
                signed: true,
                expected: 12
            },
            {
                rawBytes: Buffer.from([12, 0]),
                offset: 0,
                length: 1,
                signed: false,
                expected: 12
            },
            {
                rawBytes: Buffer.from([0, 12]),
                offset: 0,
                length: 2,
                signed: true,
                expected: 12
            },
            {
                rawBytes: Buffer.from([8, 7, 0xd1, 4]),
                offset: 1,
                length: 2,
                signed: true,
                expected: 2001
            },
            {
                rawBytes: Buffer.from([0, 7, 0xd1, 4]),
                offset: 0,
                length: 3,
                signed: false,
                expected: 2001
            },
            {
                rawBytes: Buffer.from([0, 0, 7, 0xd1]),
                offset: 0,
                length: 4,
                signed: true,
                expected: 2001
            },
            {
                rawBytes: Buffer.from([0xd5, 9]),
                offset: 0,
                length: 2,
                signed: true,
                expected: -10_999
            },
            {
                rawBytes: Buffer.from([0xff, 0xd5, 9]),
                offset: 0,
                length: 3,
                signed: true,
                expected: -10_999
            },
            {
                rawBytes: Buffer.from([0xff, 0xff, 0xd5, 9]),
                offset: 0,
                length: 4,
                signed: true,
                expected: -10_999
            },
            {
                rawBytes: Buffer.from([10, 0xf, 0x42, 0x40]),
                offset: 1,
                length: 3,
                signed: true,
                expected: 1_000_000
            },
            {
                rawBytes: Buffer.from([0xf0, 0xbd, 0xc0]),
                offset: 0,
                length: 3,
                signed: true,
                expected: -1_000_000
            },
            {
                rawBytes: Buffer.from([0, 0xf, 0x42, 0x40]),
                offset: 0,
                length: 4,
                signed: true,
                expected: 1_000_000
            },
            {
                rawBytes: Buffer.from([0x3b, 0x9a, 0xca, 0, 50]),
                offset: 0,
                length: 4,
                signed: true,
                expected: 1_000_000_000
            },
            {
                rawBytes: Buffer.from([0xc4, 0x65, 0x36, 0]),
                offset: 0,
                length: 4,
                signed: false,
                expected: -1_000_000_000
            }
        ]
        testData.forEach(({rawBytes, offset, length, signed, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = ByteUtils.deserializeUpToInt32BigEndian(rawBytes, offset, length, signed)
                assert.equal(actual, expected)
            })
        })

        it("should fail (1)", function() {
            assert.throws(() => {
                ByteUtils.deserializeUpToInt32BigEndian(
                    Buffer.alloc(2), -1, 0, false)
            })
        })

        it("should fail (2)", function() {
            assert.throws(() => {
                ByteUtils.deserializeUpToInt32BigEndian(
                    Buffer.alloc(2), 0, -1, false)
            })
        })

        it("should fail (3)", function() {
            assert.throws(() => {
                ByteUtils.deserializeUpToInt32BigEndian(
                    Buffer.alloc(20), 0, 10, true)
            })
        })
    })
})