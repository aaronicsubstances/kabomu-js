import { MissingDependencyError } from "../../common/errors";
import { DefaultQuasiHttpRequest } from "../DefaultQuasiHttpRequest";
import { CustomChunkedTransferCodec } from "../chunkedtransfer/CustomChunkedTransferCodec";
import { QuasiHttpRequestProcessingError } from "../errors";
import {
    IQuasiHttpApplication,
    IQuasiHttpResponse,
    IQuasiHttpTransport,
    IReceiveProtocolInternal
} from "../types";
import {
    createBodyFromTransport,
    getEnvVarAsBoolean,
    transferBodyToTransport
} from "../ProtocolUtilsInternal";
import * as QuasiHttpUtils from "../../../src/quasihttp/QuasiHttpUtils"

export class DefaultReceiveProtocolInternal implements IReceiveProtocolInternal {
    application: IQuasiHttpApplication
    transport: IQuasiHttpTransport
    connection?: any
    maxChunkSize?: number
    requestEnvironment?: Map<string, any>

    constructor(options: {
                application: IQuasiHttpApplication
                transport: IQuasiHttpTransport
                connection?: any
                maxChunkSize?: number
                requestEnvironment?: Map<string, any>
            }) {
        this.application = options?.application
        this.transport = options?.transport
        this.connection = options?.connection
        this.maxChunkSize = options?.maxChunkSize
        this.requestEnvironment = options?.requestEnvironment
    }
    
    async cancel(): Promise<void> {
        // just in case transport was incorrectly set to null.
        if (this.transport)
        {
            await this.transport.releaseConnection(this.connection);
        }
    }

    async receive(): Promise<IQuasiHttpResponse | undefined> {
        if (!this.transport) {
            throw new MissingDependencyError("server transport")
        }
        if (!this.application) {
            throw new MissingDependencyError('server application')
        }

        const request = await this.readRequestLeadChunk()

        const response = await this.application.processRequest(request)
        if (!response) {
            throw new QuasiHttpRequestProcessingError("no response")
        }

        try
        {
            await this.transferResponseToTransport(response);
            return undefined;
        }
        finally
        {
            try {
                await response.release();
            }
            catch { } // ignore
        }
    }

    async readRequestLeadChunk() {
        const reader = this.transport.getReader(this.connection)
        const chunk = await new CustomChunkedTransferCodec().readLeadChunk(reader,
            this.maxChunkSize)
        if (!chunk) {
            throw new QuasiHttpRequestProcessingError("no request")
        }
        const request = new DefaultQuasiHttpRequest({
            environment: this.requestEnvironment
        })
        CustomChunkedTransferCodec.updateRequest(request, chunk)
        request.body = await createBodyFromTransport(
            reader, chunk.contentLength, undefined,
            this.maxChunkSize, false, 0);
        return request
    }

    async transferResponseToTransport(
            response: IQuasiHttpResponse) {
        if (getEnvVarAsBoolean(response.environment,
                QuasiHttpUtils.RES_ENV_KEY_SKIP_RESPONSE_SENDING) === true) {
            return;
        }

        const leadChunk = CustomChunkedTransferCodec.createFromResponse(response)
        const writer = this.transport.getWriter(this.connection)
        await new CustomChunkedTransferCodec().writeLeadChunk(
            writer, leadChunk, this.maxChunkSize)
        await transferBodyToTransport(writer, this.maxChunkSize,
            response.body as any, leadChunk.contentLength)
    }
}