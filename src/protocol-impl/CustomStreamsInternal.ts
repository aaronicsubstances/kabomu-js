import { Readable, finished } from "stream";
import {
    ExpectationViolationError,
    KabomuIOError
} from "../errors";
import * as IOUtilsInternal from "../IOUtilsInternal";
import * as MiscUtilsInternal from "../MiscUtilsInternal";
import { BodyChunkEncodingWriter } from "./BodyChunkEncodingWriter";

/**
 * Wraps another readable stream to ensure a given amount of bytes are read.
 * @param backingStream the source stream.
 * @param contentLength the expected number of bytes to guarantee or assert.
 * @returns a stream for enforcing any supplied content length
 */
export function createContentLengthEnforcingStream(
        backingStream: Readable,
        contentLength: number) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    contentLength = MiscUtilsInternal.parseInt48(contentLength);
    if (contentLength < 0) {
        throw new Error(
            `content length cannot be negative: ${contentLength}`)
    }
    let bytesLeft = contentLength;
    const onData = (instance: Readable, chunk: Buffer) => {
        let receiveMore = false;
        let outstanding: Buffer | undefined;
        if (chunk.length <= bytesLeft) {
            receiveMore = instance.push(chunk);
            bytesLeft -= chunk.length;
        }
        else {
            receiveMore = instance.push(chunk.subarray(0, bytesLeft));
            outstanding = chunk.subarray(bytesLeft);
            bytesLeft = 0;
        }
        if (!bytesLeft) {
            // done.
            instance.push(null);
            return {
                done: true,
                outstanding
            };
        }
        if (!receiveMore) {
            return {
                pauseSrc: true
            };
        }
    };
    const onEnd = (instance: Readable) => {
        if (bytesLeft) {
            const e = KabomuIOError.createContentLengthNotSatisfiedError(
                contentLength, bytesLeft);
            instance.destroy(e);
        }
        else {
            if (contentLength) {
                instance.destroy(new ExpectationViolationError(
                    "expected content length to be " +
                    `zero but found ${contentLength}`));
            }
            else {
                instance.push(null);
            }
        }
    };
    return createReadableStreamDecorator(backingStream,
        onData, onEnd);
}

export function createBodyChunkEncodingStream(
        backingStream: Readable) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    const bodyChunkEncoder = new BodyChunkEncodingWriter();
    const onData = (instance: Readable, chunk: Buffer) => {
        let receiveMore = true;
        for (const c of bodyChunkEncoder.generateBodyChunks(chunk)) {
            receiveMore &&= instance.push(c);
        }
        if (!receiveMore) {
            return {
                pauseSrc: true
            };
        }
    };
    const onEnd = (instance: Readable) => {
        instance.push(bodyChunkEncoder.generateEndBodyChunk());
        instance.push(null);
    };
    return createReadableStreamDecorator(backingStream,
        onData, onEnd);
}

