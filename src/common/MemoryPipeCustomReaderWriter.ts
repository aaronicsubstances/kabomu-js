import { Duplex, PassThrough, Writable } from "stream";
import * as IOUtils from "../common/IOUtils";
import { CustomIOError } from "./errors";

const endWritesSymbol = Symbol("endWrites")

/**
 * Returns an implementation of readable and writable
 * stream interfaces which is based on a "pipe" of bytes,
 * where writes at one end become reads at the other end.
 *
 * The endWritesOnMemoryPipe() function in this module
 * is the means of ending reading and writing, possibly
 * with error. It is like calling writable.end() but allows
 * for passing in an error which will cause pending and future
 * reads to fail.
 *
 * This notion of pipe is purely implemented in memory with stream.PassThrough,
 * and is similar to (but not based on)
 * OS named pipes, OS anonymous pipes and OS shell pipes.
 *
 * @param highWaterMark optional value which determines how many
 * bytes writes can accept before draining by reads have to occur.
 * Same as the highWaterMark property of the options object
 * acceptable by stream.PassThrough.
 * @returns stream.PassThrough instance repurposed as a
 * "memory pipe".
 */
export function createMemoryPipeCustomReaderWriter(
        highWaterMark?: number): Duplex {
    return new PassThrough({
        highWaterMark: 1
    });
    /*const readRequests = new Array<ReadWriteRequest>()
    const writeRequests = new Array<ReadWriteRequest>()
    let endOfReadWrite = false
    let endOfReadError: any
    let endOfWriteError: any;
    const highWaterMark = 1;
    
    const matchPendingWriteAndRead = function(instance: any) {
        const pendingWrite = writeRequests[0]
        readRequests.shift()
        writeRequests.shift()
        pendingWrite.callback()
        instance.push(pendingWrite.chunk)
    };

    const instance: any = new Duplex({
        highWaterMark: 1,
        read(size) {
            // respond immediately if writes have ended
            if (endOfReadWrite) {
                if (endOfReadError) {
                    this.destroy(endOfReadError);
                }
                else {
                    this.push(null);
                }
                return;
            }

            // wait for writes even if zero bytes were requested.
            const readRequest: ReadWriteRequest = {};
            readRequests.push(readRequest);
            if (writeRequests.length > 0) {
                matchPendingWriteAndRead(this);
            }
        },
        write(chunk, encoding, cb) {
            if (endOfReadWrite) {
                cb(endOfWriteError);
                return;
            }

            // don't store any zero-byte write
            if (chunk.length == 0) {
                cb()
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
                    return acc + curr.chunk.length
                }, 0);
            if (totalOutstandingWriteBytes >= highWaterMark) {
                const e = new CustomIOError("cannot perform further writes " +
                    "due to high water mark setting");
                cb(e);
                return;
            }

            const writeRequest: ReadWriteRequest = {
                chunk,
                callback: cb
            }
            writeRequests.push(writeRequest)

            if (readRequests.length > 0) {
                matchPendingWriteAndRead(this)
            }
        },
        final(cb) {
            let instAny: any = this;
            instAny[endWritesSymbol]()
            cb()
        },
    });
    instance[endWritesSymbol] = function(e: any) {
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
            // not using readRequest is not a problem
            // since there is only at most one of them.
            if (endOfReadError) {
                instance.destroy(endOfReadError)
            }
            else {
                instance.push(null)
            }
        }
        for (const writeRequest of writeRequests) {
            writeRequest.callback(endOfWriteError)
        }
        readRequests.length = 0
        writeRequests.length = 0
    }
    return instance*/
}

interface ReadWriteRequest {
    chunk?: any,
    callback?: any
}

/**
 * Causes pending and future read and writes to be aborted with a
 * supplied exception instance (pending and future reads will return 0
 * if no exception is supplied).
 * @param instance instance returned by the
 * createMemoryPipeCustomReaderWriter() function in this module
 * @param error optional exception instance for ending read and writes.
 * If null, then pending and future writes will be made to fail, and
 * pending and future reads will simply return 0
 */
export async function endWritesOnMemoryPipe(
        instance: Writable, error?: any) {
    if (instance.errored || instance.writableEnded) {
        return;
    }
    if (!error) {
        await IOUtils.endWrites(instance);
        return;
    }
    /*const anyInst: any = instance
    anyInst[endWritesSymbol](error)*/
    instance.destroy(error);
    try {
        await IOUtils.endWrites(instance);
    }
    catch {
        // ignore since error is really meant
        // for future write and read attempts,
        // rather than for this call.
    }
}
