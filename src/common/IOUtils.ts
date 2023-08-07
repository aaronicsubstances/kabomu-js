import { Readable, Writable } from "stream"
import { CustomIOError } from "./errors"
import { ICustomWritable } from "./types"

/**
 * The limit of data buffering when reading byte streams into memory. Equal to 128 MB.
 */
export const DefaultDataBufferLimit = 65_536 * 2 * 1024

/**
 * The default read buffer size. Equal to 8,192 bytes.
 */
export const DefaultReadBufferSize = 8192

export async function closeStream(stream: Readable | Writable) {
    throw new Error("Function not implemented.")
}

export async function readBytes(reader: Readable, data: Buffer,
        offset: number, length: number): Promise<number> {
    throw new Error("Function not implemented.")
}

export async function writeBytesFully(writer: Writable, data: Buffer,
        offset: number, length: number): Promise<void> {
    throw new Error("Function not implemented.")
}

export async function readBytesFully(reader: Readable, data: Buffer,
        offset: number, length: number): Promise<void> {
    while (true) {
        const bytesRead = await readBytes(reader, data, offset, length)

        if (bytesRead < length) {
            if (bytesRead <= 0) {
                throw new Error("unexpected end of read")
            }
            offset += bytesRead
            length -= bytesRead
        }
        else {
            break
        }
    }
}

export async function readAllBytes(reader: Readable, bufferingLimit = 0,
        readBufferSize = 0): Promise<Buffer> {
    if (!bufferingLimit) {
        bufferingLimit = DefaultDataBufferLimit
    }
    if (!readBufferSize || readBufferSize < 0) {
        readBufferSize = DefaultReadBufferSize
    }
    const chunks = new Array<Buffer>()

    let totalBytesRead = 0

    while (true) {
        let bytesToRead = readBufferSize
        if (bufferingLimit >= 0) {
            bytesToRead = Math.min(bytesToRead, bufferingLimit - totalBytesRead)
        }
        // force a read of 1 byte if there are no more bytes to read into memory stream buffer
        // but still remember that no bytes was expected.
        let expectedEndOfRead = false
        if (!bytesToRead) {
            bytesToRead = 1
            expectedEndOfRead = true
        }
        const readBuffer = Buffer.allocUnsafe(readBufferSize)
        const bytesRead = await readBytes(reader, readBuffer, 0, bytesToRead)
        if (bytesRead > 0)
        {
            if (expectedEndOfRead) {
                throw CustomIOError.createDataBufferLimitExceededError(
                    bufferingLimit)
            }
            chunks.push(Buffer.from(readBuffer.buffer, 0, bytesRead))
            if (bufferingLimit >= 0) {
                totalBytesRead += bytesRead
            }
        }
        else
        {
            break
        }
    }
    await closeStream(reader)
    return Buffer.concat(chunks)
}

export async function copyBytes(reader: Readable, writer: Writable) {
    //reader.pipe(writer)
    //wait for piping to end?
    throw new Error("Function not implemented.")
}

/*export async function coalesceAsReader(reader?: Readable, fallback?: ICustomWritable) {
    if (reader || !fallback) {
        return reader
    }
    const memoryPipe = new MemoryPipeCustomReaderWriter()
    // don't wait
    memoryPipe.deferClose(async () => {
        try {
            await fallback.writeBytesTo(memoryPipe)
        }
        finally {
            await fallback.close()
        }
    })
    return memoryPipe
}*/