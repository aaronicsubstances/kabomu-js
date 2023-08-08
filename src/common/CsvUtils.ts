import { Writable } from "stream";
import * as ByteUtils from "./ByteUtils";
import * as IOUtils from "./IOUtils";

const TOKEN_EOI = -1;
const TOKEN_COMMA = 1;
const TOKEN_QUOTE = 2;
const TOKEN_CRLF = 3;
const TOKEN_LF = 4;
const TOKEN_CR = 5;

const newlineConstant = ByteUtils.stringToBytes('\n');
const commaConstant = ByteUtils.stringToBytes(',');

/**
 * Acts as a lexing function during CSV parsing.
 * @param csv CSV string to lex
 * @param start the position in the CSV source string from which to search for next token
 * @param insideQuotedValue provides context from deserializing function on whether parsing is currently in the midst of
 * a quoted value
 * @param tokenInfo Required 2-element array which will be filled with the token type and token position.
 * @returns true if a token was found; false if end of input was reached.
 */
function locateNextToken(csv: string, start: number,
    insideQuotedValue: boolean, tokenInfo: Array<number>) {
    // set to end of input by default
    tokenInfo[0] = TOKEN_EOI;
    tokenInfo[1] = -1;
    for (let i = start; i < csv.length; i++) {
        const c = csv[i];
        if (!insideQuotedValue && c === ',') {
            tokenInfo[0] = TOKEN_COMMA;
            tokenInfo[1] = i;
            return true;
        }
        if (!insideQuotedValue && c === '\n') {
            tokenInfo[0] = TOKEN_LF;
            tokenInfo[1] = i;
            return true;
        }
        if (!insideQuotedValue && c === '\r') {
            if (i + 1 < csv.length && csv[i + 1] === '\n') {
                tokenInfo[0] = TOKEN_CRLF;
            }
            else {
                tokenInfo[0] = TOKEN_CR;
            }
            tokenInfo[1] = i;
            return true;
        }
        if (insideQuotedValue && c === '"')
        {
            if (i + 1 < csv.length && csv[i + 1] === '"') {
                // skip quote pair.
                i++;
            }
            else {
                tokenInfo[0] = TOKEN_QUOTE;
                tokenInfo[1] = i;
                return true;
            }
        }
    }
    return false;
}

/**
 * Parses a CSV string.
 * @param csv the csv string to parse.
 * @returns CSV parse results as a list of rows, in which each row is represented as a list of values
 * corresponding to the row's columns.
 */
export function deserialize(csv: string) {
    const parsedCsv = new Array<string[]>();
    let currentRow = new Array<string>();
    let nextValueStartIdx = 0;
    let isCommaTheLastSeparatorSeen = false;
    const tokenInfo = [0, 0];
    while (nextValueStartIdx < csv.length) {
        // use to detect infinite looping
        let savedNextValueStartIdx = nextValueStartIdx;

        // look for comma, quote or newline, whichever comes first.
        let newlineLen = 1;
        let tokenIsNewline = false;
        isCommaTheLastSeparatorSeen = false;

        let nextValueEndIdx = 0;
        let tokenType = 0;

        // only respect quote separator at the very beginning
        // of parsing a column value
        if (csv[nextValueStartIdx] === '"') {
            tokenType = TOKEN_QUOTE;
            // locate ending quote, while skipping over
            // double occurences of quotes.
            if (!locateNextToken(csv, nextValueStartIdx + 1, true, tokenInfo))
            {
                throw createCsvParseError(parsedCsv.length, currentRow.length,
                    "ending double quote not found");
            }
            nextValueEndIdx = tokenInfo[1] + 1;
        }
        else {
            locateNextToken(csv, nextValueStartIdx, false, tokenInfo);
            tokenType = tokenInfo[0];
            if (tokenType === TOKEN_COMMA) {
                nextValueEndIdx = tokenInfo[1];
                isCommaTheLastSeparatorSeen = true;
            }
            else if (tokenType === TOKEN_LF || tokenType === TOKEN_CR) {
                nextValueEndIdx = tokenInfo[1];
                tokenIsNewline = true;
            }
            else if (tokenType === TOKEN_CRLF) {
                nextValueEndIdx = tokenInfo[1];
                tokenIsNewline = true;
                newlineLen = 2;
            }
            else if (tokenType === TOKEN_EOI) {
                nextValueEndIdx = csv.length;
            }
            else {
                throw new Error("unexpected token type: " + tokenType);
            }
        }

        // create new value for current row,
        // but skip empty values between newlines, or between BOI and newline.
        if (nextValueStartIdx < nextValueEndIdx || !tokenIsNewline || currentRow.length > 0) {
            let nextValue;
            try {
                nextValue = unescapeValue(csv.substring(nextValueStartIdx,
                    nextValueEndIdx));
            }
            catch (e)
            {
                if (e instanceof Error) {
                    throw createCsvParseError(parsedCsv.length, currentRow.length, e.message);
                }
                else {
                    throw e;
                }
            }
            currentRow.push(nextValue);
        }

        // advance input pointer.
        if (tokenType === TOKEN_COMMA) {
            nextValueStartIdx = nextValueEndIdx + 1;
        }
        else if (tokenType === TOKEN_QUOTE) {
            // validate that character after quote is EOI, comma or newline.
            nextValueStartIdx = nextValueEndIdx;
            if (nextValueStartIdx < csv.length) {
                const c = csv[nextValueStartIdx];
                if (c === ',') {
                    isCommaTheLastSeparatorSeen = true;
                    nextValueStartIdx++;
                }
                else if (c === '\n' || c === '\r') {
                    parsedCsv.push(currentRow);
                    currentRow = new Array<string>();
                    if (c === '\r' && nextValueStartIdx + 1 < csv.length && csv[nextValueStartIdx + 1] === '\n') {
                        nextValueStartIdx += 2;
                    }
                    else {
                        nextValueStartIdx++;
                    }
                }
                else {
                    throw createCsvParseError(parsedCsv.length, currentRow.length,
                        `unexpected character '${c}' found at beginning`);
                }
            }
            else
            {
                // leave to aftermath processing.
            }
        }
        else if (tokenIsNewline) {
            parsedCsv.push(currentRow);
            currentRow = new Array<string>();
            nextValueStartIdx = nextValueEndIdx + newlineLen;
        }
        else {
            // leave to aftermath processing.
            nextValueStartIdx = nextValueEndIdx;
        }

        // ensure input pointer has advanced.
        if (savedNextValueStartIdx >= nextValueStartIdx) {
            throw createCsvParseError(parsedCsv.length, currentRow.length,
                "algorithm bug detected as parsing didn't make an advance. Potential for infinite " +
                "looping.");
        }
    }

    // generate empty value for case of trailing comma
    if (isCommaTheLastSeparatorSeen) {
        currentRow.push("");
    }

    // add any leftover values to parsed csv rows.
    if (currentRow.length > 0) {
        parsedCsv.push(currentRow);
    }

    return parsedCsv;
}

