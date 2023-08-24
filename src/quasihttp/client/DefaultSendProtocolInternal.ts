import { whenAnyPromiseSettles } from "../../common/MiscUtilsInternal";
import {
    ExpectationViolationError,
    MissingDependencyError
} from "../../common/errors";
import { DefaultQuasiHttpResponse } from "../DefaultQuasiHttpResponse";
import {
    createBodyFromTransport,
    transferBodyToTransport
} from "../ProtocolUtilsInternal";
import { CustomChunkedTransferCodec } from "../chunkedtransfer/CustomChunkedTransferCodec";
import { QuasiHttpRequestProcessingError } from "../errors";
import {
    IQuasiHttpRequest,
    IQuasiHttpTransport,
    ISendProtocolInternal,
    ProtocolSendResultInternal
} from "../types";

export class DefaultSendProtocolInternal implements ISendProtocolInternal {
    request: IQuasiHttpRequest
    transport: IQuasiHttpTransport
    connection: any
    maxChunkSize: number
    responseBufferingEnabled: boolean
    responseBodyBufferingSizeLimit: number
    ensureTruthyResponse: boolean

    constructor(options: {
                request: IQuasiHttpRequest
                transport: IQuasiHttpTransport
                connection: any
                maxChunkSize: number
                responseBufferingEnabled: boolean
                responseBodyBufferingSizeLimit: number
                ensureTruthyResponse: boolean
            }) {
        this.request = options?.request
        this.transport = options?.transport
        this.connection = options?.connection
        this.maxChunkSize = options?.maxChunkSize
        this.responseBufferingEnabled = options?.responseBufferingEnabled
        this.responseBodyBufferingSizeLimit = options?.responseBodyBufferingSizeLimit
        this.ensureTruthyResponse = options?.ensureTruthyResponse
    }

    async cancel(): Promise<void> {
        // just in case Transport was incorrectly set to null.
        if (this.transport) {
            await this.transport.releaseConnection(this.connection)
        }
    }

    async send(): Promise<ProtocolSendResultInternal | undefined> {
        if (!this.transport) {
            throw new MissingDependencyError("client transport")
        }
        if (!this.request) {
            throw new ExpectationViolationError("request")
        }

        const writer = this.transport.getWriter(this.connection)
        
        // send lead chunk first, before racing sending of request body
        // and receiving of response.
        const leadChunk = CustomChunkedTransferCodec.createFromRequest(this.request)
        await new CustomChunkedTransferCodec().writeLeadChunk(writer, leadChunk, this.maxChunkSize)
        const reqTransferPromise = transferBodyToTransport(writer,
            this.maxChunkSize, this.request.body as any, leadChunk.contentLength)
        const resFetchPromise = this.startFetchingResponse()
        if (!await whenAnyPromiseSettles([reqTransferPromise, resFetchPromise])) {
            // let any request transfer exceptions terminate entire processing.
            await reqTransferPromise;
        }
        return await resFetchPromise
    }

    async startFetchingResponse() {
        const reader = this.transport.getReader(this.connection)
        const chunk = await new CustomChunkedTransferCodec().readLeadChunk(reader,
            this.maxChunkSize)
        if (!chunk) {
            if (this.ensureTruthyResponse) {
                throw new QuasiHttpRequestProcessingError("no response")
            }
            return undefined
        }
        const response = new DefaultQuasiHttpResponse()
        CustomChunkedTransferCodec.updateResponse(response, chunk)
        const releaseFunc = async () => this.transport.releaseConnection(this.connection)
        response.body = await createBodyFromTransport(
            reader, chunk.contentLength, releaseFunc,
            this.maxChunkSize, this.responseBufferingEnabled,
            this.responseBodyBufferingSizeLimit)
        
        return {
            response,
            responseBufferingApplied: this.responseBufferingEnabled
        } as ProtocolSendResultInternal
    }
}
