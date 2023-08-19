import { Duplex, Writable } from "stream";

export interface ICustomDisposable {
    release(): Promise<void>
}

export interface ICustomWritable {
    writeBytesTo(writer: Writable): Promise<void>
}
