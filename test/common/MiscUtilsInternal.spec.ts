import { assert } from "chai"
import { whenAnyPromiseSettles } from "../../src/common/MiscUtilsInternal"

describe("MiscUtilsInternal", function() {
    describe("#whenAnyPromiseSettles", function() {
        it("should pass (1)", async function() {
            const p1 = Promise.resolve()
            const actual = await whenAnyPromiseSettles([p1])
            assert.equal(actual, 0)
        })
        it("should pass (2)", async function() {
            const p1 = Promise.resolve()
            const p2 = Promise.reject()
            const actual = await whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 0)
        })
        it("should pass (3)", async function() {
            const p1 = Promise.reject()
            const p2 = Promise.reject()
            const actual = await whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 0)
        })
        it("should pass (4)", async function() {
            const p1 = Promise.resolve()
            const p2 = Promise.resolve()
            const actual = await whenAnyPromiseSettles([p1, p2])
            assert.equal(actual, 0)
        })
        it("should pass (5)", async function() {
            const p1 = new Promise((resolve) => {
                setImmediate(resolve)
            })
            const p2 = Promise.resolve()
            const actual = await whenAnyPromiseSettles([p1, p2])
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
            const actual = await whenAnyPromiseSettles([p1, p2, p3])
            assert.equal(actual, 2)
        })
    })
})