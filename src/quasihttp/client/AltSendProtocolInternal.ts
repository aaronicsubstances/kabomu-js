import { ExpectationViolationError } from "../../common/errors";
import { DefaultQuasiHttpResponse } from "../DefaultQuasiHttpResponse";
import {
    createEquivalentOfUnknownBodyInMemory,
    getEnvVarAsBoolean
} from "../ProtocolUtilsInternal";
import { QuasiHttpRequestProcessingError } from "../errors";
import {
    IQuasiHttpAltTransport,
    IQuasiHttpResponse,
    ISendProtocolInternal,
    ProtocolSendResultInternal
} from "../types";
import * as QuasiHttpUtils from "../../../src/quasihttp/QuasiHttpUtils"

export class AltSendProtocolInternal implements ISendProtocolInternal {
    sendCancellationHandle?: any
    responsePromise: Promise<IQuasiHttpResponse | null>
    transportBypass: IQuasiHttpAltTransport
    responseBufferingEnabled?: boolean
    responseBodyBufferingSizeLimit?: number
    ensureNonNullResponse?: boolean

    constructor(options: {
                sendCancellationHandle?: any
                responsePromise: Promise<IQuasiHttpResponse | null>
                transportBypass: IQuasiHttpAltTransport
                responseBufferingEnabled?: boolean
                responseBodyBufferingSizeLimit?: number
                ensureNonNullResponse?: boolean
            }) {
        this.sendCancellationHandle = options?.sendCancellationHandle
        this.responsePromise = options?.responsePromise
        this.transportBypass = options?.transportBypass
        this.responseBufferingEnabled = options?.responseBufferingEnabled
        this.responseBodyBufferingSizeLimit = options?.responseBodyBufferingSizeLimit
        this.ensureNonNullResponse = options?.ensureNonNullResponse
    }

    async cancel(): Promise<void> {
        if (this.sendCancellationHandle) {
            // check for case in which transportBypass was incorrectly set to null.
            this.transportBypass?.cancelSendRequest(this.sendCancellationHandle);
        }
    }

    async send(): Promise<ProtocolSendResultInternal | null> {
        if (!this.responsePromise) {
            throw new ExpectationViolationError("responsePromise")
        }

        let response = await this.responsePromise

        if (!response) {
            if (this.ensureNonNullResponse) {
                throw new QuasiHttpRequestProcessingError("no response");
            }
            return null
        }
        
        // save for closing later if needed.
        const originalResponse = response;
        try {
            const originalResponseBufferingApplied = getEnvVarAsBoolean(
                response.environment, QuasiHttpUtils.RES_ENV_KEY_RESPONSE_BUFFERING_APPLIED)
            
            let responseBody = response.body
            let responseBufferingApplied = false
            if (responseBody && this.responseBufferingEnabled &&
                    originalResponseBufferingApplied !== true) {

                 // mark as applied here, so that if an error occurs,
                // closing will still be done.
                responseBufferingApplied = true

                // read response body into memory and create equivalent response for 
                // which release() operation is redundant.
                responseBody = await createEquivalentOfUnknownBodyInMemory(
                    responseBody, this.responseBodyBufferingSizeLimit)
                response = new DefaultQuasiHttpResponse({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    httpVersion: response.httpVersion,
                    httpStatusMessage: response.httpStatusMessage,
                    body: responseBody,
                    environment: response.environment
                })
            }

            if (!responseBody || originalResponseBufferingApplied === true ||
                    responseBufferingApplied) {
                // release original response.
                try {
                    await originalResponse.release();
                }
                catch (Exception) { } // ignore
            }

            return {
                response,
                responseBufferingApplied: originalResponseBufferingApplied === true ||
                    responseBufferingApplied
            } as ProtocolSendResultInternal
        }
        catch (e) {
            try {
                await originalResponse.release()
            }
            catch { } // ignore
            throw e
        }
    }

}