export function createBodyChunkDecodingStream(
        backingStream: Readable) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    const chunks = new Array<Buffer>();
    const temp = [0, 0];
    let isDecodingHeader = true;
    let outstandingDataLength = 0;
    const onData = (instance: Readable, chunk: Buffer) => {
        let canReceiveMore = true;
        if (!isDecodingHeader) {
            const chunkLengthToUse = Math.min(
                outstandingDataLength, chunk.length);
            if (chunkLengthToUse > 0) {
                const nextChunk = chunk.subarray(0,
                    chunkLengthToUse);
                canReceiveMore &&= instance.push(nextChunk);
                outstandingDataLength -= chunkLengthToUse;
            }
            if (chunkLengthToUse < chunk.length) {
                const carryOverChunk = chunk.subarray(
                    chunkLengthToUse);
                chunks.push(carryOverChunk);
                isDecodingHeader = true;
                // proceed to loop
            }
            else {
                if (!outstandingDataLength) {
                    // chunk exactly fulfilled outstanding
                    // data length.
                    isDecodingHeader = true;
                    // return or proceed to loop,
                    // it doesn't matter, as chunks should
                    // be empty.
                    if (chunks.length) {
                        throw new ExpectationViolationError(
                            "expected chunks to be empty at this point")
                    }
                }
                else {
                    // need to read more chunks to fulfil
                    // chunk data length.
                }
                return {
                    pauseSrc: !canReceiveMore
                };
            }
        }
        else {
            chunks.push(chunk);
        }
        while (true) {
            let concatenated: Buffer | undefined;
            try {
                concatenated = BodyChunkEncodingWriter._tryDecodeBodyChunkV1Header(
                    chunks, temp);
            }
            catch (e) {
                throw new KabomuIOError(
                    "Failed to decode quasi http body while " +
                    "reading body chunk header",
                    { cause: e });
            }
            if (!concatenated) {
                // need to read more chunks to fulfil
                // chunk header length.
                break;
            }
            chunks.length = 0; // clear
            outstandingDataLength = temp[0];
            let concatenatedLengthUsed = temp[1];
            if (!outstandingDataLength) {
                // done.
                instance.push(null);
                let unshift: Buffer | undefined;
                if (concatenatedLengthUsed < concatenated.length) {
                    unshift = concatenated.subarray(
                        concatenatedLengthUsed);
                }
                return {
                    done: true,
                    outstanding: unshift
                };
            }
            const nextChunkLength = Math.min(
                outstandingDataLength,
                concatenated.length - concatenatedLengthUsed);
            if (nextChunkLength) {
                const nextChunk = concatenated.subarray(
                    concatenatedLengthUsed,
                    nextChunkLength + concatenatedLengthUsed);
                canReceiveMore &&= instance.push(nextChunk);
                outstandingDataLength -= nextChunkLength;
                concatenatedLengthUsed += nextChunkLength;
            }
            if (concatenatedLengthUsed < concatenated.length) {
                // can't read more chunks yet, because there are
                // more stuff inside concatenated
                const carryOverChunk = concatenated.subarray(
                    concatenatedLengthUsed);
                chunks.push(carryOverChunk);
            }
            else {
                if (outstandingDataLength) {
                    // need to read more chunks to fulfil
                    // chunk data length.
                    isDecodingHeader = false;
                }
                else {
                    // chunk exactly fulfilled outstanding
                    // data length.
                    // So start decoding header again.
                }
                // in any case need to read more chunks.
                break;
            }
        }
        if (!canReceiveMore) {
            return {
                pauseSrc: true
            };
        }
    };
    const onEnd = (instance: Readable) => {
        if (isDecodingHeader) {
            if (chunks.length) {
                const e = new KabomuIOError(
                    "Failed to decode quasi http body while " +
                    "reading body chunk header: unexpected end of read");
                instance.destroy(e);
            }
            else {
                const e = new KabomuIOError(
                    "Failed to decode quasi http body: " +
                    "missing final empty chunk");
                instance.destroy(e);
            }
        }
        else {
            const e = new KabomuIOError(
                "Failed to decode quasi http body while " +
                "reading body chunk data: unexpected end of read");
            instance.destroy(e);
        }
    };
    return createReadableStreamDecorator(backingStream,
        onData, onEnd);
}

function createReadableStreamDecorator(
        backingStream: Readable,
        dataCb: any,
        endCb: any) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    const onReadable = () => {};
    backingStream.on("readable", onReadable);
    const instance = new Readable({
        emitClose: false,
        objectMode: false,
        read(size) {
            // resume.
            backingStream.removeListener("readable", onReadable);
        }
    });
    const successIndicator = new AbortController();
    const onData = (chunk: Buffer) => {
        if (!Buffer.isBuffer(chunk)) {
            backingStream.destroy(
                IOUtilsInternal.createNonBufferChunkError(chunk))
            return;
        }
        let receiveMore = true;
        let outstanding: Buffer | undefined;
        let done = false;
        let result: any;
        try {
            result = dataCb(instance, chunk);
        }
        catch (e) {
            instance.destroy(e as any);
            done = true;
        }
        if (result) {
            receiveMore = !result.pauseSrc;
            done = result.done;
            outstanding = result.outstanding;
        }
        if (done) {
            if (outstanding) {
                // ensure absence of readable and data
                // listeners before unshifting.
                backingStream.removeListener("data", onData);
                backingStream.unshift(outstanding);
            }

            // stop flow of underlying stream before
            // finishing reads from instance.
            backingStream.on("readable", onReadable);
            
            successIndicator.abort();
            return;
        }
        if (!receiveMore) {
            // pause.
            backingStream.on("readable", onReadable);
        }
    };
    backingStream.on("data", onData);
    const finishedOptions = {
        signal: successIndicator.signal
    };
    const cleanup = finished(backingStream, finishedOptions, e => {
        cleanup();
        // stop flow of underlying stream first.
        backingStream.removeListener("data", onData);
        backingStream.removeListener("readable", onReadable);

        if (e && successIndicator.signal.aborted) {
            return;
        }

        if (e) {
            instance.destroy(e);
        }
        else {
            endCb(instance);
        }
    });
    return instance;
}