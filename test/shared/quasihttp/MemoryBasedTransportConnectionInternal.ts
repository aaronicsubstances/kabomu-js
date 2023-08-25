import { Duplex, Readable, Writable } from "stream"
import {
    createMemoryPipeCustomReaderWriter,
    endWritesOnMemoryPipe
} from "../../../src/common/MemoryPipeCustomReaderWriter"

export class MemoryBasedTransportConnectionInternal {
    _fireAndForget: any
    _serverPipe: Duplex
    _clientPipe: Duplex

    constructor(fireAndForget?: any) {
        this._fireAndForget = fireAndForget
        this._serverPipe = createMemoryPipeCustomReaderWriter()
        this._clientPipe = createMemoryPipeCustomReaderWriter()
    }

    getReader(fromServer: any) {
        if (!fromServer && this._fireAndForget) {
            return Readable.from(Buffer.alloc(0))
        }
        return fromServer ? this._serverPipe : this._clientPipe
    }

    getWriter(fromServer: any) {
        if (fromServer && this._fireAndForget) {
            /*return new Writable({
                write(chunk, encoding, cb) {
                    cb()
                },
                destroy(error, cb) {
                    cb(null)
                },
            })*/
        }
        return fromServer ? this._clientPipe : this._serverPipe
    }

    async release() {
        await endWritesOnMemoryPipe(this._serverPipe)
        await endWritesOnMemoryPipe(this._clientPipe)
    }
}