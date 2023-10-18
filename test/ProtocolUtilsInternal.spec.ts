import nativeAssert from "assert/strict"
const { assert } = require("chai").use(require("chai-bytes"))

import * as ProtocolUtilsInternal from "../src/ProtocolUtilsInternal"
import { KabomuIOError, QuasiHttpError } from "../src/errors"
import { expect } from "chai"
import { bytesToString, stringToBytes } from "../src/MiscUtilsInternal"

describe("ProtocolUtilsInternal", function() {
    describe("#wrapTimeoutPromise", function() {
        it("should pass (1)", async function() {
            const promise = Promise.resolve(false);
            await ProtocolUtilsInternal.wrapTimeoutPromise(
                promise, true);
        })
        it("should pass (2)", async function() {
            await ProtocolUtilsInternal.wrapTimeoutPromise(
                Promise.resolve() as any, false)
        })
        it("should pass (3)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.resolve(true), true)
            }, (e: any) => {
                assert.instanceOf(e, QuasiHttpError)
                assert.equal(e.message, "send timeout")
                assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_TIMEOUT)
                return true;
            })
        })
        it("should pass (4)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.resolve({} as any), false)
            }, (e: any) => {
                assert.instanceOf(e, QuasiHttpError)
                assert.equal(e.message, "receive timeout")
                assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_TIMEOUT)
                return true;
            })
        })
        it("should pass (5)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.reject(new Error("th")), true)
            }, (e: any) => {
                assert.instanceOf(e, Error)
                assert.equal(e.message, "th")
                return true;
            })
        })
        it("should pass (6)", async function() {
            await nativeAssert.rejects(async () => {
                await ProtocolUtilsInternal.wrapTimeoutPromise(
                    Promise.reject(new KabomuIOError("2gh")), false)
            }, (e: any) => {
                assert.instanceOf(e, KabomuIOError)
                assert.equal(e.message, "2gh")
                return true;
            })
        })
    })

    describe("#containsOnlyPrintableAsciiChars", function() {
        const testData = [
            {
                v: "x.n",
                allowSpace: false,
                expected: true
            },
            {
                v: "x\n",
                allowSpace: false,
                expected: false
            },
            {
                v: "yd\u00c7ea",
                allowSpace: true,
                expected: false
            },
            {
                v: "x m",
                allowSpace: true,
                expected: true
            },
            {
                v: "x m",
                allowSpace: false,
                expected: false
            },
            {
                v: "x-yio",
                allowSpace: true,
                expected: true
            },
            {
                v: "x-yio",
                allowSpace: false,
                expected: true
            },
            {
                v: "x",
                allowSpace: true,
                expected: true
            },
            {
                v: "x",
                allowSpace: false,
                expected: true
            },
            {
                v: " !@#$%^&*()_+=-{}[]|\:;\"'?/>.<,'",
                allowSpace: false,
                expected: false
            },
            {
                v: "!@#$%^&*()_+=-{}[]|\:;\"'?/>.<,'",
                allowSpace: false,
                expected: true
            },
            {
                v: " !@#$%^&*()_+=-{}[]|\:;\"'?/>.<,'",
                allowSpace: true,
                expected: true
            }
        ]
        testData.forEach(({ v, allowSpace, expected }, i) => {
            it(`should pass with input ${i}`, function(){
                const actual = ProtocolUtilsInternal.containsOnlyPrintableAsciiChars(
                    v, allowSpace)
                assert.equal(actual, expected)
            })
        })

        describe("#containsOnlyHeaderNameChars", function() {
            const testData = [
                {
                    v: "x\n",
                    expected: false
                },
                {
                    v: "yd\u00c7ea",
                    expected: false
                },
                {
                    v: "x m",
                    expected: false
                },
                {
                    v: "xmX123abcD",
                    expected: true
                },
                {
                    v: "xm",
                    expected: true
                },
                {
                    v: "x-yio",
                    expected: true
                },
                {
                    v: "x:yio",
                    expected: false
                },
                {
                    v: "123",
                    expected: true
                },
                {
                    v: "x",
                    expected: true
                }
            ]
            testData.forEach(({ v, expected }, i) => {
                it(`should pass with input ${i}`, function(){
                    const actual = ProtocolUtilsInternal.containsOnlyHeaderNameChars(
                        v)
                    assert.equal(actual, expected)
                })
            })
        })

        describe("#validateHttpHeaderSection", function() {
            it("should pass (1)", function() {
                const csv = [
                    ["GET", "/", "HTTP/1.0", "24"]
                ]
                ProtocolUtilsInternal.validateHttpHeaderSection(false,
                    csv)
            })
            it("should pass (2)", function() {
                const csv = [
                    ["HTTP/1.0", "204", "No Content", "-10"],
                    ["Content-Type", "application/json; charset=UTF8"],
                    ["Transfer-Encoding", "chunked"],
                    ["Date", "Tue, 15 Nov 1994 08:12:31 GMT"],
                    ["Authorization", "Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ=="],
                    ["User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:12.0) Gecko/20100101 Firefox/12.0"]
                ]
                ProtocolUtilsInternal.validateHttpHeaderSection(true,
                    csv)
            })

            const testErrorData = [
                {
                    isResponse: true,
                    csv: [["HTTP/1 0", "200", "OK", "-10"]],
                    expectedErrorMessage: "quasi http status line field contains spaces"
                },
                {
                    isResponse: false,
                    csv: [["HTTP/1 0", "20 4", "OK", "-10"]],
                    expectedErrorMessage: "quasi http request line field contains spaces"
                },
                {
                    isResponse: true,
                    csv: [["HTTP/1.0", "200", "OK", "-1 0"]],
                    expectedErrorMessage: "quasi http status line field contains spaces"
                },
                {
                    isResponse: true,
                    csv: [
                        ["HTTP/1.0", "200", "OK", "-51"],
                        ["Content:Type", "application/json; charset=UTF8"]
                    ],
                    expectedErrorMessage: "quasi http header name contains characters other than hyphen"
                },
                {
                    isResponse: false,
                    csv: [
                        ["HTTP/1.0", "200", "OK", "51"],
                        ["Content-Type", "application/json; charset=UTF8\n"]
                    ],
                    expectedErrorMessage: "quasi http header value contains newlines"
                }
            ]
            testErrorData.forEach(({ isResponse, csv, expectedErrorMessage }, i) => {
                it(`should fail with input ${i}`, async function() {
                    await nativeAssert.rejects(async () => {
                        ProtocolUtilsInternal.validateHttpHeaderSection(isResponse,
                            csv)
                    }, (e: any) => {
                        assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
                        expect(e.message).to.contain(expectedErrorMessage)
                        return true
                    });
                })
            })
        })
    })

    describe("#encodeQuasiHttpHeaders", function() {
        const testData = [
            {
                isResponse: false,
                reqOrStatusLine: ["GET", "/home/index?q=results", "HTTP/1.1", "-1"],
                remainingHeaders: new Map([
                    ["Content-Type", ["text/plain"]]
                ]),
                expected: "GET,/home/index?q=results,HTTP/1.1,-1\n" +
                    "Content-Type,text/plain\n"
            },
            {
                isResponse: true,
                reqOrStatusLine: ["HTTP/1.1", 200, "OK", 12],
                remainingHeaders: new Map([
                    ["Content-Type", ["text/plain", "text/csv"]],
                    ["Accept", ["text/html"]],
                    ["Accept-Charset", ["utf-8"]]
                ]),
                expected: "HTTP/1.1,200,OK,12\n" +
                    "Content-Type,text/plain,text/csv\n" +
                    "Accept,text/html\n" +
                    "Accept-Charset,utf-8\n"
            },
            {
                isResponse: false,
                reqOrStatusLine: [
                    undefined, undefined, undefined, 0
                ],
                remainingHeaders: undefined,
                expected: "\"\",\"\",\"\",0\n"
            }
        ]
        testData.forEach(({ isResponse, reqOrStatusLine,
                remainingHeaders, expected }, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = ProtocolUtilsInternal.encodeQuasiHttpHeaders(isResponse,
                    reqOrStatusLine as any, remainingHeaders)
                assert.equal(bytesToString(actual), expected)
            })
        })

        const testErrorData = [
            {
                isResponse: false,
                reqOrStatusLine: ["GET", "/home/index?q=results", "HTTP/1.1", "-1"],
                remainingHeaders: new Map([
                    ["", ["text/plain"]]
                ]),
                expected: "quasi http header name cannot be empty"
            },
            {
                isResponse: true,
                reqOrStatusLine: ["HTTP/1.1", 400, "Bad Request", 12],
                remainingHeaders: new Map([
                    ["Content-Type", ["", "text/csv"]]
                ]),
                expected: "quasi http header value cannot be empty"
            },
            {
                isResponse: false,
                reqOrStatusLine: [
                    "GET or POST", undefined, undefined, 0
                ],
                remainingHeaders: undefined,
                expected: "quasi http request line field contains spaces"
            },
            {
                isResponse: false,
                reqOrStatusLine: [
                    "GET", undefined, undefined, "0 ior 1"
                ],
                remainingHeaders: undefined,
                expected: "quasi http request line field contains spaces"
            },
            {
                isResponse: true,
                reqOrStatusLine: [
                    "HTTP 1.1",
                    "200",
                    "OK",
                    "0"
                ],
                remainingHeaders: undefined,
                expected: "quasi http status line field contains spaces"
            }
        ]
        testErrorData.forEach(({ isResponse, reqOrStatusLine,
                remainingHeaders, expected }, i) => {
            it(`should fail with input ${i}`, async function() {
                await nativeAssert.rejects(async () => {
                    ProtocolUtilsInternal.encodeQuasiHttpHeaders(isResponse,
                        reqOrStatusLine as any, remainingHeaders)
                }, (e: any) => {
                    assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
                    expect(e.message).to.contain(expected)
                    return true
                });
            })
        })
    })

    describe("#decodeQuasiHttpHeaders", function() {
        const testData = [
            {
                isResponse: false,
                buffer: stringToBytes(
                    "GET,/home/index?q=results,HTTP/1.1,-1\n" +
                    "Content-Type,text/plain\n"),
                expectedHeaders: new Map([
                    ["content-type", ["text/plain"]]
                ]),
                expectedReqOrStatusLine: [
                    "GET",
                    "/home/index?q=results",
                    "HTTP/1.1",
                    "-1"
                ]
            },
            {
                isResponse: true,
                buffer: stringToBytes(
                    "HTTP/1.1,200,OK,12\n" +
                    "Content-Type,text/plain,text/csv\n" +
                    "content-type,application/json\n" +
                    "\r\n" +
                    "ignored\n" +
                    "Accept,text/html\n" +
                    "Accept-Charset,utf-8\n"),
                expectedHeaders: new Map([
                    ["content-type", [
                        "text/plain", "text/csv", "application/json"]],
                    ["accept", ["text/html"]],
                    ["accept-charset", ["utf-8"]]
                ]),
                expectedReqOrStatusLine: [
                    "HTTP/1.1",
                    "200",
                    "OK",
                    "12"
                ]
            },
            {
                isResponse: false,
                buffer: stringToBytes(
                    "\"\",\"\",\"\",0\n"),
                expectedHeaders: new Map(),
                expectedReqOrStatusLine: [
                    "",
                    "",
                    "",
                    "0"
                ]
            }
        ]
        testData.forEach(({isResponse, buffer,
                expectedHeaders, expectedReqOrStatusLine }, i) => {
            it(`should pass with input ${i}`, () => {
                const headersReceiver = new Map()
                const actualReqOrStatusLine = ProtocolUtilsInternal.decodeQuasiHttpHeaders(
                    isResponse, buffer, headersReceiver)
                assert.deepEqual(actualReqOrStatusLine,
                    expectedReqOrStatusLine)
                assert.deepEqual(headersReceiver, expectedHeaders)
            })
        })
        
        const testErrorData = [
            {
                isResponse: false,
                buffer: stringToBytes("\"k\n,lopp"),
                expectedErrorMessage: "invalid quasi http headers"
            },
            {
                isResponse: false,
                buffer: Buffer.alloc(0),
                expectedErrorMessage: "invalid quasi http headers"
            },
            {
                isResponse: true,
                buffer: stringToBytes("HTTP/1.1,200"),
                expectedErrorMessage: "invalid quasi http status line"
            },
            {
                isResponse: false,
                buffer: stringToBytes("GET,HTTP/1.1,"),
                expectedErrorMessage: "invalid quasi http request line"
            }
        ]
        testErrorData.forEach(({ isResponse, buffer,
                expectedErrorMessage }, i) => {
            it(`should fail with input ${i}`, async () => {
                const headersReceiver = new Map()
                await nativeAssert.rejects(async () => {
                    ProtocolUtilsInternal.decodeQuasiHttpHeaders(isResponse,
                        buffer, headersReceiver)
                }, (e: any) => {
                    assert.equal(e.reasonCode, QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
                    expect(e.message).to.contain(expectedErrorMessage)
                    return true
                });
            })
        })
    })
})