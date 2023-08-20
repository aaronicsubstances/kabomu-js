import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as IOUtils from "../../common/IOUtils";

export class ByteBufferBody implements IQuasiHttpBody {
    contentLength: number;
    buffer: Buffer;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.contentLength = buffer.length;
    }

    async release() {
    }

    getReader() {
        return Readable.from(this.buffer)
    }

    async writeBytesTo(writer: Writable): Promise<void> {
        await IOUtils.copyBytes(this.getReader(), writer);
    }
}