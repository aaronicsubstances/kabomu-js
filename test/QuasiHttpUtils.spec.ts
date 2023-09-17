import nativeAssert from "assert/strict"
import { assert } from "chai"
import * as QuasiHttpUtils from "../src/QuasiHttpUtils"
import { QuasiHttpProcessingOptions } from "../src/types"

describe("QuasiHttpUtils", function() {
    describe("testConstantValues", function() {
        it("should pass", function() {
            assert.equal(QuasiHttpUtils.METHOD_CONNECT, "CONNECT");
            assert.equal(QuasiHttpUtils.METHOD_DELETE, "DELETE");
            assert.equal(QuasiHttpUtils.METHOD_GET, "GET");
            assert.equal(QuasiHttpUtils.METHOD_HEAD, "HEAD");
            assert.equal(QuasiHttpUtils.METHOD_OPTIONS, "OPTIONS");
            assert.equal(QuasiHttpUtils.METHOD_PATCH, "PATCH");
            assert.equal(QuasiHttpUtils.METHOD_POST, "POST");
            assert.equal(QuasiHttpUtils.METHOD_PUT, "PUT");
            assert.equal(QuasiHttpUtils.METHOD_TRACE, "TRACE");

            assert.equal(QuasiHttpUtils.STATUS_CODE_OK, 200);
            assert.equal(QuasiHttpUtils.STATUS_CODE_SERVER_ERROR, 500);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_BAD_REQUEST, 400);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_UNAUTHORIZED, 401);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_FORBIDDEN, 403);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_NOT_FOUND, 404);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_METHOD_NOT_ALLOWED, 405);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_PAYLOAD_TOO_LARGE, 413);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_URI_TOO_LONG, 414);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_UNSUPPORTED_MEDIA_TYPE, 415);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_UNPROCESSABLE_ENTITY, 422);
            assert.equal(QuasiHttpUtils.STATUS_CODE_CLIENT_ERROR_TOO_MANY_REQUESTS, 429);
        })
    })

    describe("#mergeProcessingOptions", function() {
        it("should pass (1)", function() {
            const preferred = undefined;
            const fallback = undefined;
            const actual = QuasiHttpUtils.mergeProcessingOptions(
                preferred, fallback);
            assert.isNotOk(actual);
        });
        it("should pass (2)", function() {
            const preferred: QuasiHttpProcessingOptions = {
                extraConnectivityParams: new Map([
                    ["scheme", "tht"]
                ]),
                maxHeadersSize: 10,
                responseBufferingEnabled: false,
                responseBodyBufferingSizeLimit: -1,
                timeoutMillis: 0
            };
            const fallback: QuasiHttpProcessingOptions = {
                extraConnectivityParams: new Map<string, any>([
                    ["scheme", "htt"],
                    ["two", 2]
                ]),
                maxHeadersSize: 30,
                responseBufferingEnabled: true,
                responseBodyBufferingSizeLimit: 40,
                timeoutMillis: -1
            };
            const actual = QuasiHttpUtils.mergeProcessingOptions(
                preferred, fallback);
            const expected: QuasiHttpProcessingOptions = {
                extraConnectivityParams: new Map<string, any>([
                    ["scheme", "tht"],
                    ["two", 2]
                ]),
                maxHeadersSize: 10,
                responseBufferingEnabled: false,
                responseBodyBufferingSizeLimit: 40,
                timeoutMillis: -1
            };
            assert.deepEqual(actual, expected);
        });
    })

    describe("#_determineEffectiveNonZeroIntegerOption", function() {
        const testData = [
            {
                preferred: 1,
                fallback1: null,
                defaultValue: 20,
                expected: 1
            },
            {
                preferred: 5,
                fallback1: 3,
                defaultValue: 11,
                expected: 5
            },
            {
                preferred: -15,
                fallback1: 3,
                defaultValue: -1,
                expected: -15
            },
            {
                preferred: null,
                fallback1: 3,
                defaultValue: -1,
                expected: 3
            },
            {
                preferred: null,
                fallback1: null,
                defaultValue: 2,
                expected: 2
            },
            {
                preferred: null,
                fallback1: null,
                defaultValue: -8,
                expected: -8
            },
            {
                preferred: null,
                fallback1: null,
                defaultValue: 0,
                expected: 0
            },
            // remainder is to test parseInt32
            {
                preferred: "89",
                fallback1: "67",
                defaultValue: 10,
                expected: 89
            },
            {
                preferred: null,
                fallback1: "67",
                defaultValue: 0,
                expected: 67
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: "-7",
                expected: -7
            }
        ]
        testData.forEach(({preferred, fallback1, defaultValue, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = QuasiHttpUtils._determineEffectiveNonZeroIntegerOption(
                    preferred as any, fallback1 as any, defaultValue as any)
                assert.equal(actual, expected)
            })
        })

        const testErrorData = [
            {
                preferred: [],
                fallback1: "67",
                defaultValue: 10
            },
            {
                preferred: undefined,
                fallback1: [],
                defaultValue: 10
            },
            {
                preferred: null,
                fallback1: "6.7",
                defaultValue: 0
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: 912_144_545_452
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: null
            }
        ]
        testErrorData.forEach(({preferred, fallback1, defaultValue}, i) => {
            it(`should fail with input ${i}`, function() {
                assert.throw(() => 
                    QuasiHttpUtils._determineEffectiveNonZeroIntegerOption(
                        preferred as any, fallback1 as any, defaultValue as any))
            })
        })
    })

    describe("#_determineEffectivePositiveIntegerOption", function() {
        const testData = [
            {
                preferred: null,
                fallback1: 1,
                defaultValue: 30,
                expected: 1
            },
            {
                preferred: 5,
                fallback1: 3,
                defaultValue: 11,
                expected: 5
            },
            {
                preferred: null,
                fallback1: 3,
                defaultValue: -1,
                expected: 3
            },
            {
                preferred: null,
                fallback1: null,
                defaultValue: 2,
                expected: 2
            },
            {
                preferred: null,
                fallback1: null,
                defaultValue: -8,
                expected: -8
            },
            {
                preferred: null,
                fallback1: null,
                defaultValue: 0,
                expected: 0
            },
            // remainder is to test parseInt32
            {
                preferred: "89",
                fallback1: "67",
                defaultValue: 10,
                expected: 89
            },
            {
                preferred: -90,
                fallback1: "67",
                defaultValue: 0,
                expected: 67
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: "-7",
                expected: -7
            }
        ]
        testData.forEach(({preferred, fallback1, defaultValue, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = QuasiHttpUtils._determineEffectivePositiveIntegerOption(
                    preferred as any, fallback1 as any, defaultValue as any)
                assert.equal(actual, expected)
            })
        })

        const testErrorData = [
            {
                preferred: [],
                fallback1: "67",
                defaultValue: 10
            },
            {
                preferred: -8,
                fallback1: [],
                defaultValue: 10
            },
            {
                preferred: null,
                fallback1: "6.7",
                defaultValue: 0
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: 912_144_545_452
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: null
            }
        ]
        testErrorData.forEach(({preferred, fallback1, defaultValue}, i) => {
            it(`should fail with input ${i}`, function() {
                assert.throw(() => 
                    QuasiHttpUtils._determineEffectivePositiveIntegerOption(
                        preferred as any, fallback1 as any, defaultValue as any))
            })
        })
    })

    describe("#_determineEffectiveOptions", function() {
        const testData = [
            {
                preferred: null as any,
                fallback: undefined,
                expected: new Map()
            },
            {
                preferred: new Map(),
                fallback: new Map(),
                expected: new Map()
            },
            {
                preferred: new Map([["a", 2], ["b", 3]]),
                fallback: null as any,
                expected: new Map([["a", 2], ["b", 3]]),
            },
            {
                preferred: undefined,
                fallback: new Map([["a", 2], ["b", 3]]),
                expected: new Map([["a", 2], ["b", 3]]),
            },
            {
                preferred: new Map([["a", 2], ["b", 3]]),
                fallback: new Map([["c", 4], ["d", 3]]),
                expected: new Map([["a", 2], ["b", 3],
                    ["c", 4], ["d", 3]]),
            },
            {
                preferred: new Map([["a", 2], ["b", 3]]),
                fallback: new Map([["a", 4], ["d", 3]]),
                expected: new Map([["a", 2], ["b", 3],
                    ["d", 3]]),
            },
            {
                preferred: new Map([["a", 2]]),
                fallback: new Map([["a", 4], ["d", 3]]),
                expected: new Map([["a", 2], ["d", 3]]),
            }
        ]
        testData.forEach(({preferred, fallback, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = QuasiHttpUtils._determineEffectiveOptions(preferred,
                    fallback)
                assert.deepEqual(actual, expected)
            })
        })
    })

    describe("#_determineEffectiveBooleanOption", function() {
        const testData = [
            {
                preferred: 1,
                fallback1: null,
                defaultValue: true,
                expected: true
            },
            {
                preferred: 0,
                fallback1: true,
                defaultValue: true,
                expected: false
            },
            {
                preferred: null,
                fallback1: false,
                defaultValue: true,
                expected: false
            },
            {
                preferred: null,
                fallback1: true,
                defaultValue: false,
                expected: true
            },
            {
                preferred: null,
                fallback1: true,
                defaultValue: true,
                expected: true
            },
            {
                preferred: null,
                fallback1: undefined,
                defaultValue: true,
                expected: true
            },
            {
                preferred: undefined,
                fallback1: null,
                defaultValue: undefined,
                expected: false
            },
            {
                preferred: true,
                fallback1: true,
                defaultValue: false,
                expected: true
            },
            {
                preferred: true,
                fallback1: true,
                defaultValue: true,
                expected: true
            },
            {
                preferred: false,
                fallback1: false,
                defaultValue: false,
                expected: false
            }
        ]
        testData.forEach(({preferred, fallback1, defaultValue, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = QuasiHttpUtils._determineEffectiveBooleanOption(
                    preferred as any, fallback1 as any, defaultValue as any)
                assert.equal(actual, expected)
            })
        })
    })

    describe("#createCancellableTimeoutPromise", function() {
        it("should pass (1)", function() {
            const actual = QuasiHttpUtils.createCancellableTimeoutPromise(
                0)
            assert.isNotOk(actual)
        })
        it("should pass (2)", function() {
            const actual = QuasiHttpUtils.createCancellableTimeoutPromise(
                -3)
            assert.isNotOk(actual)
        })
        it("should pass (3)", async function() {
            let p = QuasiHttpUtils.createCancellableTimeoutPromise(
                50);
            assert.isOk(p)
            p = p!;
            let result = await p.promise
            assert.isOk(result);
            p.cancel();
            result = await p.promise
            assert.isOk(result);
        })
        it("should pass (4)", async function() {
            let p = QuasiHttpUtils.createCancellableTimeoutPromise(
                500)
            assert.isOk(p)
            await QuasiHttpUtils.createDelayPromise(100);
            p = p!;
            p.cancel()
            let result = await p.promise
            assert.isNotOk(result)
            p.cancel()
            result = await p.promise
            assert.isNotOk(result)
        })
    })
})