import { assert } from "chai"
import * as MiscUtils from "../src/MiscUtils"

describe("MiscUtilsInternal", function() {
    describe("#whenAnyPromiseSettles", function() {
        it("should pass (1)", async function() {
            const p1 = Promise.resolve()
            const actual = await MiscUtils.whenAnyPromiseSettles([p1])
            assert.equal(actual, 0)
        })
        it("should pass (2)", async function() {
            const p1 = Promise.resolve()
            const p2 = Promise.reject()
            const actual = await MiscUtils.whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 0)
        })
        it("should pass (3)", async function() {
            const p1 = Promise.reject()
            const p2 = Promise.reject()
            const actual = await MiscUtils.whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 0)
        })
        it("should pass (4)", async function() {
            const p1 = Promise.resolve()
            const p2 = Promise.resolve()
            const actual = await MiscUtils.whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 0)
        })
        it("should pass (5)", async function() {
            const p1 = new Promise((resolve) => {
                setImmediate(resolve)
            })
            const p2 = Promise.resolve()
            const actual = await MiscUtils.whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 1)
        })
        it("should pass (6)", async function() {
            const p1 = new Promise((resolve) => {
                setImmediate(resolve)
            })
            const p2 = new Promise((resolve) => {
                setImmediate(resolve)
            })
            const p3 = Promise.reject()
            const actual = await MiscUtils.whenAnyPromiseSettles([p1, p2, p3])
            assert.equal(actual, 2)
        })
    })

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
                const actual = MiscUtils.parseInt48(input)
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
                    MiscUtils.parseInt48(input), /invalid 48-bit/)
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
                const actual = MiscUtils.parseInt32(input)
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
                    MiscUtils.parseInt32(input), /invalid 32-bit/)
            })
        })
    })
})