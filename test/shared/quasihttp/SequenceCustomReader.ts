import { Readable } from "stream";

export function createSequenceCustomReader(
        readers?: Array<Readable>): Readable {
    return Readable.from((async function*() {
        if (!readers) {
            return;
        }
        for (const reader of readers) {
            for await (const chunk of reader) {
                yield chunk
            }
        }
    })())
}