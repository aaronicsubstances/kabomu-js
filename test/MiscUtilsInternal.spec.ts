const { assert } = require('chai').use(require('chai-bytes'))
import * as MiscUtilsInternal from "../src/MiscUtilsInternal"

describe("MiscUtilsInternal", function() {
    describe("#parseInt48", function() {
        const testData = [
            {
                input: "0",
                expected: 0
            },
            {
                input: "1",
                expected: 1
            },
            {
                input: "2",
                expected: 2
            },
            {
                input: " 20",
                expected: 20
            },
            {
                input: " 200 ",
                expected: 200
            },
            {
                input: "-1000",
                expected: -1000
            },
            {
                input: "1000000",
                expected: 1_000_000
            },
            {
                input: "-1000000000",
                expected: -1_000_000_000
            },
            {
                input: "4294967295",
                expected: 4_294_967_295
            },
            {
                input: "-50000000000000",
                expected: -50_000_000_000_000
            },
            {
                input: "100000000000000",
                expected: 100_000_000_000_000
            },
            {
                input: "140737488355327",
                expected: 140_737_488_355_327
            },
            {
                input: "-140737488355328",
                expected: -140_737_488_355_328
            },
            // remainder are verifications
            {
                input: 2.0,
                expected: 2.0
            },
            {
                input: 140_737_488_355_327,
                expected: 140_737_488_355_327
            },
            {
                input: -140_737_488_355_328,
                expected: -140_737_488_355_328
            }
        ]
        testData.forEach(({input, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = MiscUtilsInternal.parseInt48(input)
                assert.equal(actual, expected)
            })
        })

        const testErrorData = [
            "", " ", null, "false", "xyz", "1.23", /*"2.0", */
            "140737488355328", "-140737488355329", "72057594037927935",
            [], {}
        ]
        testErrorData.forEach((input, i) => {
            it(`should fail with input ${i}`, function() {
                assert.throws(() =>
                    MiscUtilsInternal.parseInt48(input), /invalid 48-bit/)
            })
        })
    })

    describe("#parseInt32", function() {
        const testData = [
            {
                input: "0",
                expected: 0
            },
            {
                input: "1",
                expected: 1
            },
            {
                input: "2",
                expected: 2
            },
            {
                input: " 20",
                expected: 20
            },
            {
                input: " 200 ",
                expected: 200
            },
            {
                input: "-1000",
                expected: -1000
            },
            {
                input: "1000000",
                expected: 1_000_000
            },
            {
                input: "-1000000000",
                expected: -1_000_000_000
            },
            {
                input: "2147483647",
                expected: 2_147_483_647
            },
            {
                input: "-2147483648",
                expected: -2_147_483_648
            },
            // remainder are verifications
            {
                input: 2.0,
                expected: 2.0
            },
            {
                input:  2_147_483_647,
                expected: 2_147_483_647
            },
            {
                input: -2_147_483_648,
                expected: -2_147_483_648
            }
        ]
        testData.forEach(({input, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = MiscUtilsInternal.parseInt32(input)
                assert.equal(actual, expected)
            })
        })

        const testErrorData = [
            "", " ", null, "false", "xyz", "1.23", /*"2.0", */
            "2147483648", "-2147483649", "50000000000000",
            [], {}
        ]
        testErrorData.forEach((input, i) => {
            it(`should fail with input ${i}`, function() {
                assert.throws(() =>
                    MiscUtilsInternal.parseInt32(input), /invalid 32-bit/)
            })
        })
    })

    describe("#stringToBytes", function() {
        it("it should pass", function() {
            let expected = Buffer.alloc(0);
            let actual = MiscUtilsInternal.stringToBytes("");
            assert.equalBytes(actual, expected);

            actual = MiscUtilsInternal.stringToBytes("abc")
            assert.equalBytes(actual,
                Buffer.from("abc"));

            // NB: text between bar and baz is
            // supplementary character 0001d306
            actual = MiscUtilsInternal.stringToBytes(
                "Foo \u00a9 bar \ud834\udf06 baz \u2603 qux")
            assert.equalBytes(actual, Buffer.from([
                0x46, 0x6f, 0x6f, 0x20, 0xc2, 0xa9, 0x20,
                0x62, 0x61, 0x72, 0x20,
                0xf0, 0x9d, 0x8c, 0x86, 0x20, 0x62, 0x61,
                0x7a, 0x20, 0xe2, 0x98, 0x83,
                0x20, 0x71, 0x75, 0x78
            ]))
        })

        describe("#bytesToString", function() {
            it("it should pass", function() {
                let expected = "";
                let actual = MiscUtilsInternal.bytesToString(
                    Buffer.alloc(0));
                assert.equal(actual, expected);
    
                expected = "abc"
                actual = MiscUtilsInternal.bytesToString(
                    Buffer.from("abc"))
                assert.equal(actual, expected);
    
                // NB: text between bar and baz is
                // supplementary character 0001d306
                expected = "Foo \u00a9 bar \ud834\udf06 baz \u2603 qux";
                actual = MiscUtilsInternal.bytesToString(Buffer.from([
                    0x46, 0x6f, 0x6f, 0x20, 0xc2, 0xa9, 0x20,
                    0x62, 0x61, 0x72, 0x20,
                    0xf0, 0x9d, 0x8c, 0x86, 0x20, 0x62, 0x61,
                    0x7a, 0x20, 0xe2, 0x98, 0x83,
                    0x20, 0x71, 0x75, 0x78
                ]));
                assert.equal(actual, expected);
            })
        })

        describe("#getByteCount", function() {
            it("it should pass", function() {
                let expected = 0;
                let actual = MiscUtilsInternal.getByteCount(
                    "");
                assert.equal(actual, expected);
    
                expected = 3
                actual = MiscUtilsInternal.getByteCount(
                    "abc")
                assert.equal(actual, expected);
    
                // NB: text between bar and baz is
                // supplementary character 0001d306
                expected = 27;
                actual = MiscUtilsInternal.getByteCount(
                    "Foo \u00a9 bar \ud834\udf06 baz \u2603 qux");
                assert.equal(actual, expected);
            })
        })
    })
})