import nativeAssert from "assert/strict";
const { assert } = require("chai").use(require("chai-bytes"))
import * as IOUtils from "../../../src/common/IOUtils"
import * as EntityBodyUtils from "../../../src/quasihttp/entitybody/EntityBodyUtils"
import { LambdaBasedQuasiHttpBody } from "../../../src/quasihttp/entitybody/LambdaBasedQuasiHttpBody"
import { ISelfWritable } from "../../../src/common/types";
import { Readable } from "stream";

function* createTestData() {
    let expected = Buffer.alloc(0)
    let reader: Readable | null = Readable.from(Buffer.alloc(0))
    let fallback;
    yield {
        reader,
        fallback,
        expected
    }

    expected = Buffer.from([0, 1, 2, 3])
    reader = Readable.from(expected)
    fallback = {}
    yield {
        reader,
        fallback,
        expected
    }

    expected = Buffer.from([0, 1, 2])
    reader = null;
    fallback = {
        async writeBytesTo(writer) {
            await IOUtils.writeBytes(writer, expected, 0,
                expected.length)
        },
    } as ISelfWritable
    yield {
        reader,
        fallback,
        expected
    }
}

describe("EntityBodyUtils", function() {
    describe("#getBodyReader", function() {
        it("should fail due to argument errors", function() {
            assert.throws(() =>
                EntityBodyUtils.getBodyReader(null as any))
        })

        let i = 0;
        for (const testDataItem of createTestData()) {
            i++;
            const {reader, fallback, expected} = testDataItem;
            it(`should pass with input ${i}`, async function() {
                const body = new LambdaBasedQuasiHttpBody(
                    () => reader, fallback)
                // Leverage default mocha test timeout,
                // to deal with any error which may cause readAllBytes()
                // to hang forever.
                const actual = await IOUtils.readAllBytes(
                    EntityBodyUtils.getBodyReader(body))
                assert.equalBytes(actual, expected)
            })
        }

        it("should fail due to error on writable", async function() {
            const troublesomeSelfWritable = {
                async writeBytesTo(writer) {
                    await IOUtils.writeBytes(writer,
                        Buffer.alloc(1000), 0, 1000)
                    throw new Error("enough!")
                },
            } as ISelfWritable
            const body = new LambdaBasedQuasiHttpBody(null,
                troublesomeSelfWritable)
            // Leverage default mocha test timeout,
            // to deal with any error which may cause readAllBytes()
            // to hang forever.
            await nativeAssert.rejects(async () => {
                await IOUtils.readAllBytes(
                    EntityBodyUtils.getBodyReader(body))
            }, {
                message: "enough!"
            })
        })
    })
})