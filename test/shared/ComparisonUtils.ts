const { assert } = require("chai").use(require("chai-bytes"))
import * as IOUtils from "../../src/common/IOUtils"
import { IQuasiHttpBody } from "../../src/quasihttp/types"
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

export async function compareBodies(
        actual: IQuasiHttpBody | null, expected: IQuasiHttpBody,
        expectedBodyBytes: Buffer | null) {
    if (!expectedBodyBytes) {
        assert.strictEqual(actual, expected)
        return;
    }
    assert.isNotNull(actual)
    assert.equal(actual!.contentLength, expected.contentLength)
    const actualBodyBytes = await IOUtils.readAllBytes(
        getBodyReader(actual!))
    assert.equalBytes(actualBodyBytes, expectedBodyBytes)
}

export async function compareBodiesInvolvingUnknownSources(
        actual: IQuasiHttpBody | null, expected: IQuasiHttpBody,
        expectedBodyBytes: Buffer | null) {
    if (!expectedBodyBytes) {
        assert.strictEqual(actual, expected)
        return;
    }
    assert.isNotNull(actual)
    assert.equal(actual!.contentLength, expectedBodyBytes.length)
    const actualBodyBytes = await IOUtils.readAllBytes(
        getBodyReader(actual!))
    assert.equalBytes(actualBodyBytes, expectedBodyBytes)
}
