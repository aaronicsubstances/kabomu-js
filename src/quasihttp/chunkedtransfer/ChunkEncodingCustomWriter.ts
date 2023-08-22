import { Writable } from "stream";

import * as IOUtils from "../../common/IOUtils";
import { ChunkedTransferCodec } from "./ChunkedTransferCodec";
import { parseInt32 } from "../../common/ByteUtils";

/**
 * Constructs an instance of the standard chunk encoder of byte streams in the Kabomu library. Receives a writer
 * into which it writes an unknown number of one or more chunks, 
 * in which the last chunk has zero data length
 * and all the previous ones have non-empty data. The last zero-data chunk
 * is written only when writable.end() method is called.
 * @param wrappedWriter the backing writer through which
 * the encoded bytes will be sent
 * @param maxChunkSize maximum size of chunks. Must not exceed
 * the maximum signed 24-bit integer Can pass 0 to use a default value.
 * @returns a writable stream wrapper for encoding subsequent chunks (ie not lead chunks)
 * onto the provided underlying stream
 */
export function createChunkEncodingCustomWriter(wrappedWriter: Writable,
        maxChunkSize = 0) {
    if (!wrappedWriter) {
        throw new Error("wrappedWriter argument is null");
    }
    if (!maxChunkSize) {
        maxChunkSize = ChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE;
    }
    else {
        maxChunkSize = parseInt32(maxChunkSize);
        if (maxChunkSize <= 0) {
            maxChunkSize = ChunkedTransferCodec.DEFAULT_MAX_CHUNK_SIZE;
        }
    }
    if (maxChunkSize > ChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT) {
        throw new Error(`max chunk size cannot exceed ${ChunkedTransferCodec.HARD_MAX_CHUNK_SIZE_LIMIT}. ` +
            `received: ${maxChunkSize}`);
    }
    let buffer = Buffer.allocUnsafeSlow(maxChunkSize);
    let usedBufferOffset = 0;
    const encoder = new ChunkedTransferCodec();

    const writeAsync = async function(
            data: Buffer, offset: number, length: number, cb: any) {
        try {
            let bytesWritten = 0;
            while (bytesWritten < length) {
                bytesWritten += await writeNextSubsequentChunk(data,
                    offset + bytesWritten, length - bytesWritten);
            }
            cb();
        }
        catch (e) {
            cb(e);
        }
    };
    
    const writeNextSubsequentChunk = async function(
            data: Buffer, offset: number, length: number) {
        const chunkRem = Math.min(length, buffer.length - usedBufferOffset);
        if (usedBufferOffset + chunkRem < buffer.length) {
            // save data in buffer for later sending
            data.copy(buffer, usedBufferOffset, offset, offset + chunkRem);
            usedBufferOffset += chunkRem;
        }
        else {
            await encoder.encodeSubsequentChunkV1Header(
                buffer.length, wrappedWriter);

            // next empty buffer
            // NB: have to recreate buffer just in case it is
            // stored by underlying writer.
            await IOUtils.writeBytes(wrappedWriter,
                buffer.subarray(0, usedBufferOffset));
            buffer = Buffer.allocUnsafeSlow(buffer.length)
            usedBufferOffset = 0;

            // now directly transfer data to writer.
            await IOUtils.writeBytes(wrappedWriter,
                data.subarray(offset, offset + chunkRem));
        }
        return chunkRem;
    };

    const finalAsync = async function(cb: any) {
        try {
            // write out remaining data.
            // NB: have to recreate buffer just in case it is
            // stored by underlying writer.
            if (usedBufferOffset > 0) {
                await encoder.encodeSubsequentChunkV1Header(
                    usedBufferOffset, wrappedWriter);
                await IOUtils.writeBytes(wrappedWriter,
                    buffer.subarray(0, usedBufferOffset));
                buffer = Buffer.allocUnsafeSlow(buffer.length)
                usedBufferOffset = 0;
            }

            // end by writing out empty terminating chunk
            await encoder.encodeSubsequentChunkV1Header(0,
                wrappedWriter);
            cb();
        }
        catch (e) {
            cb(e);
        }
    };

    return new Writable({
        write(chunk: Buffer, encoding: any, callback: any) {
            writeAsync(chunk, 0, chunk.length, callback);
        },
        final(callback: any) {
            finalAsync(callback);
        }
    });
}
