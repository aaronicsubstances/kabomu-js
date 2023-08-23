/**
 * Determines whether a given byte buffer slice is valid. A byte buffer slice is valid if and only if its
 * backing byte array is not null and the values of its offset and (offset + length - 1) are valid
 * indices in the buffer.
 * @param data backing byte array of slice. Invalid if null.
 * @param offset offset of range in byte array. Invalid if negative
 * @param length length of range in byte array. Invalid if negative.
 * @returns true if byte buffer slice is valid; false if otherwise.
 */
export function isValidByteBufferSlice(
        data: Buffer | undefined,
        offset: number,
        length: number) {
    if (!data) {
        return false;
    }
    if (offset < 0) {
        return false;
    }
    if (length < 0) {
        return false;
    }
    if (offset + length > data.length) {
        return false;
    }
    return true;
}

/**
 * Converts a string to bytes in UTF-8 encoding.
 * @param s the string to convert
 * @returns buffer representing UTF-8 encoding of string
 */
export function stringToBytes(s: string) {
    if (typeof s !== "string") {
        throw new Error("argument must be a string");
    }
    return Buffer.from(s);
}

/**
 * Creates a string from its UTF-8 encoding in a buffer.
 * @param data buffer containing UTF-8 encoded bytes
 * @returns string equivalent of byte buffer containing UTF-8 encoding
 */
export function bytesToString(data: Buffer): string {
    return data.toString();
}

/**
 * Converts a 32-bit signed integer to its big-endian representation and stores any specified number of
 * the least significant bytes of the representation in a byte array.
 * @param v 32-bit signed integer to convert
 * @param rawBytes destination buffer of conversion.
 * @param offset offset into destination buffer to store the conversion.
 * @param length the number of least significant bytes of the representation to store in the destination buffer (0-4).
 */
export function serializeUpToInt32BigEndian(v: number, rawBytes: Buffer,
        offset: number, length: number) {
    if (offset < 0) {
        throw new Error("offset cannot be negative. received " +
            offset);
    }
    if (length < 0) {
        throw new Error("length cannot be negative. received " +
            length);
    }
    if (length > 4) {
        throw new Error("length cannot be larger than 4. received " +
            length);
    }

    // didn't work in this case because it requires
    // number v to be within valid signed integer of bytes
    // equal to length argument. 
    //rawBytes.writeIntBE(v, offset, length);

    let nextIndex = offset + length - 1;
    let shiftCount = 0;
    while (nextIndex >= offset) {
        rawBytes[nextIndex--] = 0xff & (v >> shiftCount);
        shiftCount += 8;
    }
}

/**
 * Creates a 32-bit signed integer from its big-endian representation, given any number of its least significant bytes.
 * @param data source buffer for conversion.
 * @param offset the start of the data for the integer in the source buffer
 * @param length the number of least significant bytes of the representation to fetch from the source buffer (0-4).
 * @param signed whether the bytes should be interpreted as a signed integer. pass false to interpret as an
 * unsigned integer. NB: for length of 4 bytes, interpretation is always as a signed integer.
 * @returns 32-bit signed integer
 */
export function deserializeUpToInt32BigEndian(data: Buffer, offset: number,
        length: number, signed: boolean) {
    if (length > 4) {
        throw new Error("length cannot be larger than 4. received " + length);
    }
    if (signed || length === 4) {
        return data.readIntBE(offset, length);
    }
    else {
        return data.readUIntBE(offset, length);
    }
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
