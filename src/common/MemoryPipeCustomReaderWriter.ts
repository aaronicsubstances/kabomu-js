import { Duplex, PassThrough, Writable } from "stream";
import * as IOUtils from "../common/IOUtils";
import { CustomIOError } from "./errors";

export function createMemoryPipeCustomReaderWriter(
        highWaterMark?: number): Duplex {
    return new PassThrough({
        highWaterMark
    });
}

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
