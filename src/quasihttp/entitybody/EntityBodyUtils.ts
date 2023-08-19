import { Readable, Writable } from "stream";
import {
    createMemoryPipeCustomReaderWriter,
    endWritesOnMemoryPipe
} from "../../common/MemoryPipeCustomReaderWriter";
import { ICustomWritable } from "../../common/types";
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
        memoryPipe: Writable) {
    try {
        await writable.writeBytesTo(memoryPipe);
        await endWritesOnMemoryPipe(memoryPipe);
    }
    catch (e) {
        await endWritesOnMemoryPipe(memoryPipe, e);
    }
}