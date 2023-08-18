import { Writable } from "stream";

import * as IOUtils from "../../common/IOUtils";
import { ChunkedTransferUtils } from "./ChunkedTransferUtils";

export function createChunkEncodingCustomWriter(wrappedWriter: Writable,
        maxChunkSize = 0) {
    const buffer = Buffer.allocUnsafeSlow(maxChunkSize);
    let usedBufferOffset = 0;
    const chunkTransferUtils = new ChunkedTransferUtils();
    
    const writeNextSubsequentChunk = async function(
            data: Buffer, offset: number, length: number) {
            const chunkRem = Math.min(length, buffer.length - usedBufferOffset);
        if (usedBufferOffset + chunkRem < buffer.length) {
            // save data in buffer for later sending
            data.copy(buffer, usedBufferOffset, offset, offset + chunkRem);
            usedBufferOffset += chunkRem;
        }
        else {
            await chunkTransferUtils.encodeSubsequentChunkV1Header(
                buffer.length, wrappedWriter);

            // next empty buffer
            await IOUtils.writeBytes(wrappedWriter, buffer, 0,
                usedBufferOffset);
            usedBufferOffset = 0;

            // now directly transfer data to writer.
            await IOUtils.writeBytes(wrappedWriter, data, offset, chunkRem);
        }
        return chunkRem;
    };
        
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

    const finalAsync = async function(cb: any) {
        try {
            // write out remaining data.
            if (usedBufferOffset > 0) {
                await chunkTransferUtils.encodeSubsequentChunkV1Header(
                    usedBufferOffset, wrappedWriter);
                await IOUtils.writeBytes(wrappedWriter, buffer, 0, usedBufferOffset);
                usedBufferOffset = 0;
            }

            // end by writing out empty terminating chunk
            await chunkTransferUtils.encodeSubsequentChunkV1Header(0,
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
