const { assert } = require('chai').use(require('chai-bytes'))

import { Readable, Writable } from "stream"
import * as IOUtils from "../../src/common/IOUtils"

describe("IOUtils", function() {
    describe("#readBytes", function() {
        it("should pass (1)", async function() {
            const stream = Readable.from(Buffer.from([1, 2, 3]))
            let actual = Buffer.alloc(3)
            let actualReadLen = await IOUtils.readBytes(stream, actual, 0,
                2)
            assert.equal(actualReadLen, 2)
            assert.equalBytes(actual.subarray(0, 2),
                Buffer.from([1, 2]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 1, 2)
            assert.equal(actualReadLen, 1)
            assert.equalBytes(actual.subarray(1, 2),
                Buffer.from([3]))

            actualReadLen = await IOUtils.readBytes(stream,
                actual, 2, 1)
            assert.equal(actualReadLen, 0)
            assert.equalBytes(actual, Buffer.from([1, 3, 0]))
        })
    })
})