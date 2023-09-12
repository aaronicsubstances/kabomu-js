const { assert } = require("chai").use(require("chai-bytes"))
import { Readable } from "stream";
import * as MiscUtils from "../../src/MiscUtils"
import {
    IQuasiHttpRequest,
    IQuasiHttpResponse
} from "../../src/types"

export async function compareRequests(
        actual: IQuasiHttpRequest | undefined,
        expected: IQuasiHttpRequest | undefined,
        expectedReqBodyBytes: Buffer | undefined) {
    if (!expected || !actual) {
        assert.equal(actual, expected);
        return;
    }
    assert.equal(actual.httpMethod, expected.httpMethod);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.contentLength, expected.contentLength);
    assert.equal(actual.target, expected.target);
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodies(actual.body, expected.body, expectedReqBodyBytes);
}

export async function compareResponses(
        actual: IQuasiHttpResponse | undefined,
        expected: IQuasiHttpResponse | undefined,
        expectedResBodyBytes: Buffer | undefined) {
    if (!expected || !actual) {
        assert.equal(actual, expected);
        return;
    }
    assert.equal(actual.statusCode, expected.statusCode);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.httpStatusMessage, expected.httpStatusMessage);
    assert.equal(actual.contentLength, expected.contentLength);
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodies(actual.body, expected.body, expectedResBodyBytes);
}

export async function compareBodies(
        actual: Readable | undefined,
        expected: Readable | undefined,
        expectedBodyBytes: Buffer | undefined) {
    if (!actual || !expected || !expectedBodyBytes) {
        assert.equal(actual, expected)
        return;
    }
    const actualBodyBytes = await MiscUtils.readAllBytes(
        actual)
    assert.equalBytes(actualBodyBytes, expectedBodyBytes)
}

function compareHeaders(
        actual: Map<string, Array<string>> | undefined,
        expected: Map<string, Array<string>> | undefined) {
    const actualExtraction = new Map<string, string[]>();
    if (actual) {
        for (const key of actual.keys()) {
            let value = actual[key];
            if (typeof value === "string") {
                value = [value]
            }
            if (value && value.length > 0) {
                actualExtraction.set(key, value);
            }
        }
    }
    const expectedExtraction = new Map<string, string[]>();
    if (expected) {
        for (const key of expected.keys()) {
            let value = expected[key];
            if (typeof value === "string") {
                value = [value]
            }
            if (value && value.length > 0) {
                expectedExtraction.set(key, value);
            }
        }
    }
    assert.deepEqual(actualExtraction, expectedExtraction)
}

/**
 * This JavaScript function always returns a random number between min (included) and max (excluded).
 * (copied from https://www.w3schools.com/js/js_random.asp).
 * @param min defaults to zero
 * @param max defaults to max signed 32-bit integer
 * @returns random integer between min inclusive and max exclusive
 */
export function getRndInteger(min?: number, max?: number) {
    if (!min) {
        min = 0
    }
    const MAX_SIGNED_INT_32_VALUE = 2_147_483_647
    if (!max) {
        max = MAX_SIGNED_INT_32_VALUE
    }
    return Math.floor(Math.random() * (max - min) ) + min;
}

export function createDelayPromise(millis: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, millis)
    })
}

export function createYieldPromise() {
    return new Promise<void>((resolve) => {
        setImmediate(resolve)
    })
}