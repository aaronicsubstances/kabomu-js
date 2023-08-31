import { Readable } from "stream";
import { IQuasiHttpTransport } from "../../../src/quasihttp/types";
import * as IOUtils from "../../../src/common/IOUtils"
import { createYieldPromise } from "../../../src/common/MiscUtils";
import { customWriterSymbol } from "../../../src/common/types";

export class DemoQuasiHttpTransport implements IQuasiHttpTransport {
    private _expectedConnection: any;
    private _backingReader: Readable;
    private _backingWriter: any;
    releaseCallCount = 0;

    constructor(expectedConnection: any,
            backingReader: Readable,
            backingWriter: any) {
        this._expectedConnection = expectedConnection;
        this._backingReader = backingReader;
        this._backingWriter = backingWriter;
    }

    getWriter(connection: any) {
        if (connection !== this._expectedConnection) {
            throw new Error("unexpected connection")
        }
        if (!this._backingWriter) {
            return undefined
        }
        const that = this
        return {
            async [customWriterSymbol](chunk: Buffer) {
                await createYieldPromise()
                await IOUtils.writeBytes(that._backingWriter, chunk)
            }
        }
    }

    getReader(connection: any): Readable | undefined {
        if (connection !== this._expectedConnection) {
            throw new Error("unexpected connection")
        }
        if (!this._backingReader) {
            return undefined
        }
        const that = this
        return Readable.from((async function*() {
            await createYieldPromise()
            for await (const chunk of that._backingReader) {
                yield chunk
            }
        })())
    }
    async releaseConnection(connection: any) {
        if (connection !== this._expectedConnection) {
            throw new Error("unexpected connection")
        }
        this.releaseCallCount++
        await createYieldPromise()
    }
}