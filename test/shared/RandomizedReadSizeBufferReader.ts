import { Readable, ReadableOptions } from "stream";

export function createRandomizedReadSizeBufferReader(b: Buffer) {
    /*return Readable.from((async function*() {
        let offset = 0
        while (offset < b.length) {
            const bytesToCopy = getRndInteger(0, b.length - offset) + 1
            yield b.subarray(offset, offset + bytesToCopy)
            offset += bytesToCopy
        }
    })());*/
    return new RandomizedReadSizeBufferReader(b, {
        highWaterMark: getRndInteger(1, 11)
    })
}

/**
 * Designed to allow its _read() method to be called
 * externally by a class implementing readable part of
 * Duplex stream
 */
class RandomizedReadSizeBufferReader extends Readable {
    _source: Buffer
    _offset = 0
    constructor(source: Buffer, options: ReadableOptions) {
        super(options)
        this._source = source
    }

    _read(size: number) {
        if (this._offset >= this._source.length) {
            this.push(null)
            return
        }
        const bytesToCopy = getRndInteger(0,
            this._source.length - this._offset) + 1
        this.push(this._source.subarray(
            this._offset, this._offset + bytesToCopy))
        this._offset += bytesToCopy
    }
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