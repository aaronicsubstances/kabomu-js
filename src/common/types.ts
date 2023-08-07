import { Writable } from "stream";

export interface ICustomDisposable {
    close(): Promise<void>
}

export interface ICustomWritable extends ICustomDisposable {
    writeBytesTo(writer: Writable): Promise<void>
}
