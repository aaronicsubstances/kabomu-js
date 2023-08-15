import { ICustomWritable } from "../../common/types";
import { IQuasiHttpBody } from "../types";

export function asReader(body: IQuasiHttpBody) {
    if (!body) {
        throw new Error("received null body argument");
    }
    const reader = body.reader;
    if (reader) {
        return reader
    }
    const memoryPipe = new MemoryPipeCustomReaderWriter();
    // use setImmediate so as to prevent deadlock if writable is
    // doing synchronous writes.
    setImmediate(() => exhaustWritable(body, memoryPipe));
    return memoryPipe;
}

async function exhaustWritable(writable: ICustomWritable ,
        memoryPipe: MemoryPipeCustomReaderWriter) {
    try {
        await writable.writeBytesTo(memoryPipe);
        await memoryPipe.endWrites();
    }
    catch (e) {
        await memoryPipe.endWrites(e);
    }
}