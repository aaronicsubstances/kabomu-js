import { Readable, Writable } from "stream";
import { IQuasiHttpTransport } from "../../../src/quasihttp/types";
import { createPendingPromise } from "../../../src/quasihttp/ProtocolUtilsInternal";
import * as IOUtils from "../../../src/common/IOUtils"

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
                const yieldPromise = createPendingPromise<void>()
                setImmediate(() => {
                    yieldPromise.resolve()
                })
                await yieldPromise.promise
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
            const yieldPromise = createPendingPromise<void>()
            setImmediate(() => {
                yieldPromise.resolve()
            })
            await yieldPromise.promise
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
        const yieldPromise = createPendingPromise<void>()
        setImmediate(() => {
            yieldPromise.resolve()
        })
        await yieldPromise.promise
    }
}