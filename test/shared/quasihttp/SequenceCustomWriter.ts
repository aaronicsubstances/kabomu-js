import * as IOUtils from "../../../src/common/IOUtils"
import { ICustomWriter, customWriterSymbol } from "../../../src/common/types"

export class SequenceCustomWriter implements ICustomWriter {
    _writerIndex = 0
    writers: Array<any>

    constructor(writers: Array<any>) {
        this.writers = writers
    }

    async [customWriterSymbol](chunk: any) {
        if (this.writers) {
            const currentWriter = this.writers[this._writerIndex]
            await IOUtils.writeBytes(currentWriter, chunk)
        }
    }

    switchOver() {
        this._writerIndex++
    }
}