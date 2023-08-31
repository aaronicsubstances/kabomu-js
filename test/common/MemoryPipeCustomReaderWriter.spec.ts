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
    whenAnyPromiseSettles
} from "../../src/common/MiscUtils"

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
        const instance = createMemoryPipeCustomReaderWriter()
        let readPromise = IOUtils.readBytes(instance, 3)

        await IOUtils.writeBytes(instance, Buffer.from([4, 5, 6]))
        let readBuffer = await readPromise;
        assert.equal(readBuffer?.length, 3)
        assert.equalBytes(readBuffer, Buffer.from([4, 5, 6]))

        readPromise = IOUtils.readBytes(instance, 0)

        await IOUtils.writeBytes(instance, Buffer.alloc(0))

        let delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([readPromise, delayPromise]),
            1)

        let writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6, 8]))
        readBuffer = await readPromise
        assert.isNotOk(readBuffer)

        readBuffer = await IOUtils.readBytes(instance, 3)
        assert.equal(readBuffer?.length, 3)
        assert.equalBytes(readBuffer, Buffer.from([2, 4, 6]))

        readBuffer = await IOUtils.readBytes(instance, 2)
        assert.equal(readBuffer?.length, 1)
        assert.equalBytes(readBuffer, Buffer.from([8]))

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
            await IOUtils.readBytes(instance, 1)
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
        const instance = createMemoryPipeCustomReaderWriter()
        let readPromise = IOUtils.readBytes(instance, 3)

        await IOUtils.writeBytes(instance, Buffer.from([4, 5, 6]))
        let readBuffer = await readPromise;
        assert.equal(readBuffer?.length, 3)
        assert.equalBytes(readBuffer, Buffer.from([4, 5, 6]))

        readPromise = IOUtils.readBytes(instance, 0)

        await IOUtils.writeBytes(instance, Buffer.alloc(0))

        let delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([readPromise, delayPromise]),
            1)

        let writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6, 8]))
        readBuffer = await readPromise
        assert.isNotOk(readBuffer)

        readBuffer = await IOUtils.readBytes(instance, 3)
        assert.equal(readBuffer?.length, 3)
        assert.equalBytes(readBuffer, Buffer.from([2, 4, 6]))

        readBuffer = await IOUtils.readBytes(instance, 2)
        assert.equal(readBuffer?.length, 1)
        assert.equalBytes(readBuffer, Buffer.from([8]))

        await writePromise

        // Now test for errors
        readPromise = IOUtils.readBytes(instance, 2);

        await endWritesOnMemoryPipe(instance, new Error("NSE"))
        await endWritesOnMemoryPipe(instance) // should have no effect

        await nativeAssert.rejects(async () => {
            await readPromise
        }, {
            message: "NSE"
        })
        await nativeAssert.rejects(async () => {
            await IOUtils.readBytes(instance, 1)
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
        const instance = createMemoryPipeCustomReaderWriter()

        let writePromise = IOUtils.writeBytes(instance,
            Buffer.from([4, 5, 6]))

        let readPromise = IOUtils.readBytes(instance, 3)
        let readBuffer = await readPromise
        assert.equal(readBuffer?.length, 3)
        assert.equalBytes(readBuffer, Buffer.from([4, 5, 6]))

        await IOUtils.writeBytes(instance, Buffer.alloc(0))
        
        readPromise = IOUtils.readBytes(instance, 4)

        writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6, 8]))
        let delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            0)
        
        readBuffer = await readPromise
        assert.equal(readBuffer?.length, 4)
        assert.equalBytes(readBuffer, Buffer.from([2, 4, 6, 8]))

        writePromise = IOUtils.writeBytes(instance,
            Buffer.from([2, 4, 6, 8]))
        delayPromise = createDelayPromise(200)
        assert.equal(await whenAnyPromiseSettles([writePromise, delayPromise]),
            1)

        readBuffer = await IOUtils.readBytes(instance, 3)
        assert.equal(readBuffer?.length, 3)
        assert.equalBytes(readBuffer, Buffer.from([2, 4, 6]))

        readBuffer = await IOUtils.readBytes(instance, 2)
        assert.equal(readBuffer?.length, 1)
        assert.equalBytes(readBuffer, Buffer.from([8]))

        await writePromise

        // Now test for errors
        readPromise = IOUtils.readBytes(instance, 2);

        await endWritesOnMemoryPipe(instance)
        await endWritesOnMemoryPipe(instance, new Error("NSE")) // should have no effect

        readBuffer = await readPromise
        assert.isNotOk(readBuffer)

        await nativeAssert.rejects(async () => {
            await IOUtils.writeBytes(instance, Buffer.alloc(4))
        }, {
            message: "end of write"
        })

        readBuffer = await IOUtils.readBytes(instance, 3)
        assert.isNotOk(readBuffer)

        readBuffer = await IOUtils.readBytes(instance, 0)
        assert.isNotOk(readBuffer)
    })
})