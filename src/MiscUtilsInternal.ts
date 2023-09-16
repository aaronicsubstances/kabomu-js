import {
    IBlankChequePromise
} from "./types";

/**
 * Parses a string (or verifies a number)
 * as a valid 48-bit signed integer
 * (else an error occurs).
 * @param input the string to parse which Can be surrounded by
 * whitespace (or number to verify) 
 * @returns verified 48-bit integer
 */
export function parseInt48(input: any) {
    if (!["string", "number", "bigint"].includes(typeof input) ||
            (typeof input === "string" && /^\s*$/.test(input))) {
        throw new Error("invalid 48-bit integer: " + input)
    }
    const n = Number(input)
    if (Number.isNaN(n) || !Number.isInteger(n) ||
            n < -140_737_488_355_328 || n > 140_737_488_355_327) {
        throw new Error("invalid 48-bit integer: " + input)
    }
    return n
}

/**
 * Parses a string (or verifies a number)
 * as a valid 48-bit signed integer
 * (else an error occurs).
 * @param input the string to parse (or number to verify) 
 * @returns verified 48-bit integer
 */
export function parseInt32(input: any) {
    let n = 0;
    try {
        n = parseInt48(input);
    }
    catch {
        throw new Error("invalid 32-bit integer: " + input);
    }
    if (n < -2_147_483_648 || n > 2_147_483_647) {
        throw new Error("invalid 32-bit integer: " + input);
    }
    return n;
}

export function bytesToString(data: Buffer) {
    return data.toString();
}

export function stringToBytes(str: string) {
    return Buffer.from(str);
}

export function getByteCount(str: string) {
    return Buffer.byteLength(str, "utf-8")
}

export function createBlankChequePromise<T>() {
    const blankCheque = {
    } as IBlankChequePromise<T>
    blankCheque.promise = new Promise<T>((resolve, reject) => {
        blankCheque.resolve = resolve
        blankCheque.reject = reject
    })
    return blankCheque;
}