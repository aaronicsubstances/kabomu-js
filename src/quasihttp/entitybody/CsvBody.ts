import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as CsvUtils from "../../common/CsvUtils";

/**
 * Represents quasi http body based CSV serialized in UTF-8 encoding. This class was created
 * to serve as a convenient means of representing actual HTTP forms (application/x-www-form-urlencoded),
 * and query string portion of actual HTTP request lines/URLs. Both can be encoded as CSV rows, in which 
 *
 *  1. the first column of each row is a name or key
 *  2. the remaining columns are for the many possible values of the name or key
 *  3. each row can have a different number of columns
 * 
 */
export class CsvBody implements IQuasiHttpBody {
    contentLength = -1;

    /**
     * Map containing the CSV rows serving as the source of bytes for the instance.
     */
    content: Map<string, string[]>;

    /**
     * Creates a new instance with the given CSV content.
     * Initializes content length to -1.
     * @param content CSV content
     */
    constructor(content: Map<string, string[]>) {
        if (!content) {
            throw new Error("content argument is null");
        }
        this.content = content;
    }

    /**
     * Returns a freshly created readable stream backed by
     * content property in UTF-8 encoding.
     */
    getReader() {
        return Readable.from(Buffer.from(this._serializeContent()));
    }
    private _serializeContent() {
        const rows = new Array<Array<string>>();
        for (const entry of this.content) {
            const row = new Array<string>();
            row.push(entry[0]);
            row.push(...entry[1]);
            rows.push(row);
        }
        const csv = CsvUtils.serialize(rows);
        return csv;
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
        for (const entry of this.content) {
            const row = new Array<string>();
            row.push(entry[0]);
            row.push(...entry[1]);
            await CsvUtils.serializeTo([row], writer);
        }
    }
}