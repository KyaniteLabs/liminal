/**
 * AssetStore — Content-addressable binary storage for creative artifacts.
 *
 * Stores files by their SHA256 hash in a flat directory structure under
 * `.liminal/objects/`. Two identical files share the same storage (automatic
 * deduplication). Each asset is registered in the EventStore's assets table
 * for fast metadata queries.
 *
 * Directory layout:
 * ```
 * .liminal/objects/
 *   ab/cdef1234...   (SHA256 hash, first 2 chars = subdirectory)
 *   3f/a8b9c012...
 * ```
 *
 * This is the same pattern git uses internally for loose objects, but without
 * zlib compression (creative files are often already compressed: JPEG, PNG,
 * MP3, etc.).
 *
 * @module compost/AssetStore
 */

import {
  createHash,
} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import type { EventStore } from './EventStore.js';

/** Result of storing an asset. */
export interface StoredAsset {
  /** SHA256 content hash (also the storage key). */
  hash: string;
  /** Original filename. */
  filename: string;
  /** MIME type or file extension. */
  type: string;
  /** File size in bytes. */
  size: number;
  /** Whether this was a new asset (false = already existed = deduplicated). */
  isNew: boolean;
  /** Absolute path to the stored object. */
  storedPath: string;
}

/**
 * Content-addressable store for binary creative assets.
 *
 * Assets are stored by hash in `.liminal/objects/` and registered in the
 * EventStore's SQLite database for metadata queries.
 *
 * Usage:
 * ```ts
 * const store = new AssetStore(eventStore);
 *
 * // Store a file (copies it into .liminal/objects/)
 * const result = store.storeFile('/path/to/sketch.js');
 * console.log(result.hash);  // "a1b2c3..."
 * console.log(result.isNew); // true (first time)
 *
 * // Store the same file again — deduplicated
 * const result2 = store.storeFile('/path/to/sketch.js');
 * console.log(result2.isNew); // false (already stored)
 *
 * // Store raw content directly
 * const result3 = store.storeContent(bannerImage, 'banner.png', 'image/png');
 *
 * // Retrieve content
 * const content = store.getContent(result.hash);
 *
 * // Export a copy to a readable location
 * store.exportTo(result.hash, '/path/to/output/sketch.js');
 * ```
 */
export class AssetStore {
  private readonly objectsDir: string;
  private readonly eventStore: EventStore;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
    this.objectsDir = eventStore.getObjectsDir();

    if (!existsSync(this.objectsDir)) {
      mkdirSync(this.objectsDir, { recursive: true });
    }
  }

  /**
   * Store a file from disk into the content-addressable store.
   * Reads the file, hashes it, and copies it if it doesn't already exist.
   *
   * @returns StoredAsset with hash, metadata, and whether it was new.
   */
  storeFile(filePath: string): StoredAsset {
    const content = readFileSync(filePath);
    const hash = hashContent(content);
    const filename = filePath.split('/').pop() ?? 'unknown';
    const type = inferType(filename);
    const size = content.length;
    const storedPath = this.objectPath(hash);

    // Check if already stored
    if (existsSync(storedPath)) {
      // Register in DB (idempotent)
      this.registerInDb(hash, filename, type, size);
      return { hash, filename, type, size, isNew: false, storedPath };
    }

    // Write to objects directory
    const dir = dirname(storedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(storedPath, content);

    // Register in database
    this.registerInDb(hash, filename, type, size);

    return { hash, filename, type, size, isNew: true, storedPath };
  }

  /**
   * Store raw content (Buffer or string) directly.
   *
   * @param content — The binary or text content to store.
   * @param filename — Original filename for metadata.
   * @param type — MIME type or file extension.
   */
  storeContent(content: Buffer | string, filename: string, type: string): StoredAsset {
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const hash = hashContent(buf);
    const size = buf.length;
    const storedPath = this.objectPath(hash);

    const isNew = !existsSync(storedPath);

    if (isNew) {
      const dir = dirname(storedPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(storedPath, buf);
    }

    this.registerInDb(hash, filename, type, size);

    return { hash, filename, type, size, isNew, storedPath };
  }

  /**
   * Check whether an asset exists in the store.
   */
  has(hash: string): boolean {
    return existsSync(this.objectPath(hash));
  }

  /**
   * Retrieve the raw content of an asset by its hash.
   *
   * @returns The file content as a Buffer, or null if not found.
   */
  getContent(hash: string): Buffer | null {
    const path = this.objectPath(hash);
    if (!existsSync(path)) return null;
    return readFileSync(path);
  }

  /**
   * Get the content as a UTF-8 string. Returns null if not found.
   */
  getContentAsString(hash: string): string | null {
    const buf = this.getContent(hash);
    return buf ? buf.toString('utf-8') : null;
  }

  /**
   * Export (copy) a stored asset to an external path.
   */
  exportTo(hash: string, destinationPath: string): boolean {
    const source = this.objectPath(hash);
    if (!existsSync(source)) return false;

    const dir = dirname(destinationPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    copyFileSync(source, destinationPath);
    return true;
  }

  /**
   * Get the absolute path where an asset is stored.
   * Does NOT check if the asset exists.
   */
  getPath(hash: string): string {
    return this.objectPath(hash);
  }

  /**
   * Get the total storage used by all objects.
   */
  getTotalSize(): number {
    return this.walkDir(this.objectsDir);
  }

  /**
   * Count the number of stored objects.
   */
  count(): number {
    return this.countDir(this.objectsDir);
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────

  /** Map a SHA256 hash to its storage path: objects/ab/cdef1234... */
  private objectPath(hash: string): string {
    return join(this.objectsDir, hash.slice(0, 2), hash.slice(2));
  }

  /** Register an asset in the EventStore's database (idempotent). */
  private registerInDb(hash: string, filename: string, type: string, size: number): void {
    this.eventStore.registerAsset({ hash, filename, type, size });
  }

  /** Recursively sum file sizes in a directory. */
  private walkDir(dir: string): number {
    if (!existsSync(dir)) return 0;
    let total = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += this.walkDir(fullPath);
      } else if (entry.isFile()) {
        total += statSync(fullPath).size;
      }
    }
    return total;
  }

  /** Count files recursively. */
  private countDir(dir: string): number {
    if (!existsSync(dir)) return 0;
    let count = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += this.countDir(fullPath);
      } else if (entry.isFile()) {
        count++;
      }
    }
    return count;
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/** Hash content with SHA256 and return hex digest. */
function hashContent(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Infer a file type from its extension. */
function inferType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    js: 'text/javascript',
    ts: 'text/typescript',
    json: 'application/json',
    md: 'text/markdown',
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    py: 'text/x-python',
    glsl: 'x-shader/x-fragment',
    vert: 'x-shader/x-vertex',
    frag: 'x-shader/x-fragment',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    pdf: 'application/pdf',
    zip: 'application/zip',
  };
  return mimeMap[ext] ?? `application/x-${ext}`;
}
