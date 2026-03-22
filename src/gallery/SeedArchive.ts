/**
 * SeedArchive - Seed generation and storage functionality
 *
 * Manages unique seed generation and persistent storage of seed metadata.
 * Seeds are used to recreate generative art outputs with consistent parameters.
 *
 * Key behavior:
 * - generateSeed() creates unique lowercase alphanumeric strings
 * - saveSeed(seed, metadata) saves seed metadata to archive/{seed}.json
 * - loadSeed(seed) loads seed metadata or returns null if not found
 */

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { assertSafeSegment } from '../utils/normalizePath.js';

export interface SeedMetadata {
  [key: string]: unknown;
}

export interface SeedData extends SeedMetadata {
  seed: string;
}

export class SeedArchive {
  private readonly archiveDir: string;

  constructor(archiveDir: string = 'seeds') {
    this.archiveDir = archiveDir;
  }

  /**
   * Generate a unique seed string
   * @returns Unique lowercase alphanumeric seed with hyphens
   */
  generateSeed(): string {
    const bytes = randomBytes(16);
    const seed = bytes.toString('base64')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return seed.substring(0, Math.min(seed.length, 32));
  }

  /**
   * Save seed with metadata to archive
   * @param seed - Seed string (must be non-empty string)
   * @param metadata - Metadata object to store with seed
   * @throws Error if validation fails or file system error occurs
   */
  async saveSeed(seed: string, metadata: SeedMetadata): Promise<void> {
    if (!seed || typeof seed !== 'string' || seed.trim() === '') {
      throw new Error('Seed is required and must be a non-empty string');
    }
    assertSafeSegment(seed, 'Seed');

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('Metadata is required and must be an object');
    }

    const seedData: SeedData = {
      seed,
      ...metadata
    };

    try {
      await fs.mkdir(this.archiveDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create archive directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const filename = `${seed}.json`;
    const filepath = path.join(this.archiveDir, filename);
    // Validate the resolved path stays within archiveDir
    const resolved = path.resolve(this.archiveDir);
    const resolvedFile = path.resolve(filepath);
    if (!resolvedFile.startsWith(resolved + path.sep) && resolvedFile !== resolved) {
      throw new Error('Seed path must be within archive directory');
    }

    try {
      await fs.writeFile(filepath, JSON.stringify(seedData, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save seed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load seed metadata from archive
   * @param seed - Seed string (must be non-empty string)
   * @returns Seed data with metadata, or null if not found
   * @throws Error if validation fails
   */
  async loadSeed(seed: string): Promise<SeedData | null> {
    if (!seed || typeof seed !== 'string' || seed.trim() === '') {
      throw new Error('Seed is required and must be a non-empty string');
    }
    assertSafeSegment(seed, 'Seed');

    const filename = `${seed}.json`;
    const filepath = path.join(this.archiveDir, filename);
    // Validate the resolved path stays within archiveDir
    const resolved = path.resolve(this.archiveDir);
    const resolvedFile = path.resolve(filepath);
    if (!resolvedFile.startsWith(resolved + path.sep) && resolvedFile !== resolved) {
      throw new Error('Seed path must be within archive directory');
    }

    try {
      await fs.access(filepath);
    } catch (accessError) {
      return null;
    }

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content) as SeedData;
      return data;
    } catch (readError) {
      return null;
    }
  }
}
