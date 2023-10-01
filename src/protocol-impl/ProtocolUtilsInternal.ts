import { Readable, Writable } from "stream";
import { pipeline } from "stream/promises";
import * as QuasiHttpCodec from "./QuasiHttpCodec";
import {
    parseInt32, parseInt48
} from "../MiscUtilsInternal";
import * as TlvUtils from "./TlvUtils";
import {
    IQuasiHttpRequest,
    IQuasiHttpResponse,
    QuasiHttpConnection
} from "../types";
import {
    MissingDependencyError,
    QuasiHttpError
} from "../errors";
import { DefaultQuasiHttpResponse } from "../DefaultQuasiHttpResponse";
import { DefaultQuasiHttpRequest } from "../DefaultQuasiHttpRequest";

export function getEnvVarAsBoolean(
        environment: Map<string, any> | undefined,
        key: string) {
    if (environment && environment.has(key)) {
        const value = environment.get(key);
        if (value !== null && typeof value !== "undefined") {
            return !!value;
        }
    }
    return undefined;
}

export async function wrapTimeoutPromise(
        timeoutPromise: Promise<boolean>,
        timeoutMsg: string) {
    if (!timeoutPromise) {
        return;
    }
    if (await timeoutPromise) {
        throw new QuasiHttpError(timeoutMsg,
            QuasiHttpError.REASON_CODE_TIMEOUT);
    }
}

export async function writeEntityToTransport(
        isResponse: boolean,
        entity: any,
        writableStream: Writable | undefined,
        connection: QuasiHttpConnection) {
    if (!writableStream) {
        throw new MissingDependencyError(
            "no writable stream found for transport")
    }
    let body: Readable | undefined;
    let contentLength: number | undefined;
    let reqOrStatusLine: any
    let headers: Map<string, string[]> | undefined
    if (isResponse) {
        const response = entity as IQuasiHttpResponse
        headers = response.headers
        body = response.body
        contentLength = response.contentLength
        reqOrStatusLine = [
            response.statusCode || 0,
            response.httpStatusMessage,
            response.httpVersion,
            undefined
        ]
    }
    else {
        const request = entity as IQuasiHttpRequest
        headers = request.headers
        body = request.body
        contentLength = request.contentLength
        reqOrStatusLine = [
            request.httpMethod,
            request.target,
            request.httpVersion,
            undefined
        ]
    }
    if (!contentLength) {
        contentLength = body ? -1 : 0;
    }
    reqOrStatusLine[3] = contentLength
    await QuasiHttpCodec.writeQuasiHttpHeaders(
        writableStream, reqOrStatusLine, headers,
        connection.processingOptions?.maxHeadersSize,
        connection.abortSignal)
    if (!body) {
        return;
    }
    if (contentLength < 0) {
        const encodedBody = TlvUtils.createTlvEncodingReadableStream(
            body, QuasiHttpCodec.TAG_FOR_BODY)
        await pipeline(encodedBody, writableStream, {
            end: false,
            signal: connection.abortSignal
        })
    }
    else {
        // don't enforce positive content lengths when writing out
        // quasi http bodies
        await pipeline(body, writableStream, {
            end: false,
            signal: connection.abortSignal
        })
    }
}

export async function readEntityFromTransport(
        isResponse: boolean,
        readableStream: Readable | undefined,
        connection: QuasiHttpConnection)
        : Promise<IQuasiHttpRequest | IQuasiHttpResponse> {
    if (!readableStream) {
        throw new MissingDependencyError(
            "no readable stream found for transport");
    }
    const headersReceiver = new Map<string, string[]>()
    const reqOrStatusLine = await QuasiHttpCodec.readQuasiHttpHeaders(
        readableStream,
        headersReceiver,
        connection.processingOptions?.maxHeadersSize,
        connection.abortSignal)
    if (reqOrStatusLine.length < 4) {
        throw new QuasiHttpError(
            `invalid quasi http ${(isResponse ? "status" : "request")} line`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION)
    }
    let contentLength = 0;
    try {
        contentLength = parseInt48(reqOrStatusLine[3])
    }
    catch (e) {
        throw new QuasiHttpError(
            `invalid quasi http ${(isResponse ? "response" : "request")} content length`,
            QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
            { cause: e })
    }
    let body: Readable | undefined
    if (contentLength) {
        if (contentLength > 0) {
            body = TlvUtils.createContentLengthEnforcingStream(
                readableStream, contentLength)
        }
        else {
            body = TlvUtils.createTlvDecodingReadableStream(
                readableStream, QuasiHttpCodec.TAG_FOR_BODY)
        }
    }
    if (isResponse) {
        const response = new DefaultQuasiHttpResponse()
        try {
            response.statusCode = parseInt32(
                reqOrStatusLine[0])
        }
        catch (e) {
            throw new QuasiHttpError(
                "invalid quasi http response status code",
                QuasiHttpError.REASON_CODE_PROTOCOL_VIOLATION,
                { cause: e })
        }
        response.httpStatusMessage = reqOrStatusLine[1]
        response.httpVersion = reqOrStatusLine[2]
        response.headers = headersReceiver
        if (body) {
            const bodySizeLimit = connection.processingOptions?.maxResponseBodySize
            if (!bodySizeLimit || bodySizeLimit > 0) {
                body = TlvUtils.createMaxLengthEnforcingStream(body,
                    bodySizeLimit)
            }
        }
        response.body = body
        return response
    }
    else {
        const request = new DefaultQuasiHttpRequest({
            environment: connection.environment
        })
        request.httpMethod = reqOrStatusLine[0]
        request.target = reqOrStatusLine[1]
        request.httpVersion = reqOrStatusLine[2]
        request.headers = headersReceiver
        request.body = body
        return request
    }
}