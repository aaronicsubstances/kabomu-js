import { Writable } from "stream";

export class LeadChunk {
    /**
     * Current version of standard chunk serialization format.
     */
    static readonly Version01 = 1

    private _csvDataPrefix?: Buffer
    private _csvData?: Array<string[]>

    updateSerializedRepresentation() {
        throw new Error("Method not implemented.")
    }

    calculateSizeInBytesOfSerializedRepresentation(): number {
        throw new Error("Method not implemented.")
    }

    async writeOutSerializedRepresentation(writer: Writable): Promise<void> {
        throw new Error("Method not implemented.")
    }

    static deserialize(data: Buffer, offset: number, length: number): LeadChunk {
        throw new Error("Method not implemented.")
    }
}