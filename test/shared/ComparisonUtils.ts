const { assert } = require("chai").use(require("chai-bytes"))
import { Readable, Writable } from "stream";
import {
    IQuasiHttpRequest,
    IQuasiHttpResponse
} from "../../src/types"
import { pipeline } from "stream/promises";

export async function compareRequests(
        actual: IQuasiHttpRequest | undefined,
        expected: IQuasiHttpRequest | undefined,
        expectedReqBodyBytes: Buffer | undefined) {
    if (!actual || !expected) {
        assert.strictEqual(actual, expected);
        return;
    }
    assert.equal(actual.httpMethod, expected.httpMethod);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.contentLength, expected.contentLength);
    assert.equal(actual.target, expected.target);
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodies(actual.body, expectedReqBodyBytes);
}

export async function compareResponses(
        actual: IQuasiHttpResponse | undefined,
        expected: IQuasiHttpResponse | undefined,
        expectedResBodyBytes: Buffer | undefined) {
    if (!actual || !expected) {
        assert.strictEqual(actual, expected);
        return;
    }
    assert.equal(actual.statusCode, expected.statusCode);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.httpStatusMessage, expected.httpStatusMessage);
    assert.equal(actual.contentLength, expected.contentLength);
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodies(actual.body, expectedResBodyBytes);
}

export async function compareBodies(
        actual: Readable | undefined,
        expectedBodyBytes: Buffer | undefined) {
    if (!expectedBodyBytes) {
        assert.isNotOk(actual)
        return;
    }
    assert.isOk(actual)
    const actualBodyBytes = await readAllBytes(actual!)
    assert.equalBytes(actualBodyBytes, expectedBodyBytes)
}

function compareHeaders(
        actual: Map<string, Array<string>> | undefined,
        expected: Map<string, Array<string>> | undefined) {
    if (!actual || !expected) {
        assert.strictEqual(actual, expected)
        return;
    }
    const actualExtraction = new Array<string[]>();
    for (const entry of actual) {
        actualExtraction.push([entry[0], ...entry[1]]);
    }
    const expectedExtraction = new Array<string[]>();
    for (const entry of expected) {
        expectedExtraction.push([entry[0], ...entry[1]]);
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

export async function readAllBytes(src: Readable) {
    const chunks = new Array<Buffer>();
    const writer = new Writable({
        write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback()
        },
    });
    await pipeline(src, writer);
    return Buffer.concat(chunks);
}