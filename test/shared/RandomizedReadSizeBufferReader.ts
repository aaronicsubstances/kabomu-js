import { Readable } from "stream";

export function createRandomizedReadSizeBufferReader(b: Buffer) {
    return Readable.from((async function*() {
        let offset = 0
        while (offset < b.length) {
            const bytesToCopy = getRndInteger(0, b.length - offset) + 1
            yield b.subarray(offset, offset + bytesToCopy)
            offset += bytesToCopy
        }
    })());
}

/**
 * This JavaScript function always returns a random number between min (included) and max (excluded).
 * (copied from https://www.w3schools.com/js/js_random.asp).
 * @param min 
 * @param max 
 * @returns 
 */
function getRndInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min) ) + min;
}