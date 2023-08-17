import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as IOUtils from "../../common/IOUtils";

export class StringBody implements IQuasiHttpBody {
    contentLength: bigint;
    content: string;
    constructor(content: string) {
        this.content = content;
        this.contentLength = BigInt(Buffer.byteLength(content));
    }
    getReader() {
        return Readable.from(Buffer.from(this.content));
    }
    async release() {
    }
    async writeBytesTo(writer: Writable) {
        await IOUtils.copyBytes(this.getReader(), writer);
    }
}