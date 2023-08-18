import { Readable } from "stream";
import { createMemoryPipeCustomReaderWriter } from "../../common/MemoryPipeCustomReaderWriter";
import { ICustomWritable, MemoryPipeCustomReaderWriter } from "../../common/types";
import { IQuasiHttpBody } from "../types";

export function asReader(body: IQuasiHttpBody): Readable {
    if (!body) {
        throw new Error("received null body argument");
    }
    const reader = body.getReader();
    if (reader) {
        return reader
    }
    const memoryPipe = createMemoryPipeCustomReaderWriter();
    // use setImmediate so as to prevent deadlock if writable is
    // doing synchronous writes.
    setImmediate(() => exhaustWritable(body, memoryPipe));
    return memoryPipe;
}

async function exhaustWritable(writable: ICustomWritable,
        memoryPipe: MemoryPipeCustomReaderWriter) {
    try {
        await writable.writeBytesTo(memoryPipe);
        await memoryPipe.endWrites(null);
    }
    catch (e) {
        await memoryPipe.endWrites(e);
    }
}