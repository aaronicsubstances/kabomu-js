import { Readable, Writable } from "stream"
import { ICustomDisposable, ICustomWritable } from "../common/types"

export interface ProtocolSendResultInternal {
    response?: IQuasiHttpResponse
    responseBufferingApplied?: boolean
}

export interface ISendProtocolInternal {
    cancel(): Promise<void>
    send(): Promise<ProtocolSendResultInternal>
}

export interface IReceiveProtocolInternal {
    cancel(): Promise<void>
    receive(): Promise<IQuasiHttpResponse>
}

export interface IQuasiHttpRequest extends ICustomDisposable {
    target?: string
    headers?: Map<string, string[]>
    body?: IQuasiHttpBody
    method?: string
    httpVersion?: string
    environment?: Map<string, any>
}

export interface IQuasiHttpResponse extends ICustomDisposable {
    statusCode: number
    headers?: Map<string, string[]>
    body?: IQuasiHttpBody
    httpStatusMessage?: string
    httpVersion?: string
    environment?: Map<string, any>
}

export interface IQuasiHttpBody extends ICustomDisposable, ICustomWritable {
    contentLength: bigint
    getReader(): Readable | null
}

export interface IConnectionAllocationResponse {
    connection: any
    environment?: Map<string, any>
}

export interface IQuasiHttpSendOptions {
    extraConnectivityParams?: Map<string, any>
    timeoutMillis: number
    maxChunkSize: number
    responseBufferingEnabled?: boolean
    responseBodyBufferingSizeLimit: number
    ensureNonNullResponse?: boolean 
}

export interface IQuasiHttpProcessingOptions {
    timeoutMillis: number
    maxChunkSize: number
}

export interface IQuasiHttpAltTransport {
    processSendRequest(remoteEndpoint: any, request: IQuasiHttpRequest,
        sendOptions: IQuasiHttpSendOptions): [Promise<IQuasiHttpResponse>, any]
    processSendRequest(remoteEndpoint: any,
        requestFunc: (env: Map<string, any>) => Promise<IQuasiHttpRequest>,
        sendOptions: IQuasiHttpSendOptions): [Promise<IQuasiHttpResponse>, any]
    cancelSendRequest(sendCancellationHandle: any): void
}

export interface IQuasiHttpClientTransport extends IQuasiHttpTransport  {
    allocateConnection(remoteEndpoint: any, sendOptions: IQuasiHttpSendOptions):
        Promise<IConnectionAllocationResponse>
}

export interface IQuasiHttpTransport {
    getReader(connection: any): Promise<Readable>
    getWriter(connection: any): Promise<Writable>
    releaseConnection(connection: any): Promise<void>
}

export interface IQuasiHttpServerTransport  extends IQuasiHttpTransport {
}
