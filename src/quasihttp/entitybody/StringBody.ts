import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as IOUtils from "../../common/IOUtils";

/**
 * Represents quasi http body based on a string in UTF-8 encoding.
 */
export class StringBody implements IQuasiHttpBody {
    contentLength: number;
    content: string;

    /**
     * Creates a new instance with the given string. The content length is
     * initialized to the byte count of the string in UTF-8 encoding.
     * @param content string content
     */
    constructor(content: string) {
        if (!content && content !== "") {
            throw new Error("content argument is null");
        }
        this.content = content;
        this.contentLength = Buffer.byteLength(content);
    }

    /**
     * Returns a freshly created readable stream backed by
     * content property in UTF-8 encoding.
     */
    getReader() {
        return Readable.from(Buffer.from(this.content));
    }

    /**
     * Does nothing.
     */
    async release() {
    }

    /**
     * Transfers contents of content property
     * to supplied writer in UTF-8 encoding.
     * @param writer supplied writer
     */
    async writeBytesTo(writer: Writable) {
        const contentBytes = Buffer.from(this.content);
        await IOUtils.writeBytes(writer, contentBytes);
    }
}