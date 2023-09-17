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
        const result = dataCb(instance, chunk);
        if (result) {
            receiveMore = !result.pauseSrc;
            done = result.done;
            outstanding = result.outstanding;
        }
        if (done) {
            // done.
            instance.push(null);
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