import { Duplex, Readable } from "stream";

export class ContentLengthEnforcingCustomReader extends Readable {
    constructor(reader: Readable, contentLength: bigint) {
        super()
    }
    // create internal transform and use as reader.
}