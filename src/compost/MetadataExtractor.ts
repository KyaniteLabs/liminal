/**
 * MetadataExtractor — structured metadata extraction for compost files.
 * No LLM needed — pure parsing and filesystem operations.
 * 
 * Optional dependencies:
 * - sharp: For image dimension extraction
 * - music-metadata: For audio metadata extraction
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import type { FragmentMetadata } from './types.js';
import { Logger } from '../utils/Logger.js';

/** Map of file extensions to programming languages. */
const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
  rb: 'ruby', php: 'php', swift: 'swift', c: 'c', cpp: 'cpp',
  h: 'c', hpp: 'cpp', cs: 'csharp', scala: 'scala',
  glsl: 'glsl', frag: 'glsl', vert: 'glsl',
};

/** Lazy-loaded sharp module */
let sharpModule: unknown = null;
let sharpLoading: Promise<unknown> | null = null;

/** Lazy-loaded music-metadata module */
let musicMetadataModule: unknown = null;
let musicMetadataLoading: Promise<unknown> | null = null;

/**
 * Dynamically import sharp for image processing.
 * Returns null if not installed.
 */
async function getSharp(): Promise<unknown> {
  if (sharpModule) return sharpModule;
  if (sharpLoading) return sharpLoading;
  sharpLoading = import('sharp')
    .then(mod => {
      sharpModule = (mod && typeof mod === 'object' && 'default' in mod) ? mod.default : mod;
      return sharpModule;
    })
    .catch((err) => {
      Logger.debug('MetadataExtractor', 'Failed to load sharp module:', err);
      return null;
    });
  return sharpLoading;
}

/**
 * Dynamically import music-metadata for audio processing.
 * Returns null if not installed.
 */
async function getMusicMetadata(): Promise<unknown> {
  if (musicMetadataModule) return musicMetadataModule;
  if (musicMetadataLoading) return musicMetadataLoading;
  musicMetadataLoading = import('music-metadata')
    .then(mod => {
      musicMetadataModule = mod;
      return mod;
    })
    .catch((err) => {
      Logger.debug('MetadataExtractor', 'Failed to load music-metadata module:', err);
      return null;
    });
  return musicMetadataLoading;
}

export class MetadataExtractor {
  /** Extract structured metadata from a single file. */
  static async extract(filePath: string): Promise<FragmentMetadata> {
    const stat = await fs.stat(filePath);
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const hash = await this.hashFile(filePath);

    const metadata: FragmentMetadata = {
      fileType: ext,
      timestamp: stat.mtime.toISOString(),
      hash,
      size: stat.size,
      extractedAt: new Date().toISOString(),
    };

    // Code-specific metadata
    if (EXTENSION_LANGUAGES[ext]) {
      metadata.language = EXTENSION_LANGUAGES[ext];
      metadata.loc = await this.countLines(filePath);
    }

    // Image metadata with optional sharp
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tiff'].includes(ext)) {
      metadata.format = ext.toUpperCase();
      const dims = await this.extractImageDimensions(filePath);
      if (dims) {
        metadata.dimensions = dims;
      }
    }

    // Audio metadata with optional music-metadata
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
      metadata.format = ext.toUpperCase();
      const audioMeta = await this.extractAudioMetadata(filePath);
      if (audioMeta) {
        metadata.duration = audioMeta.duration;
        if (audioMeta.sampleRate) {
          metadata.sampleRate = audioMeta.sampleRate;
        }
      }
    }

    return metadata;
  }

  /**
   * Extract image dimensions using sharp (if available).
   * Returns null if sharp is not installed or extraction fails.
   */
  private static async extractImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
    const sharp = await getSharp();
    if (!sharp || typeof sharp !== 'function') {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = await (sharp(filePath) as any).metadata();
      return {
        width: metadata?.width ?? 0,
        height: metadata?.height ?? 0,
      };
    } catch (err) {
      Logger.warn('MetadataExtractor', `Failed to extract image dimensions from ${filePath}:`, err);
      return null;
    }
  }

  /**
   * Extract audio metadata using music-metadata (if available).
   * Returns null if music-metadata is not installed or extraction fails.
   */
  static async extractAudioMetadata(filePath: string): Promise<{ duration: number; sampleRate?: number; bitrate?: number } | null> {
    const mm = await getMusicMetadata();
    if (!mm || typeof mm !== 'object' || !('parseFile' in mm)) {
      return null;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = await (mm as any).parseFile(filePath);
      const format = metadata?.format;
      return {
        duration: format?.duration ?? 0,
        sampleRate: format?.sampleRate,
        bitrate: format?.bitrate,
      };
    } catch (err) {
      Logger.warn('MetadataExtractor', `Failed to extract audio metadata from ${filePath}:`, err);
      return null;
    }
  }

  /** Extract metadata for multiple files in parallel. */
  static async extractAll(filePaths: string[]): Promise<Map<string, FragmentMetadata>> {
    const results = new Map<string, FragmentMetadata>();
    const entries = await Promise.allSettled(
      filePaths.map(async (p) => {
        const meta = await this.extract(p);
        return [p, meta] as const;
      })
    );
    for (const entry of entries) {
      if (entry.status === 'fulfilled') {
        results.set(entry.value[0], entry.value[1]);
      }
    }
    return results;
  }

  /** Count lines of code in a file. */
  private static async countLines(filePath: string): Promise<number> {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.split('\n').length;
  }

  /** Compute SHA256 hash of a file. */
  private static async hashFile(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
