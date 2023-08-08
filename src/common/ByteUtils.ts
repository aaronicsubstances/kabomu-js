/**
 * Determines whether a given byte buffer slice is valid. A byte buffer slice is valid if and only if its
 * backing byte array is not null and the values of its offset and (offset + length - 1) are valid
 * indices in the buffer.
 * @param data backing byte array of slice. Invalid if null.
 * @param offset offset of range in byte array. Invalid if negative
 * @param length length of range in byte array. Invalid if negative.
 * @returns true if byte buffer slice is valid; false if otherwise.
 */
export function isValidByteBufferSlice(data: Buffer, offset: number, length: number) {
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
    return Buffer.from(s, "utf8");
}

/**
 * Creates a string from its UTF-8 encoding in a buffer.
 * @param data buffer containing UTF-8 encoded bytes
 * @param offset offset in buffer from which to begin decoding. defaults to start of buffer.
 * @param length number of bytes to decode. defaults to entire buffer length.
 * @returns string equivalent of byte buffer slice containing UTF-8 encoding
 */
export function bytesToString(data: Buffer, offset = 0, length = data?.length): string {
    return data.toString("utf8", offset, length);
}

/**
 * Converts a 32-bit signed integer to its big-endian representation and stores any specified number of
 * the least significant bytes of the representation in a byte array.
 * @param v 32-bit signed integer to convert
 * @param data destination buffer of conversion.
 * @param offset offset into destination buffer to store the conversion.
 * @param length the number of least significant bytes of the representation to store in the destination buffer (0-4).
 */
export function serializeUpToInt32BigEndian(v: number, data: Buffer,
        offset: number, length: number) {
    if (length > 4) {
        throw new Error("length cannot be larger than 4. received " + length);
    }
    data.writeIntBE(v, offset, length);
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
    if (signed) {
        return data.readIntBE(offset, length);
    }
    else {
        return data.readUIntBE(offset, length);
    }
}
