import { Readable } from "stream";
import { getRndInteger } from "./ComparisonUtils";
import { createPendingPromise } from "../../../src/quasihttp/ProtocolUtilsInternal";

export function createRandomizedReadSizeBufferReader(b: Buffer) {
    return Readable.from((async function*() {
        let yieldPromise = createPendingPromise()
        setImmediate(() => {
            yieldPromise.resolve(null)
        })
        await yieldPromise.promise
        let offset = 0
        while (offset < b.length) {
            const bytesToCopy = getRndInteger(0, b.length - offset) + 1
            yield b.subarray(offset, offset + bytesToCopy)
            offset += bytesToCopy
            yieldPromise = createPendingPromise()
            setImmediate(() => {
                yieldPromise.resolve(null)
            })
            await yieldPromise.promise
        }
    })());
}
