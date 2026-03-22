/**
 * MetadataExtractor — structured metadata extraction for compost files.
 * No LLM needed — pure parsing and filesystem operations.
 */

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import type { FragmentMetadata } from './types.js';

/** Map of file extensions to programming languages. */
const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
  rb: 'ruby', php: 'php', swift: 'swift', c: 'c', cpp: 'cpp',
  h: 'c', hpp: 'cpp', cs: 'csharp', scala: 'scala',
  glsl: 'glsl', frag: 'glsl', vert: 'glsl',
};

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

    // Image metadata stubs
    // @todo Extract actual dimensions when sharp or image-size is available as a dependency
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tiff'].includes(ext)) {
      metadata.format = ext.toUpperCase();
      metadata.dimensions = { width: 0, height: 0 };
    }

    // Audio metadata stubs
    // @todo Extract actual duration when a media parsing library is available
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
      metadata.format = ext.toUpperCase();
      metadata.duration = 0;
    }

    return metadata;
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
