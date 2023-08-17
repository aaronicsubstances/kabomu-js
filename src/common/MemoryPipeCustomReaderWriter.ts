import { Duplex } from "stream";

export class MemoryPipeCustomReaderWriter extends Duplex {
    constructor(answerZeroByteReadsFromPipe = false) {
        super();
    }
    // explore stream.PassThrough type?
}