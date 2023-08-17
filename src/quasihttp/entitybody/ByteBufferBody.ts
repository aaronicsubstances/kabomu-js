import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as IOUtils from "../../common/IOUtils";

export class ByteBufferBody implements IQuasiHttpBody {
    contentLength: bigint;
    buffer: Buffer;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.contentLength = BigInt(buffer.length);
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