/**
 * RawByteProcessor — extracts raw byte data from files for the compost heap.
 * Handles hex encoding, SHA256 hashing, and base64 conversion.
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import type { RawByteData } from './types.js';

/** Maximum file size for base64 encoding (100KB). */
const BASE64_MAX_SIZE = 100 * 1024;

/** Maximum file size for full hex chunking — skip full hex for larger files. */
const HEX_FULL_MAX_SIZE = 50 * 1024;

/** Chunk size for hex block splitting. */
const HEX_CHUNK_SIZE = 256;

export class RawByteProcessor {
  /** Extract raw byte data from a file. */
  static async process(filePath: string): Promise<RawByteData> {
    const buffer = await fs.readFile(filePath);
    const size = buffer.length;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Header: first 4KB as hex
    const headerSlice = buffer.subarray(0, Math.min(4096, size));
    const headerHex = headerSlice.toString('hex');

    // Tail: last 4KB as hex
    const tailStart = Math.max(0, size - 4096);
    const tailSlice = buffer.subarray(tailStart, size);
    const tailHex = tailSlice.toString('hex');

    // Full hex chunked into blocks (skip for large files to avoid memory blowup)
    const hexChunks = size < HEX_FULL_MAX_SIZE
      ? this.chunkHex(buffer.toString('hex'), HEX_CHUNK_SIZE)
      : [];

    // Base64 for small files
    const base64 = size < BASE64_MAX_SIZE ? buffer.toString('base64') : null;

    return { headerHex, tailHex, sha256, size, hexChunks, base64 };
  }

  /** Return base64 for files < 100KB, otherwise null. */
  static async getBase64(filePath: string): Promise<string | null> {
    const buffer = await fs.readFile(filePath);
    if (buffer.length >= BASE64_MAX_SIZE) return null;
    return buffer.toString('base64');
  }

  /** Split a hex string into chunks of specified size. */
  static chunkHex(hexString: string, chunkSize: number = HEX_CHUNK_SIZE): string[] {
    if (hexString.length === 0) return [];
    const chunks: string[] = [];
    for (let i = 0; i < hexString.length; i += chunkSize) {
      chunks.push(hexString.slice(i, i + chunkSize));
    }
    return chunks;
  }

}
