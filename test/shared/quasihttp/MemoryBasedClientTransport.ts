import { Readable } from "stream";
import {
    ConnectionAllocationResponse,
    IQuasiHttpClientTransport,
    QuasiHttpSendOptions
} from "../../../src/quasihttp/types";
import { MemoryBasedServerTransport } from "./MemoryBasedServerTransport";
import { getEnvVarAsBoolean } from "../../../src/quasihttp/ProtocolUtilsInternal";
import * as QuasiHttpUtils from "../../../src/quasihttp/QuasiHttpUtils"
import { MemoryBasedTransportConnectionInternal } from "./MemoryBasedTransportConnectionInternal";

export class MemoryBasedClientTransport implements IQuasiHttpClientTransport {
    servers = new Map<any, MemoryBasedServerTransport>()
    actualSendOptions?: QuasiHttpSendOptions
    actualRemoteEndpoint?: any

    constructor(servers: Map<any, MemoryBasedServerTransport>) {
        this.servers = servers
    }

    async allocateConnection(remoteEndpoint: any,
            sendOptions: QuasiHttpSendOptions)
            : Promise<ConnectionAllocationResponse | undefined> {
        this.actualRemoteEndpoint = remoteEndpoint;
        this.actualSendOptions = sendOptions;
        if (!this.servers.has(remoteEndpoint)) {
            return undefined
        }
        const server = this.servers.get(remoteEndpoint)
        if (!server) {
            return {
            } as ConnectionAllocationResponse
        }
        const fireAndForget = getEnvVarAsBoolean(
            sendOptions?.extraConnectivityParams,
            QuasiHttpUtils.CONNECTIVITY_PARAM_FIRE_AND_FORGET)
        let connection = new MemoryBasedTransportConnectionInternal(
            fireAndForget)
        const c = {
            connection,
            environment: sendOptions?.extraConnectivityParams
        } as ConnectionAllocationResponse
        if (server.acceptConnectionFunc) {
            server.acceptConnectionFunc(c)
            return c
        }
        throw new Error("no function available to accept connections")
    }

    getReader(connection: any): Readable | undefined {
        return connection.getReader(false)
    }

    getWriter(connection: any): any {
        return connection.getWriter(false)
    }

    async releaseConnection(connection: any) {
        await connection.release()
    }
}