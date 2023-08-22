import { Readable, Writable } from "stream";
import {
    createMemoryPipeCustomReaderWriter,
    endWritesOnMemoryPipe
} from "../../common/MemoryPipeCustomReaderWriter";
import { ISelfWritable } from "../../common/types";
import { IQuasiHttpBody } from "../types";

/**
 * This function either returns a value from the getReader()
 * method of a  quasi http body if the value is not null,
 * or it sets up a readable stream to return the bytes
 * the body produces, by treating the body as a self writable.
 * @param body the quasi http body
 * @returns a stream which can be used to read bytes from the body
 */
export function getBodyReader(
        body: IQuasiHttpBody | null | undefined): Readable {
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

async function exhaustWritable(writable: ISelfWritable,
        memoryPipe: Writable) {
    try {
        await writable.writeBytesTo(memoryPipe);
        await endWritesOnMemoryPipe(memoryPipe);
    }
    catch (e) {
        await endWritesOnMemoryPipe(memoryPipe, e);
    }
}