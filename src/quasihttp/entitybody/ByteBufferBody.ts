import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as IOUtils from "../../common/IOUtils";

/**
 * Represents quasi http body based on a byte buffer.
 */
export class ByteBufferBody implements IQuasiHttpBody {
    contentLength: number;
    buffer: Buffer;

    /**
     * Creates a new instance.
     * @param buffer backing byte array
     */
    constructor(buffer: Buffer) {
        if (!buffer) {
            throw new Error("buffer argument is null");
        }
        this.buffer = buffer;
        this.contentLength = buffer.length;
    }

    /**
     * Does nothing.
     */
    async release() {
    }

    /**
     * Returns a freshly created readable stream backed by
     * buffer property.
     */
    getReader() {
        return Readable.from(this.buffer)
    }

    /**
     * Transfers contents of buffer property
     * to supplied writer.
     * @param writer suppllied writer
     */
    async writeBytesTo(writer: Writable): Promise<void> {
        await IOUtils.writeBytes(writer, this.buffer, 0,
            this.buffer.length);
    }
}