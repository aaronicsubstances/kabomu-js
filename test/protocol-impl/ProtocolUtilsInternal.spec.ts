import nativeAssert from "assert/strict"
const { assert } = require("chai").use(require("chai-bytes"))

import * as ProtocolUtilsInternal from "../../src/protocol-impl/ProtocolUtilsInternal"
import { KabomuIOError, QuasiHttpError } from "../../src/errors"

describe("ProtocolUtilsInternal", function() {
    describe("#getEnvVarAsBoolean", function() {
        const testData = [
            {
                environment: new Map<string, any>([["d", "de"], ["2", false]]),
                key: "2",
                expected: false
            },
            {
                environment: undefined,
                key: "k1",
                expected: undefined
            },
            {
                environment: new Map<string, any>([["d2", "TRUE"], ["e", "ghana"]]),
                key: "f",
                expected: undefined
            },
            {
                environment: new Map<string, any>([["ty2", "TRUE"], ["c", {}]]),
                key: "ty2",
                expected: true
            },
            {
                environment: new Map<string, any>([["d2", true], ["e", "ghana"]]),
                key: "d2",
                expected: true
            },
            {
                environment: new Map<string, any>([["d", "TRue"], ["e", "ghana"]]),
                key: "d",
                expected: true
            },
            {
                environment: new Map<string, any>([["d", "FALSE"], ["e", "ghana"]]),
                key: "d",
                expected: true
            },
            {
                environment: new Map<string, any>([["d", "45"], ["e", "ghana"], ["ert", "False"]]),
                key: "ert",
                expected: true
            },
            {
                environment: new Map<string, any>([["d", "de"], ["2", false]]),
                key: "d",
                expected: true
            },
            {
                environment: new Map<string, any>([["c", ""]]),
                key: "c",
                expected: false
            },
            {
                environment: new Map<string, any>([["d2", "TRUE"], ["e", []]]),
                key: "e",
                expected: true
            },
            {
                environment: new Map<string, any>([["k1", 1]]),
                key: "k1",
                expected: true
            },
            {
                environment: new Map<string, any>([["k1", 0]]),
                key: "k1",
                expected: false
            }
        ]
        testData.forEach(({environment, key, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = ProtocolUtilsInternal.getEnvVarAsBoolean(
                    environment, key)
                assert.equal(actual, expected)
            })
        })
    })

    describe("#wrapTimeoutPromise", function() {
        it("should pass (1)", async function() {
            await ProtocolUtilsInternal.wrapTimeoutPromise(
                undefined, "")
        })
        it("should pass (2)", async function() {
            await ProtocolUtilsInternal.wrapTimeoutPromise(
                Promise.resolve(false), "")
        })
        it("should pass (3)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.resolve(true), "te")
            }, (e: any) => {
                assert.instanceOf(e, QuasiHttpError)
                assert.equal(e.message, "te")
                assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_TIMEOUT)
                return true;
            })
        })
        it("should pass (4)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.resolve({} as any), "recv")
            }, (e: any) => {
                assert.instanceOf(e, QuasiHttpError)
                assert.equal(e.message, "recv")
                assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_TIMEOUT)
                return true;
            })
        })
        it("should pass (5)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.reject(new Error("th")), "te")
            }, (e: any) => {
                assert.instanceOf(e, Error)
                assert.equal(e.message, "th")
                return true;
            })
        })
        it("should pass (6)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.reject(new KabomuIOError("2gh")), "te")
            }, (e: any) => {
                assert.instanceOf(e, KabomuIOError)
                assert.equal(e.message, "2gh")
                return true;
            })
        })
    })
})