import { Readable, Writable } from "stream";
import { IQuasiHttpTransport } from "../../../src/quasihttp/types";
import * as IOUtils from "../../../src/common/IOUtils"
import { createYieldPromise } from "../../../src/common/MiscUtils";

export class DemoQuasiHttpTransport implements IQuasiHttpTransport {
    private _expectedConnection: any;
    private _backingReader: Readable;
    private _backingWriter: Writable;
    releaseCallCount = 0;

    constructor(expectedConnection: any,
            backingReader: Readable,
            backingWriter: Writable) {
        this._expectedConnection = expectedConnection;
        this._backingReader = backingReader;
        this._backingWriter = backingWriter;
    }
    getWriter(connection: any): Writable {
        if (connection !== this._expectedConnection) {
            throw new Error("unexpected connection")
        }
        if (!this._backingWriter) {
            return null as any
        }
        const that = this
        const writeAsync = async function(chunk: any, cb: any) {
            try {
                await createYieldPromise()
                await IOUtils.writeBytes(that._backingWriter, chunk)
                cb()
            }
            catch (e) {
                cb(e)
            }
        }
        return new Writable({
            write(chunk, encoding, cb) {
                writeAsync(chunk, cb)
            }
        })
    }
    getReader(connection: any): Readable {
        if (connection !== this._expectedConnection) {
            throw new Error("unexpected connection")
        }
        if (!this._backingReader) {
            return null as any
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