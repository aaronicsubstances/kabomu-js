import { Duplex, PassThrough, Writable } from "stream";
import * as IOUtils from "../common/IOUtils";

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
        highWaterMark
    });
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
