import { Writable } from "stream";

export class ChunkEncodingCustomWriter extends Writable {
    constructor(writable: Writable, maxChunkSize: number) {
        super()
    }
    // create internal transform and use as writable
}