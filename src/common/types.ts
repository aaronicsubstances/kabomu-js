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
 * Symbol representing a method which returns a promise of
 * a result of a Buffer chunk which has been read,
 * or null/undefined to indicate end of reading.
 */

export const customReaderSymbol = Symbol("customReader");

/**
 * Represents a source of bytes from which bytes can be read.
 * 
 * Intended to be a simpler alternative to the stream.Readable interface,
 * by supporting the customReaderSymbol.
 */
export interface ICustomReader {

    /**
     * Reads bytes from an instance.
     * @param count maximum number of bytes to read
     * @returns chunk of size not exceeding count,
     * or undefined/null to signal end of reading.
     */
    [customReaderSymbol](count: number): Promise<Buffer | undefined>
}

/**
 * Symbol representing a method which accepts a
 * a Buffer instance as chunk of data to write out,
 * and returns a promise indicating end of writing out
 * the buffer chunk.
 */
export const customWriterSymbol = Symbol("customWriter");

/**
 * Represents a destination of bytes to which bytes can be written.
 * 
 * Intended to be a simpler alternative to the stream.Writable interface,
 * by supporting the customWriterSymbol.
 */
export interface ICustomWriter {

    /**
     * Writes bytes to an instance.
     * @param chunk the source buffer of the bytes to be
     * fetched for writing to this instance
     */
    [customWriterSymbol](chunk: Buffer): Promise<void>
}

/**
 * Represents an instance that can transfer bytes by itself
 * to a destination of bytes.
 */
export interface ISelfWritable {

    /**
     * Transfers some byte representation of the instance to
     * a stream.
     * @param writer a writer object acceptable by
     * IOUtils.writeBytes(), which will receive the
     * byte representation of this instance
     */
    writeBytesTo(writer: any): Promise<void>
}

export interface IBlankChequePromise<T> {
    promise: Promise<T>
    resolve: (r: T) => void
    reject: (r: Error) => void
}
