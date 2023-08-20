import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import * as IOUtils from "../../common/IOUtils";
import * as CsvUtils from "../../common/CsvUtils";

export class CsvBody implements IQuasiHttpBody {
    contentLength = -1;
    content: Map<string, string[]>;
    constructor(content: Map<string, string[]>) {
        this.content = content;
    }
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
    async release() {
    }
    async writeBytesTo(writer: Writable) {
        await IOUtils.copyBytes(this.getReader(), writer);
    }
}