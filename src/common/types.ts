import { Writable } from "stream";

export interface ICustomDisposable {
    customDispose(): Promise<void>
}

export interface ICustomWritable {
    writeTo(writer: Writable): Promise<void>
}
