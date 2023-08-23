import { Readable, Writable } from "stream";
import { IQuasiHttpBody } from "../types";
import { ISelfWritable } from "../../common/types";
import * as IOUtils from "../../common/IOUtils";
import { MissingDependencyError } from "../../common/errors";

/**
 * Helper class providing a default quasi http body implementation,
 * in which a stream is fetched from the getReader() method, and
 * copied over to the stream supplied by the writeBytesTo() method.
 */
export class LambdaBasedQuasiHttpBody implements IQuasiHttpBody {
    contentLength = -1;

    /**
     * Implementation of ISelfWritable to which entire
     * implementation of writeBytesTo() can be delegated to.
     * Default implementation kicks in only if this property is null.
     */
    selfWritable?: ISelfWritable;

    /**
     * Lambda function which can be used to release resources.
     */
    releaseFunc?: (() => Promise<void>) | undefined;

    /**
     * Lambda function which can be used to provide a
     * fallback readable stream, to support default
     * implementation for writeBytesTo() method.
     */
    readerFunc?: () => Readable | undefined;

    /**
     * Creates a new instance and initializes the contentLength
     * property to -1.
     * @param readerFunc value for readerFunc property
     * @param selfWritable value for selfWritable property
     */
    constructor(readerFunc?: any, selfWritable?: any) {
        this.readerFunc = readerFunc;
        this.selfWritable = selfWritable;
    }

    /**
     * Returns value returned by invoking readerFunc property.
     * Returns null if readerFunc property is null.
     */
    getReader(): Readable | undefined {
        if (this.readerFunc) {
            return this.readerFunc();
        }
    }

    /**
     * Invokes releaseFunc property.
     * Nothing is done if releaseFunc property is null.
     */
    async release() {
        if (this.releaseFunc) {
            this.releaseFunc();
        }
    }

    /**
     * Invokes the writable property, and
     * if that property is null, falls back to copying over
     * value retrieved from the getReader() method to supplied writer.
     * 
     * A MissingDependencyError is thrown if the getReader() method
     * property returns null for use as fallback.
     * @param writer the writer which will be the destination of
     * the bytes to be written.
     */
    async writeBytesTo(writer: Writable) {
        if (this.selfWritable) {
            await this.selfWritable.writeBytesTo(writer);
            return;
        }
        const reader = this.getReader();
        if (!reader) {
            throw new MissingDependencyError(
                "received null from getReader()");
        }
        await IOUtils.copyBytes(reader, writer);
    }
}