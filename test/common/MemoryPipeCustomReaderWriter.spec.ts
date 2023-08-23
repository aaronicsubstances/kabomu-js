import nativeAssert from "assert/strict"
const { assert } = require('chai').use(require('chai-bytes'))

import * as ByteUtils from "../../src/common/ByteUtils"
import * as IOUtils from "../../src/common/IOUtils"
import {
    createMemoryPipeCustomReaderWriter,
    endWritesOnMemoryPipe
} from "../../src/common/MemoryPipeCustomReaderWriter"
import { createRandomizedReadSizeBufferReader } from "../shared/common/RandomizedReadSizeBufferReader"
import {
    createDelayPromise,
} from "../shared/common/ComparisonUtils"
import {
    whenAnyPromiseSettles
} from "../../src/common/MiscUtilsInternal"

describe("MemoryPipeCustomReaderWriter", function() {
    const testData = [
        "", "achievers", "database."
    ]
    testData.forEach((expected, i) => {
        it(`should pass with input ${i}`, async function() {
            // arrange
            const initialReader = createRandomizedReadSizeBufferReader(
                ByteUtils.stringToBytes(expected))
            const instance = createMemoryPipeCustomReaderWriter()

            // act
            const p1 = IOUtils.readAllBytes(instance)
            const p2 = (async function() {
                await IOUtils.copyBytes(initialReader, instance)
                await endWritesOnMemoryPipe(instance)
            })()

            // Leverage default mocha test timeout,
            // to deal with any error which may cause p1 or p2
            // to hang forever.
            await Promise.all([p1, p2])

            const actual = ByteUtils.bytesToString(await p1)
            assert.equal(actual, expected)
        })
    })

    it("should pass internals test (1)", async function() {
        // NB: test depends on highWaterMark values in the range
        // of [1, 2]
        const instance = createMemoryPipeCustomReaderWriter(1)
        const readBuffer = Buffer.alloc(3)
        let readPromise = IOUtils.readBytes(instance, readBuffer)

        await IOUtils.writeBytes(instance, Buffer.from([4, 5, 6]))
        let readLen = await readPromise;
        assert.equal(readLen, 3)
        assert.equalBytes(readBuffer, Buffer.from([4, 5, 6]))

        readPromise = IOUtils.readBytes(instance,
            readBuffer.subarray(0, 0))

        await IOUtils.writeBytes(instance, Buffer.alloc(0))

        let delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([readPromise, delayPromise]),
            1)

        let writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6]))
        delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            0)
        writePromise = IOUtils.writeBytes(instance,
            Buffer.from([8]))
        delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            1)
        readLen = await readPromise
        assert.equal(readLen, 0)

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(0, 3))
        assert.equal(readLen, 3)
        assert.equalBytes(readBuffer.subarray(0, readLen),
            Buffer.from([2, 4, 6]))

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(1, 3))
        assert.equal(readLen, 1)
        assert.equalBytes(readBuffer.subarray(1, 1 + readLen),
            Buffer.from([8]))

        await writePromise

        // Now test for errors
        writePromise = IOUtils.writeBytes(instance,
            Buffer.from([9, 7]));

        await endWritesOnMemoryPipe(instance, new Error("NIE"))
        await endWritesOnMemoryPipe(instance, new Error("NSE")) // should have no effect

        await nativeAssert.rejects(async () => {
            await writePromise
        }, {
            message: "NIE"
        })
        await nativeAssert.rejects(async () => {
            await IOUtils.readBytes(instance,
                readBuffer.subarray(0, 1))
        }, {
            message: "NIE"
        })
        await nativeAssert.rejects(async () => {
            await IOUtils.writeBytes(instance, Buffer.alloc(4))
        }, {
            message: "NIE"
        })
    })

    it("should pass internals test (2)", async function() {
        // NB: test depends on highWaterMark values in the range
        // of [1, 4]
        const instance = createMemoryPipeCustomReaderWriter(2)
        const readBuffer = Buffer.alloc(3)
        let readPromise = IOUtils.readBytes(instance, readBuffer)

        await IOUtils.writeBytes(instance, Buffer.from([4, 5, 6]))
        let readLen = await readPromise;
        assert.equal(readLen, 3)
        assert.equalBytes(readBuffer, Buffer.from([4, 5, 6]))

        readPromise = IOUtils.readBytes(instance,
            readBuffer.subarray(0, 0))

        await IOUtils.writeBytes(instance, Buffer.alloc(0))

        let delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([readPromise, delayPromise]),
            1)

        let writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6]))
        delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            0)
        writePromise = IOUtils.writeBytes(instance,
            Buffer.from([8]))
        delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            1)
        readLen = await readPromise
        assert.equal(readLen, 0)

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(0, 3))
        assert.equal(readLen, 3)
        assert.equalBytes(readBuffer.subarray(0, readLen),
            Buffer.from([2, 4, 6]))

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(1, 3))
        assert.equal(readLen, 1)
        assert.equalBytes(readBuffer.subarray(1, 1 + readLen),
            Buffer.from([8]))

        await writePromise

        // Now test for errors
        readPromise = IOUtils.readBytes(instance,
            readBuffer.subarray(0, 2));

        await endWritesOnMemoryPipe(instance, new Error("NSE"))
        await endWritesOnMemoryPipe(instance) // should have no effect

        await nativeAssert.rejects(async () => {
            await readPromise
        }, {
            message: "NSE"
        })
        await nativeAssert.rejects(async () => {
            await IOUtils.readBytes(instance,
                readBuffer.subarray(0, 1))
        }, {
            message: "NSE"
        })
        await nativeAssert.rejects(async () => {
            await IOUtils.writeBytes(instance, Buffer.alloc(4))
        }, {
            message: "NSE"
        })
    })

    it("should pass internals test (3)", async function() {
        // NB: test depends on highWaterMark of 4 bytes.
        const instance = createMemoryPipeCustomReaderWriter(4)
        const readBuffer = Buffer.alloc(3)
        let readPromise = IOUtils.readBytes(instance, readBuffer)

        await IOUtils.writeBytes(instance, Buffer.from([4, 5, 6]))
        let readLen = await readPromise;
        assert.equal(readLen, 3)
        assert.equalBytes(readBuffer, Buffer.from([4, 5, 6]))

        await IOUtils.writeBytes(instance, Buffer.alloc(0))

        let writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6]))
        let delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            0)
        writePromise = IOUtils.writeBytes(instance,
            Buffer.from([8]))
        delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            1)

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(0, 3))
        assert.equal(readLen, 3)
        assert.equalBytes(readBuffer.subarray(0, readLen),
            Buffer.from([2, 4, 6]))

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(1, 3))
        assert.equal(readLen, 1)
        assert.equalBytes(readBuffer.subarray(1, 1 + readLen),
            Buffer.from([8]))

        await writePromise

        // Now test for errors
        readPromise = IOUtils.readBytes(instance,
            readBuffer.subarray(0, 2));

        await endWritesOnMemoryPipe(instance)
        await endWritesOnMemoryPipe(instance, new Error("NSE")) // should have no effect

        readLen = await readPromise
        assert.equal(readLen, 0)

        await nativeAssert.rejects(async () => {
            await IOUtils.writeBytes(instance, Buffer.alloc(4))
        }, {
            message: "end of write"
        })

        readLen = await IOUtils.readBytes(instance, readBuffer)
        assert.equal(readLen, 0)

        readLen = await IOUtils.readBytes(instance,
            readBuffer.subarray(3, 3))
        assert.equal(readLen, 0)
    })
})