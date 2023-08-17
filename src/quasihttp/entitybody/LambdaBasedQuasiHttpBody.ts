import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import { ICustomWritable } from "../../common/types";
import * as IOUtils from "../../common/IOUtils";
import { MissingDependencyError } from "../../common/errors";

export class LambdaBasedQuasiHttpBody implements IQuasiHttpBody {
    contentLength = BigInt(-1);
    writable?: ICustomWritable;
    releaseFunc?: () => Promise<void> | null;
    readerFunc?: () => Readable;

    getReader(): Readable | null {
        if (!this.readerFunc) {
            return null;
        }
        return this.readerFunc();
    }

    async release() {
        if (this.releaseFunc) {
            this.releaseFunc();
        }
    }
    async writeBytesTo(writer: Writable) {
        if (this.writable) {
            await this.writable.writeBytesTo(writer);
            return;
        }
        const reader = this.getReader();
        if (!reader) {
            throw new MissingDependencyError(
                "received null from Reader property");
        }
        await IOUtils.copyBytes(reader, writer);
    }
}