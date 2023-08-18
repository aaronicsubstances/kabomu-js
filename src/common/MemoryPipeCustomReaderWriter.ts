import { Transform } from "stream";
import { MemoryPipeCustomReaderWriter } from "./types";
import * as IOUtils from "../common/IOUtils";

export function createMemoryPipeCustomReaderWriter(): MemoryPipeCustomReaderWriter {
    let writeEnded = false;
    let endOfReadAndWriteError: any;
    const obj = Object.assign(new Transform({
        transform(chunk: any, encoding: any, callback: any) {
            callback(endOfReadAndWriteError, chunk);
        }
    }), {
        async endWrites(e: any) {
            if (writeEnded) {
                return;
            }
            writeEnded = true;
            if (!e) {
                await IOUtils.endWrites(obj);
            }
            endOfReadAndWriteError = e;
        }
    });
    return obj;
}