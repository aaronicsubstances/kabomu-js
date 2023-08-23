import { Writable } from "stream";
import * as IOUtils from "../../../src/common/IOUtils"

export class SequenceCustomWriter extends Writable {
    _writerIndex = 0
    writers: Array<Writable>

    constructor(writers: Array<Writable>) {
        super({})
        this.writers = writers
    }

    _write(chunk: any, encoding: BufferEncoding, cb: any) {
        this.writeAsync(chunk, cb)
    }

    async writeAsync(chunk: any, cb: any) {
        try {
            if (this.writers) {
                const currentWriter = this.writers[this._writerIndex]
                await IOUtils.writeBytes(currentWriter, chunk)
            }
            cb()
        }
        catch (e) {
            cb(e)
        }
    }

    switchOver() {
        this._writerIndex++
    }
}