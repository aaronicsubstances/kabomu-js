const { assert } = require("chai").use(require("chai-bytes"))
import * as IOUtils from "../../src/common/IOUtils"
import { IQuasiHttpBody, IQuasiHttpResponse, LeadChunk } from "../../src/quasihttp/types"
import { getBodyReader } from "../../src/quasihttp/entitybody/EntityBodyUtils";

/**
 * This JavaScript function always returns a random number between min (included) and max (excluded).
 * (copied from https://www.w3schools.com/js/js_random.asp).
 * @param min 
 * @param max 
 * @returns 
 */
export function getRndInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

export function createDelayPromise(millis: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, millis)
    })
}

export function assertLeadChunkEqual(
        actual: LeadChunk | null | undefined,
        expected: LeadChunk | null | undefined) {
    if (!actual || !expected) {
        assert.equal(actual, expected)
        return;
    }
    assert.equal(actual.version, expected.version);
    assert.equal(actual.flags, expected.flags);
    assert.equal(actual.requestTarget, expected.requestTarget);
    assert.equal(actual.statusCode, expected.statusCode);
    assert.equal(actual.contentLength, expected.contentLength);
    assert.equal(actual.method, expected.method);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.httpStatusMessage, expected.httpStatusMessage);
    compareHeaders(actual.headers, expected.headers);
}

export async function compareResponses(
        actual: IQuasiHttpResponse | null | undefined,
        expected: IQuasiHttpResponse | null | undefined,
        expectedResBodyBytes?: Buffer | null) {
    if (!expected || !actual) {
        assert.equal(actual, expected);
        return;
    }
    assert.equal(actual.statusCode, expected.statusCode);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.httpStatusMessage, expected.httpStatusMessage);
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodies(actual.body, expected.body, expectedResBodyBytes);
}

export async function compareBodies(
        actual: IQuasiHttpBody | null | undefined,
        expected: IQuasiHttpBody | null | undefined,
        expectedBodyBytes?: Buffer | null) {
    if (!actual || !expected || !expectedBodyBytes) {
        assert.equal(actual, expected)
        return;
    }
    assert.equal(actual.contentLength, expected.contentLength)
    const actualBodyBytes = await IOUtils.readAllBytes(
        getBodyReader(actual))
    assert.equalBytes(actualBodyBytes, expectedBodyBytes)
}

export async function compareResponsesInvolvingUnknownSources(
        actual: IQuasiHttpResponse | null | undefined,
        expected: IQuasiHttpResponse | null | undefined,
        expectedResBodyBytes?: Buffer | null) {
    if (!expected || !actual) {
        assert.equal(actual, expected);
        return;
    }
    assert.equal(actual.statusCode, expected.statusCode);
    assert.equal(actual.httpVersion, expected.httpVersion);
    assert.equal(actual.httpStatusMessage, expected.httpStatusMessage);
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodiesInvolvingUnknownSources(actual.body, expected.body, expectedResBodyBytes);
}

export async function compareBodiesInvolvingUnknownSources(
        actual: IQuasiHttpBody | null | undefined,
        expected: IQuasiHttpBody | null | undefined,
        expectedBodyBytes?: Buffer | null) {
    if (!actual || !expected || !expectedBodyBytes) {
        assert.equal(actual, expected)
        return;
    }
    assert.isNotNull(actual)
    assert.equal(actual.contentLength, expectedBodyBytes.length)
    const actualBodyBytes = await IOUtils.readAllBytes(
        getBodyReader(actual))
    assert.equalBytes(actualBodyBytes, expectedBodyBytes)
}

function compareHeaders(
        actual: Map<string, Array<string>> | null | undefined,
        expected: Map<string, Array<string>> | null | undefined) {
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