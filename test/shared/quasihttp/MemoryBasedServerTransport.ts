import { Readable } from "stream";
import {
    ConnectionAllocationResponse,
    IQuasiHttpServerTransport
} from "../../../src/quasihttp/types";

export class MemoryBasedServerTransport implements IQuasiHttpServerTransport {
    acceptConnectionFunc?: (c: ConnectionAllocationResponse) => void

    constructor(options: {
        acceptConnectionFunc: (c: ConnectionAllocationResponse) => void
    }) {
        this.acceptConnectionFunc = options?.acceptConnectionFunc
    }

    getReader(connection: any): Readable | undefined {
        return connection.getReader(true)
    }

    getWriter(connection: any): any {
        return connection.getWriter(true)
    }

    async releaseConnection(connection: any) {
        await connection.release()
    }
}