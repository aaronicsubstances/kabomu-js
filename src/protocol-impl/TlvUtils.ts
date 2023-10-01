import { Readable, finished } from "stream";
import {
    ExpectationViolationError,
    KabomuIOError
} from "../errors";
import * as IOUtilsInternal from "../IOUtilsInternal";
import * as MiscUtilsInternal from "../MiscUtilsInternal";

export const TAG_FOR_QUASI_HTTP_HEADERS = 0x71683031;

export const TAG_FOR_QUASI_HTTP_BODY = 0x71623031;

export function encodeTagAndLengthOnly(tag: number,
        length: number) {
    if (!tag || tag < 0) {
        throw new Error(`invalid tag: ${tag}`)
    }
    if (length < 0) {
        throw new Error(`invalid tag value length: ${length}`)
    }
    const tagAndLen = Buffer.allocUnsafeSlow(8);
    MiscUtilsInternal.serializeInt32BE(tag, tagAndLen, 0);
    MiscUtilsInternal.serializeInt32BE(length, tagAndLen, 4);
    return tagAndLen;
}

export function generateEndOfTlvStream(tagToUse: number) {
    return encodeTagAndLengthOnly(tagToUse, 0)
}

export function decodeTag(data: Buffer, offset: number) {
    const tag = MiscUtilsInternal.deserializeInt32BE(
        data, offset);
    if (tag <= 0) {
        throw new KabomuIOError(`invalid tag: ${tag}`)
    }
    return tag;
}

export function decodeLength(data: Buffer, offset: number) {
    const decodedLength = MiscUtilsInternal.deserializeInt32BE(
        data, offset);
    if (decodedLength < 0) {
        throw new KabomuIOError("invalid tag value length: " +
            decodedLength)
    }
    return decodedLength;
}

export async function readTagOnly(inputStream: Readable,
        abortSignal?: AbortSignal) {
    const encodedTag = await IOUtilsInternal.readBytesFully(inputStream,
        4, abortSignal);
    return decodeTag(encodedTag, 0);
}

export async function readExpectedTagOnly(inputStream: Readable,
        expectedTag: number, abortSignal?: AbortSignal) {
    const tag = await readTagOnly(inputStream, abortSignal);
    if (tag !== expectedTag) {
        throw new KabomuIOError("unexpected tag: expected " +
            `${expectedTag} but found ${tag}`)
    }
}

export async function readLengthOnly(inputStream: Readable,
        abortSignal?: AbortSignal) {
    const encodedLen = await IOUtilsInternal.readBytesFully(
        inputStream, 4, abortSignal);
    return decodeLength(encodedLen, 0);
}

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
        let canReceiveMore = false;
        let outstanding: Buffer | undefined;
        if (chunk.length <= bytesLeft) {
            canReceiveMore = instance.push(chunk);
            bytesLeft -= chunk.length;
        }
        else {
            canReceiveMore = instance.push(chunk.subarray(0, bytesLeft));
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
        if (!canReceiveMore) {
            return {
                pauseSrc: true
            };
        }
    };
    const onEnd = (instance: Readable) => {
        if (bytesLeft) {
            const e = new KabomuIOError(`insufficient bytes available to satisfy ` +
                `content length of ${contentLength} bytes (could not read remaining ` +
                `${bytesLeft} bytes before end of read)`)
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

const DEFAULT_MAX_LENGTH  = 134_217_728;

/**
 * Wraps another readable stream to ensure a given amount of bytes
 * are not exceeded by reads.
 * @param backingStream the source stream.
 * @param maxLength the maximum number of bytes to read.
 * @returns a stream for enforcing any supplied content length
 */
export function createMaxLengthEnforcingStream(
        backingStream: Readable,
        maxLength?: number) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    if (!maxLength) {
        maxLength = DEFAULT_MAX_LENGTH 
    }
    else {
        maxLength = MiscUtilsInternal.parseInt32(maxLength);
        if (maxLength < 0) {
            throw new Error(
                `max length cannot be negative: ${maxLength}`)
        }
    }
    let bytesLeft = maxLength + 1; // check for excess read.
    const onData = (instance: Readable, chunk: Buffer) => {
        let canReceiveMore = false;
        let outstanding: Buffer | undefined;
        if (chunk.length <= bytesLeft) {
            canReceiveMore = instance.push(chunk);
            bytesLeft -= chunk.length;
        }
        else {
            canReceiveMore = instance.push(chunk.subarray(0, bytesLeft));
            outstanding = chunk.subarray(bytesLeft);
            bytesLeft = 0;
        }
        if (!bytesLeft) {
            throw new KabomuIOError(
                `reading of stream exceeds maximum size of ${maxLength} bytes`)
        }
        if (!canReceiveMore) {
            return {
                pauseSrc: true
            };
        }
    };
    const onEnd = (instance: Readable) => {
        instance.push(null);
    };
    return createReadableStreamDecorator(backingStream,
        onData, onEnd);
}

export function createTlvEncodingReadableStream(
        backingStream: Readable,
        tagToUse: number) {
    if (!backingStream) {
        throw new Error("backingStream argument is null");
    }
    const onData = (instance: Readable, chunk: Buffer) => {
        let canReceiveMore = instance.push(
            encodeTagAndLengthOnly(tagToUse, chunk.length))
        canReceiveMore &&= instance.push(chunk);
        if (!canReceiveMore) {
            return {
                pauseSrc: true
            };
        }
    };
    const onEnd = (instance: Readable) => {
        instance.push(generateEndOfTlvStream(tagToUse));
        instance.push(null);
    };
    return createReadableStreamDecorator(backingStream,
        onData, onEnd);
}

export function createTlvDecodingReadableStream(
        backingStream: Readable,
        expectedTag: number) {
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
            const concatenated = tryDecodeTagAndLength(
                expectedTag, chunks, temp);
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
        instance.destroy(KabomuIOError._createEndOfReadError());
    };
    return createReadableStreamDecorator(backingStream,
        onData, onEnd);
}
    
function tryDecodeTagAndLength(
        expectedTag: number,
        chunks: Array<Buffer>,
        result: Array<number>) {
    const totalLength = chunks.reduce((acc, chunk) => {
        return acc + chunk.length;
    }, 0);
    if (totalLength < 8) {
        return undefined;
    }
    const decodingBuffer = Buffer.concat(chunks);
    const decodedTag = decodeTag(
        decodingBuffer, 0)
    if (decodedTag !== expectedTag) {
        throw new KabomuIOError("unexpected tag: expected " +
            `${expectedTag} but found ${decodedTag}`);
    }
    result[0] = decodeLength(decodingBuffer, 4);
    result[1] = 8;
    return decodingBuffer;
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
        let done = false;
        let outstanding: Buffer | undefined;
        let pauseSrc = false;
        if (!Buffer.isBuffer(chunk)) {
            instance.destroy(
                IOUtilsInternal.createNonBufferChunkError(chunk))
            done = true;
        }
        if (!done) {
            try {
                const result = dataCb(instance, chunk);
                if (result) {
                    done = result.done;
                    outstanding = result.outstanding;
                    pauseSrc = result.pauseSrc;
                }
            }
            catch (e) {
                instance.destroy(e as any);
                done = true;
            }
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
        if (pauseSrc) {
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
