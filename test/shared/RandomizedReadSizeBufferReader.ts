import { Readable } from "stream";
import {
    getRndInteger
} from "./ComparisonUtils";
import { createYieldPromise } from "../../src/QuasiHttpUtils";

export function createRandomizedReadSizeBufferReader(b: Buffer) {
    return Readable.from((async function*() {
        await createYieldPromise()
        let offset = 0
        while (offset < b.length) {
            const bytesToCopy = getRndInteger(0, b.length - offset) + 1
            yield b.subarray(offset, offset + bytesToCopy)
            offset += bytesToCopy
            await createYieldPromise()
        }
    })(), {
        objectMode: false
    });
}