function createCsvParseError(row: number, column: number, errorMessage: string) {
    throw new Error(`CSV parse error at row ${row + 1} column ${column + 1}: ` +
        (errorMessage ?? ""));
}

export async function _serializeTo(rows: Array<string[]>, writer: Writable) {
    for (const row of rows) {
        let addCommaSeparator = false;
        for (const value of row) {
            if (addCommaSeparator) {
                await IOUtils.writeBytes(writer, commaConstant, 0,
                    commaConstant.length);
            }
            await _escapeValueTo(value, writer);
            addCommaSeparator = true;
        }
        await IOUtils.writeBytes(writer, newlineConstant, 0,
            newlineConstant.length);
    }
}

/**
 * Generates a CSV string.
 * @param rows Data for CSV generation. Each row is a list whose entries will be treated as the values of
 * columns in the row. Also no row is treated specially.
 * @returns CSV string corresponding to rows
 */
export function serialize(rows: Array<string[]>)
{
    const csvBuilder = new Array<string>()
    for (const row of rows) {
        let addCommaSeparator = false;
        for (const value of row) {
            if (addCommaSeparator) {
                csvBuilder.push(",");
            }
            csvBuilder.push(escapeValue(value));
            addCommaSeparator = true;
        }
        csvBuilder.push("\n");
    }
    return csvBuilder.join("");
}

export async function _escapeValueTo(raw: string, writer: Writable) {
    // escape empty strings with two double quotes to resolve ambiguity
    // between an empty row and a row containing an empty string - otherwise both
    // serialize to the same CSV output.
    if (raw === "" || doesValueContainSpecialCharacters(raw))
    {
        raw = '"' + raw.replace("\"", "\"\"") + '"';
    }
    const rawBytes = ByteUtils.stringToBytes(raw);
    await IOUtils.writeBytes(writer, rawBytes, 0, rawBytes.length);
}

/**
 * Escapes a CSV value. Note that empty strings are always escaped as two double quotes.
 * @param raw CSV value to escape.
 * @returns Escaped CSV value.
 */
export function escapeValue(raw: string) {
    if (!doesValueContainSpecialCharacters(raw)) {
        // escape empty strings with two double quotes to resolve ambiguity
        // between an empty row and a row containing an empty string - otherwise both
        // serialize to the same CSV output.
        return raw === "" ? "\"\"" : raw;
    }
    return '"' + raw.replace("\"", "\"\"") + '"';
}

/**
 * Reverses the escaping of a CSV value.
 * @param escaped CSV escaped value.
 * @returns CSV value which equals escaped argument when escaped.
 * @throws
 * Thrown if the escaped argument is an invalid escaped value.
 */
export function unescapeValue(escaped: string) {
    if (!doesValueContainSpecialCharacters(escaped)) {
        return escaped
    }
    if (escaped.length < 2 || !escaped.startsWith("\"") || !escaped.endsWith("\"")) {
        throw new Error("missing enclosing double quotes around csv value: " + escaped)
    }
    var unescaped = new Array<string>()
    for (let i = 1; i < escaped.length - 1; i++) {
        const c = escaped[i];
        unescaped.push(c);
        if (c === '"') {
            if (i === escaped.length - 2 || escaped[i + 1] !== '"') {
                throw new Error("unescaped double quote found in csv value: " + escaped)
            }
            i++
        }
    }
    return unescaped.join("")
}

function doesValueContainSpecialCharacters(s: string) {
    for (const c of s) {
        if (c == ',' || c == '"' || c == '\r' || c == '\n') {
            return true;
        }
    }
    return false;
}
