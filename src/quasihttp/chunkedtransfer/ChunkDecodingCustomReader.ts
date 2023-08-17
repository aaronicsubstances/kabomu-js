import { Readable } from "stream";

export class ChunkDecodingCustomReader extends Readable {
    constructor(reader: Readable, maxChunkSize: number) {
        super()
    }
    // create internal transform and use as readable
}