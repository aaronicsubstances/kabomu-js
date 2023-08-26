import { Writable } from "stream";

/**
 * Common interface of instances in Kabomu library which perform
 * resource clean-up operations.
 */
export interface ICustomDisposable {

    /**
     * Performs any needed clean up operation on resources held
     * by the instance.
     */
    release(): Promise<void>
}

/**
 * Represents an instance that can transfer bytes by itself
 * to a destination of bytes.
 */
export interface ISelfWritable {

    /**
     * Transfers some byte representation of the instance to
     * a stream.
     * @param writer writable stream which will receive the
     * byte representation of this instance
     */
    writeBytesTo(writer: Writable): Promise<void>
}

export interface IPendingPromiseInternal<T> {
    promise: Promise<T>
    resolve: (r: T) => void
    reject: (r: Error) => void
}
