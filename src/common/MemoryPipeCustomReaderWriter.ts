import { Transform } from "stream";
import { finished } from "node:stream/promises";

import { MemoryPipeCustomReaderWriter } from "./types";

export function createMemoryPipeCustomReaderWriter(): MemoryPipeCustomReaderWriter {
    let writeEnded = false;
    let endOfReadAndWriteError: any;
    const t = new Transform({
        transform(chunk: any, encoding: any, callback: any) {
            callback(endOfReadAndWriteError, chunk);
        }
    });
    const tExtension = {
        async endWrites(e: any) {
            if (writeEnded) {
                return;
            }
            writeEnded = true;
            endOfReadAndWriteError = e;
            const p = finished(t);
            t.destroy(e);
            await p;
        }
    };
    return Object.assign(t, tExtension);
}