import {
    createMemoryPipeCustomReaderWriter,
    endWritesOnMemoryPipe
} from "../../../src/common/MemoryPipeCustomReaderWriter"
import { customReaderSymbol } from "../../../src/common/types"

export class MemoryBasedTransportConnectionInternal {
    _fireAndForget: any
    _serverPipe: any
    _clientPipe: any

    constructor(fireAndForget?: any) {
        this._fireAndForget = fireAndForget
        this._serverPipe = createMemoryPipeCustomReaderWriter()
        this._clientPipe = createMemoryPipeCustomReaderWriter()
    }

    getReader(fromServer: any) {
        if (!fromServer && this._fireAndForget) {
            return {
                async [customReaderSymbol](size: number) {
                }
            }
        }
        return fromServer ? this._serverPipe : this._clientPipe
    }

    getWriter(fromServer: any) {
        if (fromServer && this._fireAndForget) {
            /*return ({
                async [customWriterSymbol](chunk: any) {
                }
            })*/
        }
        return fromServer ? this._clientPipe : this._serverPipe
    }

    async release() {
        await endWritesOnMemoryPipe(this._serverPipe)
        await endWritesOnMemoryPipe(this._clientPipe)
    }
}