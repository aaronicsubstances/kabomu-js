import { CustomIOError } from "./errors";
import {
    IBlankChequePromise,
    customReaderSymbol,
    customWriterSymbol
} from "./types";
import { createBlankChequePromise, parseInt32 } from "./MiscUtils";
import { createNonBufferChunkError } from "./IOUtils";

const endWritesSymbol = Symbol("endWrites")

interface ReadRequest {
    readCount: number,
    callback: IBlankChequePromise<Buffer | undefined>
}

interface WriteRequest {
    chunk: Buffer,
    offset: number,
    length: number,
    callback: IBlankChequePromise<void>
}

/**
 * Returns an implementation of stream.Readable which also
 * supports writing by supporting the customWriterSymbol.
 * This is based on a "pipe" of bytes where writes at one end
 * become reads at the other end.
 *
 * The endWritesOnMemoryPipe() function in this module
 * is the means of ending reading and writing, possibly
 * with error.
 *
 * This notion of pipe is purely implemented in memory with stream.PassThrough,
 * and is similar to (but not based on)
 * OS named pipes, OS anonymous pipes and OS shell pipes.
 */
export function createMemoryPipeCustomReaderWriter() {
    const readRequests = new Array<ReadRequest>()
    const writeRequests = new Array<WriteRequest>()
    let endOfReadWrite = false
    let endOfReadError: any
    let endOfWriteError: any;
    const highWaterMark = 1;
    
    const matchPendingWriteAndRead = function() {
        const pendingRead = readRequests[0]
        const pendingWrite = writeRequests[0]
        const bytesToReturn = Math.min(
            pendingRead.readCount, pendingWrite.length)
        let dataToReturn = pendingWrite.chunk
        if (pendingWrite.offset !== 0 ||
                bytesToReturn !== dataToReturn.length) {
            dataToReturn = dataToReturn.subarray(
                pendingWrite.offset,
                pendingWrite.offset + bytesToReturn)
        }

        // do not invoke callbacks until state is updated,
        // to prevent error of re-entrant read byte requests
        // matching previous writes.
        readRequests.shift()
        //let resolveWrite = false
        if (bytesToReturn < pendingWrite.length) {
            // due to potential storage downstream,
            // copy new chunk to return.
            dataToReturn = Buffer.from(dataToReturn)
            pendingWrite.offset += bytesToReturn
            pendingWrite.length -= bytesToReturn
        }
        else {
            writeRequests.shift()
            pendingWrite.callback.resolve()
        }
        pendingRead.callback.resolve(dataToReturn)
    };

    const readAsync = async function(count: number) {
        // respond immediately if writes have ended
        if (endOfReadWrite) {
            if (endOfReadError) {
                throw endOfReadError;
            }
            return undefined;
        }

        count = parseInt32(count)
        if (count < 0) {
            throw new Error("count argument cannot be negative: " + count)
        }

        // wait for writes even if zero bytes were requested.
        const readRequest: ReadRequest = {
            callback: createBlankChequePromise(),
            readCount: count
        };
        readRequests.push(readRequest);

        const readPromise = readRequest.callback.promise;

        if (writeRequests.length > 0) {
            matchPendingWriteAndRead()
        }

        return await readPromise
    };

    const writeAsync = async function(chunk: Buffer) {
        if (endOfReadWrite) {
            throw endOfWriteError;
        }

        if (!Buffer.isBuffer(chunk)) {
            throw createNonBufferChunkError(chunk)
        }

        // don't store any zero-byte write
        if (chunk.length === 0) {
            return;
        }

        // check for high water mark.
        // this setting should apply to only existing pending writes,
        // so as to ensure that
        // a write can always be attempted the first time,
        // and one doesn't have to worry about high water mark
        // if one is performing serial writes.
        const totalOutstandingWriteBytes =
            writeRequests.reduce((acc, curr) => {
                return acc + curr.length
            }, 0);
        if (totalOutstandingWriteBytes >= highWaterMark) {
            throw new CustomIOError("cannot perform further writes " +
                "due to high water mark setting");
        }

        const writeRequest: WriteRequest = {
            chunk,
            offset: 0,
            length: chunk.length,
            callback: createBlankChequePromise()
        }
        writeRequests.push(writeRequest)

        const writePromise = writeRequest.callback.promise

        if (readRequests.length > 0) {
            matchPendingWriteAndRead()
        }

        await writePromise
    };

    const endWrites = function(e: any) {
        if (endOfReadWrite) {
            return;
        }
        endOfReadWrite = true
        endOfReadError = e
        if (e) {
            endOfWriteError = e
        }
        else {
            endOfWriteError = new CustomIOError("end of write")
        }
        for (const readRequest of readRequests) {
            if (endOfReadError) {
                readRequest.callback.reject(endOfReadError)
            }
            else {
                readRequest.callback.resolve(undefined)
            }
        }
        for (const writeRequest of writeRequests) {
            writeRequest.callback.reject(endOfWriteError)
        }
        readRequests.length = 0
        writeRequests.length = 0
    }
    const instance = {
        [customReaderSymbol]: readAsync,
        [customWriterSymbol]: writeAsync,
        [endWritesSymbol]: endWrites
    }
    return instance
}

/**
 * Causes pending and future read and writes to be aborted with a
 * supplied error instance (pending and future reads will return empty
 * if no error is supplied).
 * @param instance instance returned by the
 * createMemoryPipeCustomReaderWriter() function in this module
 * @param error optional error instance for ending read and writes.
 * If null, then pending and future writes will be made to fail, and
 * pending and future reads will simply return empty
 */
export async function endWritesOnMemoryPipe(
        instance: any, error?: any) {
    if (!instance) {
        throw new Error("instance argument is null")
    }
    const anyInst = instance as any;
    if (!anyInst[endWritesSymbol]) {
        throw new Error("instance argument is not a " +
            "MemoryPipeCustomReaderWriter()")
    }
    anyInst[endWritesSymbol](error)
}
