import nativeAssert from "assert/strict";
const { expect, assert } = require("chai").use(require("chai-bytes"))

import * as ProtocolUtilsInternal from "../../src/quasihttp/ProtocolUtilsInternal"
import { QuasiHttpRequestProcessingError } from "../../src/quasihttp/errors"
import { ByteBufferBody } from "../../src/quasihttp/entitybody/ByteBufferBody"
import { StringBody } from "../../src/quasihttp/entitybody/StringBody"
import * as ComparisonUtils from "../shared/common/ComparisonUtils"
import { IQuasiHttpBody } from "../../src/quasihttp/types"
import * as ByteUtils from "../../src/common/ByteUtils"
import * as IOUtils from "../../src/common/IOUtils"
import { Readable, Writable } from "stream";
import { LambdaBasedQuasiHttpBody } from "../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody";
import { getBodyReader } from "../../src/quasihttp/entitybody/EntityBodyUtils";
import { createDelayPromise } from "../../src/common/MiscUtils";

describe("ProtocolUtilsInternal", function() {
    describe("#determineEffectiveNonZeroIntegerOption", function() {
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
                const actual = ProtocolUtilsInternal.determineEffectiveNonZeroIntegerOption(
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
                    ProtocolUtilsInternal.determineEffectiveNonZeroIntegerOption(
                        preferred as any, fallback1 as any, defaultValue as any))
            })
        })
    })

    describe("#determineEffectivePositiveIntegerOption", function() {
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
                const actual = ProtocolUtilsInternal.determineEffectivePositiveIntegerOption(
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
                    ProtocolUtilsInternal.determineEffectivePositiveIntegerOption(
                        preferred as any, fallback1 as any, defaultValue as any))
            })
        })
    })

    describe("#determineEffectiveOptions", function() {
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
                const actual = ProtocolUtilsInternal.determineEffectiveOptions(preferred,
                    fallback)
                assert.deepEqual(actual, expected)
            })
        })
    })

    describe("#determineEffectiveBooleanOption", function() {
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
                const actual = ProtocolUtilsInternal.determineEffectiveBooleanOption(
                    preferred as any, fallback1 as any, defaultValue as any)
                assert.equal(actual, expected)
            })
        })
    })

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

    describe("#createEquivalentOfUnknownBodyInMemory", function() {
        const testDataGenerator = function*() {
            let bufferingLimit = 0
            let expectedBodyBytes = Buffer.alloc(0)
            let body: IQuasiHttpBody = new ByteBufferBody(expectedBodyBytes)
            yield {
                bufferingLimit,
                body,
                expectedBodyBytes
            }

            bufferingLimit = 0
            expectedBodyBytes = Buffer.alloc(0)
            body = new StringBody("")
            yield {
                bufferingLimit,
                body,
                expectedBodyBytes
            }

            expectedBodyBytes = ByteUtils.stringToBytes("abcdef")
            bufferingLimit = expectedBodyBytes.length
            body = new StringBody("abcdef")
            body.contentLength = -10
            yield {
                bufferingLimit,
                body,
                expectedBodyBytes
            }

            expectedBodyBytes = ByteUtils.stringToBytes("abcde")
            bufferingLimit = expectedBodyBytes.length
            body = new StringBody("abcde")
            yield {
                bufferingLimit,
                body,
                expectedBodyBytes
            }

            bufferingLimit = 8
            expectedBodyBytes = ByteUtils.stringToBytes("abcd")
            body = new ByteBufferBody(expectedBodyBytes)
            body.contentLength = -1
            yield {
                bufferingLimit,
                body,
                expectedBodyBytes
            }

            // test that wrong content length works fine
            bufferingLimit = 30
            body = new StringBody("xyz!")
            body.contentLength = 5
            expectedBodyBytes = ByteUtils.stringToBytes("xyz!")
            yield {
                bufferingLimit,
                body,
                expectedBodyBytes
            }
        }
        let i = 0
        for (const testDataItem of testDataGenerator()) {
            i++
            it (`should pass with input ${i}`, async function() {
                // arrange
                const {
                    bufferingLimit,
                    body,
                    expectedBodyBytes
                } = testDataItem
                const expected = new ByteBufferBody(expectedBodyBytes)
                expected.contentLength = body.contentLength

                // act.
                const actual = await ProtocolUtilsInternal.createEquivalentOfUnknownBodyInMemory(body,
                    bufferingLimit)

                // assert.
                await ComparisonUtils.compareBodiesInvolvingUnknownSources(
                    actual, expected, expectedBodyBytes)
            })
        }

        it("should fail (1)", async function() {
            const bufferingLimit = 3
            const responseBody = new ByteBufferBody(
                ByteUtils.stringToBytes("xyz!"))
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.createEquivalentOfUnknownBodyInMemory(
                    responseBody, bufferingLimit)
            }, (err: any) => {
                expect(err.message).to.contain(`limit of ${bufferingLimit}`)
                return true
            })
        })

        it("should fail (2)", async function() {
            // test that content length is not respected, and so
            // over abundance of data leads to error
            const bufferingLimit = 4
            const responseBody = new ByteBufferBody(
                ByteUtils.stringToBytes("abcdef"))
            responseBody.contentLength = 3
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.createEquivalentOfUnknownBodyInMemory(
                    responseBody, bufferingLimit)
            }, (err: any) => {
                expect(err.message).to.contain(`limit of ${bufferingLimit}`)
                return true
            })
        })
    })

    describe("#transferBodyToTransport", function() {
        it("should pass (1)", async function() {
            const maxChunkSize = 6
            const srcData = "data bits and bytes"
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            })
            const expected = Buffer.concat([
                Buffer.from([0, 0, 8, 1, 0]),
                ByteUtils.stringToBytes("data b"),
                Buffer.from([0, 0, 8, 1, 0]),
                ByteUtils.stringToBytes("its an"),
                Buffer.from([0, 0, 8, 1, 0]),
                ByteUtils.stringToBytes("d byte"),
                Buffer.from([0, 0, 3, 1, 0]),
                ByteUtils.stringToBytes("s"),
                Buffer.from([0, 0, 2, 1, 0])
            ])
            const body = new StringBody(srcData)
            await ProtocolUtilsInternal.transferBodyToTransport(
                writer, maxChunkSize, body, -1)

            assert.equalBytes(Buffer.concat(chunks), expected)
        })
        it("should pass (2)", async function() {
            const maxChunkSize = 14
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            })
            const expected = "camouflage"
            const body = new StringBody(expected)
            await ProtocolUtilsInternal.transferBodyToTransport(
                writer, maxChunkSize, body, body.contentLength)

            const actual = ByteUtils.bytesToString(
                Buffer.concat(chunks))
            assert.equal(actual, expected)
        })

        // Assert that zero content length causes body not to 
        // be processed,
        // and check that release is not called on body.
        it("should pass (3)", async function() {
            const maxChunkSize = 6
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    chunks.push(chunk)
                    cb()
                },
            })
            const srcData = "ice"
            const reader = Readable.from(
                ByteUtils.stringToBytes(srcData))

            const body = new LambdaBasedQuasiHttpBody()
            let endOfReadError: any;
            body.releaseFunc = async () => {
                endOfReadError = new Error("released")
            }
            body.readerFunc = () => {
                if (endOfReadError) {
                    throw endOfReadError
                }
                return reader;
            }
            await ProtocolUtilsInternal.transferBodyToTransport(
                writer, maxChunkSize, body, 0)

            assert.equalBytes(Buffer.concat(chunks), Buffer.alloc(0))

            // check that release is not called on body during transfer.
            const actual = await IOUtils.readAllBytes(getBodyReader(body))
            assert.equal(ByteUtils.bytesToString(actual),
                srcData)
        })

        // Assert that positive content length is not enforced
        it("should pass (4)", async function() {
            const maxChunkSize = -1
            const chunks = new Array<Buffer>()
            const writer = new Writable({
                write(chunk, encoding, callback) {
                    chunks.push(chunk)
                    callback()
                },
            })
            const expected = "frutis and pils"
            const reader = Readable.from(
                ByteUtils.stringToBytes(expected))
            const body = new LambdaBasedQuasiHttpBody(
                () => reader)
            await ProtocolUtilsInternal.transferBodyToTransport(
                writer, maxChunkSize, body, 456)

            const actual = ByteUtils.bytesToString(
                Buffer.concat(chunks))
            assert.equal(actual, expected)
        })

        // Assert that no error occurs with null body due to
        // falsy content length.
        it("should pass (5)", async function() {
            const maxChunkSize = 8
            const writer = new Writable({
                write(chunk, encoding, cb) {
                    cb(new Error("should not be called"))
                }
            })

            await ProtocolUtilsInternal.transferBodyToTransport(
                writer, maxChunkSize, null as any, "" as any)
        })
    })

    describe("#createBodyFromTransport", function() {
        it("should pass (1)", async function() {
            // arrange
            const srcData = "ice"
            const expectedData = ByteUtils.stringToBytes(srcData)
            const reader = Readable.from(expectedData)
            const contentLength = srcData.length
            const releaseFunc = undefined
            const maxChunkSize = 6
            const bufferingEnabled = false
            const bodyBufferingSizeLimit = 2
            const expected = new ByteBufferBody(expectedData)

            // act
            const actual = await ProtocolUtilsInternal.createBodyFromTransport(
                reader, contentLength, releaseFunc, maxChunkSize,
                bufferingEnabled, bodyBufferingSizeLimit)

            // assert
            await ComparisonUtils.compareBodies(actual, expected,
                expectedData)

            // assert no errors on release
            await actual!.release()
        })

        it("should pass (2)", async function() {
            // arrange
            const srcData = "ice"
            const expectedData = ByteUtils.stringToBytes(srcData)
            const srcStream = Readable.from(expectedData)
            const reader = Readable.from((async function*() {
                for await (const chunk of srcStream) {
                    yield chunk
                }
            })())
            const contentLength = srcData.length
            let releaseCallCount = 0
            const releaseFunc = async () => {
                releaseCallCount++
            }
            const maxChunkSize = 15
            const bufferingEnabled = true
            const bodyBufferingSizeLimit = 4
            const expected = new ByteBufferBody(expectedData)

            // act
            const actual = await ProtocolUtilsInternal.createBodyFromTransport(
                reader, contentLength, releaseFunc, maxChunkSize,
                bufferingEnabled, bodyBufferingSizeLimit)

            // assert
            await ComparisonUtils.compareBodies(actual, expected,
                expectedData)

            // assert that transport wasn't released due to buffering.
            await actual!.release()
            assert.equal(releaseCallCount, 0)
        })

        it("should pass (3)", async function() {
            // arrange
            const srcData = Buffer.concat([
                Buffer.from([0, 0, 11, 1, 0]),
                ByteUtils.stringToBytes("data bits"),
                Buffer.from([0, 0, 11, 1, 0]),
                ByteUtils.stringToBytes(" and byte"),
                Buffer.from([0, 0, 2, 1, 0])
            ])
            const expectedData = ByteUtils.stringToBytes("data bits and byte")
            const srcStream = Readable.from(srcData)
            const reader = Readable.from((async function*() {
                for await (const chunk of srcStream) {
                    yield chunk
                }
            })())
            const contentLength = -1
            const releaseFunc = undefined
            const maxChunkSize = 2  // should have no effect since it is
                                    // less than hard limit
            const bufferingEnabled = true 
            const bodyBufferingSizeLimit = 30
            const expected = new ByteBufferBody(expectedData)
            expected.contentLength = -1

            // act
            const actual = await ProtocolUtilsInternal.createBodyFromTransport(
                reader, contentLength, releaseFunc, maxChunkSize,
                bufferingEnabled, bodyBufferingSizeLimit)

            // assert
            await ComparisonUtils.compareBodies(actual, expected,
                expectedData)

            // assert no errors on release
            await actual!.release()
        })

        it("should pass (4)", async function() {
            // arrange
            const srcData = Buffer.concat([
                Buffer.from([0, 0, 16, 1, 0]),
                ByteUtils.stringToBytes("bits and bytes"),
                Buffer.from([0, 0, 2, 1, 0])
            ])
            const expectedData = ByteUtils.stringToBytes("bits and bytes")
            const reader = Readable.from(srcData)
            const contentLength = -2
            let releaseCallCount = 0
            const releaseFunc = async () => {
                releaseCallCount++
            }
            const maxChunkSize = 50
            const bufferingEnabled = false 
            const bodyBufferingSizeLimit = 3
            const expected = new ByteBufferBody(expectedData)
            expected.contentLength = -2

            // act
            const actual = await ProtocolUtilsInternal.createBodyFromTransport(
                reader, contentLength, releaseFunc, maxChunkSize,
                bufferingEnabled, bodyBufferingSizeLimit)

            // assert
            await ComparisonUtils.compareBodies(actual, expected,
                expectedData)

            // assert that transport was released.
            await actual!.release()
            assert.equal(releaseCallCount, 1)
        })

        // Test that zero content length returns null.
        it("should pass (5)", async function() {
            // arrange
            const srcData = ""
            const expectedData = ByteUtils.stringToBytes(srcData)
            const reader = Readable.from(expectedData)
            const contentLength = "" as any
            const releaseFunc = undefined
            const maxChunkSize = 0
            const bufferingEnabled = false
            const bodyBufferingSizeLimit = 0

            // act
            const actual = await ProtocolUtilsInternal.createBodyFromTransport(
                reader, contentLength, releaseFunc, maxChunkSize,
                bufferingEnabled, bodyBufferingSizeLimit)

            // assert
            assert.isNotOk(actual)
        })
        it("should pass (6)", async function() {
            // arrange
            const srcData = "dump inuendo"
            const expectedData = ByteUtils.stringToBytes(srcData)
            const reader = Readable.from(expectedData)
            const contentLength = 0
            let releaseCallCount = 0
            const releaseFunc = async () => {
                releaseCallCount++
            }
            const maxChunkSize = 10
            const bufferingEnabled = true
            const bodyBufferingSizeLimit = 4

            // act
            const actual = await ProtocolUtilsInternal.createBodyFromTransport(
                reader, contentLength, releaseFunc, maxChunkSize,
                bufferingEnabled, bodyBufferingSizeLimit)

            // assert
            assert.isNotOk(actual)

            // assert that transport wasn't released.
            assert.equal(releaseCallCount, 0)
        })
        
        // test errors
        it("should fail (1)", async function() {
            // arrange
            const srcData = Buffer.concat([
                Buffer.from([0, 0, 16, 1, 0]),
                ByteUtils.stringToBytes("bits and bytes"),
                Buffer.from([0, 0, 2, 1, 0])
            ])
            const expectedData = ByteUtils.stringToBytes("bits and bytes")
            const reader = Readable.from(srcData)
            const contentLength = -3
            const releaseFunc = undefined
            const maxChunkSize = 60
            const bufferingEnabled = true 
            const bodyBufferingSizeLimit = 3

            // act
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.createBodyFromTransport(
                    reader, contentLength, releaseFunc, maxChunkSize,
                    bufferingEnabled, bodyBufferingSizeLimit)
            }, (err: any) => {
                expect(err.message).to.contain(`limit of ${bodyBufferingSizeLimit}`)
                return true
            })
        })
        it("should fail (2)", async function() {
            // arrange
            const srcData = "ice"
            const expectedData = ByteUtils.stringToBytes(srcData)
            const reader = Readable.from(expectedData)
            const contentLength = 10
            let releaseCallCount = 0
            const releaseFunc = async () => {
                releaseCallCount++
            }
            const maxChunkSize = 6
            const bufferingEnabled = true 
            const bodyBufferingSizeLimit = 4

            // act
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.createBodyFromTransport(
                    reader, contentLength, releaseFunc, maxChunkSize,
                    bufferingEnabled, bodyBufferingSizeLimit)
            }, (err: any) => {
                expect(err.message).to.contain(`length of ${contentLength}`)
                return true
            })

            // assert that transport wasn't released.
            assert.equal(releaseCallCount, 0)
        })
    })

    describe("#completeRequestProcessing", function() {
        it("should pass (1)", async function() {
            const expected = {}
            const workPromise = Promise.resolve(expected)
            const timeoutPromise = undefined
            const cancellationPromise = undefined
            const actual = await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise, timeoutPromise, cancellationPromise)
            assert.strictEqual(actual, expected)
        })
        it("should pass (2)", async function() {
            const expected = {}
            const workPromise = Promise.resolve(expected)
            const timeoutPromise = undefined
            const cancellationPromise = (async function(){
                await createDelayPromise(1_000)
                return null
            })()
            const actual = await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise, timeoutPromise, cancellationPromise)
            assert.strictEqual(actual, expected)
        })
        it("should pass (3)", async function() {
            const workPromise = (async function(){
                await createDelayPromise(1_000)
                return null
            })()
            const timeoutPromise = undefined
            const cancellationPromise = Promise.resolve({})
            const actual = await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise, timeoutPromise, cancellationPromise)
            assert.isNotOk(actual)
        })
        it("should pass (4)", async function() {
            let expected = {}, instance2 = {}, instance3 = {}
            const workPromise = (async function(){
                await createDelayPromise(750)
                return expected
            })()
            const timeoutPromise = (async function(){
                await createDelayPromise(500)
                return expected
            })()
            const cancellationPromise = (async function(){
                await createDelayPromise(1_000)
                return expected
            })()
            const actual = await ProtocolUtilsInternal.completeRequestProcessing(
                workPromise, timeoutPromise, cancellationPromise)
            assert.strictEqual(actual, expected)
        })
        it("should pass (5)", async function() {
            const workPromise = (async function(){
                await createDelayPromise(2_000)
                return {}
            })()
            const timeoutPromise = (async function(){
                await createDelayPromise(500)
                throw new QuasiHttpRequestProcessingError("error1")
            })()
            const cancellationPromise = (async function(){
                await createDelayPromise(1_000)
                return {}
            })()
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.completeRequestProcessing(
                    workPromise, timeoutPromise, cancellationPromise)
            }, {
                name: "QuasiHttpRequestProcessingError",
                message: "error1"
            })
        })
        it("should pass (6)", async function() {
            const workPromise = (async function(){
                await createDelayPromise(500)
                throw new QuasiHttpRequestProcessingError("error1")
            })()
            const timeoutPromise = (async function(){
                await createDelayPromise(2_000)
                throw new QuasiHttpRequestProcessingError("error2")
            })()
            const cancellationPromise = (async function(){
                await createDelayPromise(1_000)
                throw new QuasiHttpRequestProcessingError("error3")
            })()
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.completeRequestProcessing(
                    workPromise, timeoutPromise, cancellationPromise)
            }, {
                name: "QuasiHttpRequestProcessingError",
                message: "error1"
            })
        })
        it("should pass (7)", async function() {
            const workPromise = (async function(){
                await createDelayPromise(2_000)
                throw new QuasiHttpRequestProcessingError("error1")
            })()
            const timeoutPromise = (async function(){
                await createDelayPromise(2_000)
                throw new QuasiHttpRequestProcessingError("error2")
            })()
            const cancellationPromise = (async function(){
                await createDelayPromise(1_000)
                throw new QuasiHttpRequestProcessingError("error3")
            })()
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.completeRequestProcessing(
                    workPromise, timeoutPromise, cancellationPromise)
            }, {
                name: "QuasiHttpRequestProcessingError",
                message: "error3"
            })
        })
        it("should fail due to argument errors", async function() {
            const workPromise = null
            const timeoutPromise = Promise.resolve({})
            const cancellationPromise = (async function(){
                await createDelayPromise(1_000)
                return null
            })()
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.completeRequestProcessing(
                    workPromise as any, timeoutPromise, cancellationPromise)
            }, {
                message: "workPromise argument is null"
            })
        })
    })

    describe("#createCancellableTimeoutPromise", function() {
        it("should pass (1)", function() {
            const actual = ProtocolUtilsInternal.createCancellableTimeoutPromise(
                0, "")
            assert.isNotOk(actual.promise)
            assert.isNotOk(actual.isCancellationRequested())
        })
        it("should pass (2)", function() {
            const actual = ProtocolUtilsInternal.createCancellableTimeoutPromise(
                -3, "")
            assert.isNotOk(actual.promise)
            assert.isNotOk(actual.isCancellationRequested())
        })
        it("should pass (3)", async function() {
            const expectedMsg = "sea";
            const p = ProtocolUtilsInternal.createCancellableTimeoutPromise(
                50, expectedMsg);
            assert.isOk(p.promise)
            assert.isNotOk(p.isCancellationRequested())
            await nativeAssert.rejects(async () => {
                await p.promise
            }, (err: any) => {
                assert.equal(err.reasonCode,
                    QuasiHttpRequestProcessingError.REASON_CODE_TIMEOUT)
                assert.equal(err.message, expectedMsg)
                return true
            })
            assert.isNotOk(p.isCancellationRequested())
            p.cancel()
            assert.isOk(p.isCancellationRequested())
            p.cancel()
            assert.isOk(p.isCancellationRequested())
        })
        it("should pass (4)", async function() {
            const p = ProtocolUtilsInternal.createCancellableTimeoutPromise(
                    500, "")
            assert.isOk(p.promise)
            assert.isNotOk(p.isCancellationRequested())
            await createDelayPromise(100);
            p.cancel()
            assert.isOk(p.isCancellationRequested())
            const actual = await p.promise
            assert.isNotOk(actual)
            p.cancel()
            assert.isOk(p.isCancellationRequested())
        })
    })
})