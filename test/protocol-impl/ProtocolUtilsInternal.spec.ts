const { assert } = require("chai").use(require("chai-bytes"))

import * as ProtocolUtilsInternal from "../../src/protocol-impl/ProtocolUtilsInternal"

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
})