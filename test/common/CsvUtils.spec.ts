const { assert } = require('chai').use(require('chai-bytes'))

import { Writable } from "stream"
import * as ByteUtils from "../../src/common/ByteUtils"
import * as CsvUtils from "../../src/common/CsvUtils"

describe("CsvUtils", function() {
    const testData = [
        {
            raw: "",
            expected: "\"\""
        },
        {
            raw: "d",
            expected: "d"
        },
        {
            raw: "\n",
            expected: "\"\n\""
        },
        {
            raw: "\r",
            expected: "\"\r\""
        },
        {
            raw: "m,n",
            expected: "\"m,n\""
        },
        {
            raw: "m\"n",
            expected: "\"m\"\"n\""
        }
    ]
    describe("#escapeValue", function() {
        testData.forEach(({raw, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = CsvUtils.escapeValue(raw)
                assert.equal(actual, expected)
            })
        })
    })

    describe("#unescapeValue", function() {
        const testData = [
            {
                escaped: "\"\"",
                expected: ""
            },
            {
                escaped: "d",
                expected: "d"
            },
            {
                escaped: "\"\n\"",
                expected: "\n"
            },
            {
                escaped: "\"\r\"",
                expected: "\r"
            },
            {
                escaped: "\"m,n\"",
                expected: "m,n"
            },
            {
                escaped: "\"m\"\"n\"",
                expected: "m\"n"
            }
        ]
        testData.forEach(({escaped, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = CsvUtils.unescapeValue(escaped)
                assert.equal(actual, expected)
            })
        })
        
        const testErrorData = [
            "\"", "d\"", "\"\"\"", ",", "m,n\n", "\"m\"n"
        ]
        testErrorData.forEach((x, i) => {
            it(`should fail with input ${i}`, function() {
                assert.throws(() => {
                    CsvUtils.unescapeValue(x)
                })
            })
        })
    })

    const testSerializeData = [
        {
            rows: [],
            expected: ""
        },
        {
            rows: [[""]],
            expected: "\"\"\n"
        },
        {
            rows: [[]],
            expected: "\n"
        },
        {
            rows: [
                ["a"],
                ["b", "c"]
            ],
            expected: "a\nb,c\n"
        },
        {
            rows: [
                [],
                [",", "c"]
            ],
            expected: "\n\",\",c\n"
        },
        {
            rows: [
                ["head", "tail", "."],
                ["\n", " c\"d "],
                []
            ],
            expected: "head,tail,.\n\"\n\",\" c\"\"d \"\n\n"
        },
        {
            rows: [
                ["a\nb,c\n"],
                ["\n\",\",c\n", "head,tail,.\n\"\n\",\" c\"\"d \"\n\n"]
            ],
            expected: "\"a\nb,c\n\"\n" +
                "\"\n\"\",\"\",c\n\",\"head,tail,.\n\"\"\n\"\",\"\" c\"\"\"\"d \"\"\n\n\"\n"
        }
    ]
    describe("#serialize", function() {
        testSerializeData.forEach(({rows, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = CsvUtils.serialize(rows)
                assert.equal(actual, expected)
            })
        })
    })
    describe("#deserialize", function() {
        const testData = [
            {
                csv: "",
                expected: []
            },
            {
                csv: "\"\"",
                expected: [[""]]
            },
            {
                csv: "\n",
                expected: [[]]
            },
            {
                csv: "\"\",\"\"\n",
                expected: [
                    ["", ""]
                ]
            },
            {
                csv: "\"\",\"\"",
                expected: [
                    ["", ""]
                ]
            },
            {
                csv: "a\nb,c\n",
                expected: [
                    ["a"],
                    ["b", "c"]
                ]
            },
            {
                csv: "a\nb,c",
                expected: [
                    ["a"],
                    ["b", "c"]
                ]
            },
            {
                csv: "a,\"\"\nb,c",
                expected: [
                    ["a", ""],
                    ["b", "c"]
                ]
            },
            {
                csv: "a\nb,",
                expected: [
                    ["a"],
                    ["b", ""]
                ]
            },
            {
                csv: "\"a\"\n\"b\",\"\"", // test for unnecessary quotes
                expected: [
                    ["a"],
                    ["b", ""]
                ]
            },
            {
                csv: "\r\n\",\",c\r\n",
                expected: [
                    [],
                    [",", "c"]
                ]
            },
            {
                csv: "\n\",\",c",
                expected: [
                    [],
                    [",", "c"]
                ]
            },
            {
                csv: "head,tail,.\n\"\n\",\" c\"\"d \"\n\n",
                expected: [
                    ["head", "tail", "."],
                    ["\n", " c\"d "],
                    []
                ]
            },
            {
                csv: "head,tail,.\n\"\n\",\" c\"\"d \"\n",
                expected: [
                    ["head", "tail", "."],
                    ["\n", " c\"d "]
                ]
            },
            {
                csv: "head,tail,.\n\"\r\n\",\" c\"\"d \"\r",
                expected: [
                    ["head", "tail", "."],
                    ["\r\n", " c\"d "]
                ]
            },
            {
                csv: "\"a\nb,c\n\"\n" +
                    "\"\n\"\",\"\",c\n\",\"head,tail,.\n\"\"\n\"\",\"\" c\"\"\"\"d \"\"\n\n\"\n",
                expected: [
                    ["a\nb,c\n"],
                    ["\n\",\",c\n", "head,tail,.\n\"\n\",\" c\"\"d \"\n\n"]
                ]
            }
        ]
        testData.forEach(({csv, expected}, i) => {
            it(`should pass with input ${i}`, function() {
                const actual = CsvUtils.deserialize(csv)
                assert.deepEqual(actual, expected)
            })
        })
        const testErrorData = [
            "\"", "\"1\"2", "1\"\"2\"", "1,2\",3"
        ]
        testErrorData.forEach((x, i) => {
            it(`should fail with input ${i}`, function() {
                assert.throws(() => {
                    CsvUtils.deserialize(x)
                })
            })
        })
    })
})

