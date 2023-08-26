const { assert } = require("chai").use(require("chai-bytes"))
import * as IOUtils from "../../../src/common/IOUtils"
import { IQuasiHttpBody, IQuasiHttpRequest, IQuasiHttpResponse, LeadChunk } from "../../../src/quasihttp/types"
import { getBodyReader } from "../../../src/quasihttp/entitybody/EntityBodyUtils";

export function compareLeadChunks(
        actual: LeadChunk | undefined,
        expected: LeadChunk | undefined) {
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

export async function compareRequests(
        actual: IQuasiHttpRequest | undefined,
        expected: IQuasiHttpRequest | undefined,
        expectedReqBodyBytes: Buffer | undefined) {
    if (!expected || !actual) {
        assert.equal(actual, expected);
        return;
    }
    assert.equal(actual.method, expected.method);
    assert.equal(actual.httpVersion, expected.httpVersion);
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
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodies(actual.body, expected.body, expectedResBodyBytes);
}

export async function compareBodies(
        actual: IQuasiHttpBody | undefined,
        expected: IQuasiHttpBody | undefined,
        expectedBodyBytes: Buffer | undefined) {
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
    compareHeaders(actual.headers, expected.headers);
    //assert.equal(actual.environment, expected.environment);
    await compareBodiesInvolvingUnknownSources(actual.body, expected.body, expectedResBodyBytes);
}

export async function compareBodiesInvolvingUnknownSources(
        actual: IQuasiHttpBody | undefined,
        expected: IQuasiHttpBody | undefined,
        expectedBodyBytes: Buffer | undefined) {
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