/**
 * SemanticExtractor — LLM-based semantic content extraction for compost files.
 * Handles text, code, images, audio, and video extraction via LLM.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { PromptLibrary } from '../prompts/PromptLibrary.js';
import { CompostParser } from '../core/parsing/CompostParser.js';
import { lirArrayToString } from '../core/lir/CompatibilityAdapter.js';
import { LIRParseError } from '../core/lir/errors.js';
import type { CompostConfig } from './types.js';
import type { LIRToken } from '../core/lir/types.js';
import { Logger } from '../utils/Logger.js';

/** Minimal LLM client interface. */
export interface LLMClientLike {
  generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<{ code: string; success: boolean }>;
}

export class SemanticExtractor {
  private llm: LLMClientLike;
  private config: CompostConfig;
  private cache = new Map<string, string>();
  private parser?: CompostParser;

  constructor(config: CompostConfig, llm: LLMClientLike, parser?: CompostParser) {
    this.llm = llm;
    this.config = config;
    this.parser = parser;
  }

  /**
   * Set the CompostParser instance for LIR extraction
   * This allows dependency injection for testing
   */
  setParser(parser: CompostParser): void {
    this.parser = parser;
  }

  /** Extract semantic content from text/markdown files. Direct extraction, no LLM. */
  extractText(content: string, filePath: string): string {
    if (!content.trim()) return `[Empty file: ${path.basename(filePath)}]`;
    // Truncate very long files for semantic extraction
    return content.length > 10000 ? content.slice(0, 10000) + '\n... [truncated]' : content;
  }

  /** Extract semantic info from code files using LLM. */
  async extractCode(filePath: string): Promise<string> {
    const cacheKey = `code:${filePath}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).replace('.', '');

    try {
      const { system, user } = PromptLibrary.render('compost.extract-code', {
        filename: path.basename(filePath),
        extension: ext,
        content: content.slice(0, 5000),
      });
      const result = await this.llm.generate(system, user);

      const summary = result.success ? result.code : `[Code file: ${ext}]`;
      this.cache.set(cacheKey, summary);
      return summary;
    } catch (err) {
      Logger.warn('SemanticExtractor', 'extractCode failed:', err);
      const fallback = `[Code file: ${path.basename(filePath)}]`;
      this.cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  /** Extract semantic info from images using vision model.
   *  Returns file metadata until a vision-capable LLM client is available.
   *  Warns so callers know the data is not semantically meaningful.
   */
  extractImage(filePath: string): string {
    const basename = path.basename(filePath);
    try {
      const stat = fsSync.statSync(filePath);
      Logger.warn('SemanticExtractor', `extractImage called for ${basename} — vision LLM not available, returning metadata only`);
      return `[Image: ${basename} — ${(stat.size / 1024).toFixed(1)}KB — vision extraction requires multimodal LLM client]`;
    } catch {
      return `[Image: ${basename} — unreadable]`;
    }
  }

  /** Extract semantic info from audio files.
   *  Returns file metadata (size, duration) with LLM summarization if available.
   *  Notes to caller: (1) Duration requires music-metadata to be installed.
   *                    (2) LLM summarization requires an audio-description prompt template.
   */
  async extractAudio(filePath: string): Promise<string> {
    const basename = path.basename(filePath);
    try {
      const stat = fsSync.statSync(filePath);
      // Try to get audio duration via MetadataExtractor (music-metadata package)
      let durationStr = '';
      try {
        const { MetadataExtractor } = await import('./MetadataExtractor.js');
        const meta = await MetadataExtractor.extractAudioMetadata(filePath);
        if (meta?.duration) {
          durationStr = `, ${Math.round(meta.duration)}s`;
        }
      } catch {
        // music-metadata not available — duration unknown
      }
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
      const meta = `Audio: ${basename} — ${sizeMB}MB${durationStr}`;
      // Attempt LLM summarization via audio analysis prompt if client supports it
      try {
        const { system, user } = PromptLibrary.render('compost.describe-audio', {
          filename: basename,
          size: sizeMB,
          duration: durationStr ? `${durationStr.replace(', ', '')}` : 'unknown',
        });
        const result = await this.llm.generate(system, user);
        if (result.success) return result.code;
      } catch {
        // LLM failed, fall through to metadata-only
      }
      Logger.warn('SemanticExtractor', `extractAudio for ${basename} — using metadata fallback (LLM audio description not available)`);
      return meta;
    } catch {
      return `[Audio: ${basename} — unreadable]`;
    }
  }

  /** Extract semantic info from video files.
   *  Returns file metadata (size) with LLM scene description if available.
   *  Notes to caller: Duration extraction requires ffprobe. LLM scene description
   *                   requires a video-description prompt template.
   */
  async extractVideo(filePath: string): Promise<string> {
    const basename = path.basename(filePath);
    try {
      const stat = fsSync.statSync(filePath);
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
      const meta = `Video: ${basename} — ${sizeMB}MB`;
      // Attempt LLM scene description
      try {
        const { system, user } = PromptLibrary.render('compost.describe-video', {
          filename: basename,
          size: sizeMB,
        });
        const result = await this.llm.generate(system, user);
        if (result.success) return result.code;
      } catch {
        // LLM failed, fall through to metadata-only
      }
      Logger.warn('SemanticExtractor', `extractVideo for ${basename} — using metadata fallback (LLM video description not available)`);
      return meta;
    } catch {
      return `[Video: ${basename} — unreadable]`;
    }
  }

  /**
   * Extract LIR (Liminal Intermediate Representation) from a file
   *
   * When config.lirEnabled is true, attempts to parse the file using CompostParser
   * to extract structured LIR tokens. Falls back to null on parse failure.
   *
   * @param filePath - Path to the file to extract LIR from
   * @returns LIRToken if parsing succeeds, null if LIR is disabled or parsing fails
   */
  async extractLIR(filePath: string): Promise<LIRToken[] | null> {
    // If LIR is disabled, return null immediately
    if (!this.config.lirEnabled) {
      return null;
    }

    // If no parser is available, return null
    if (!this.parser) {
      Logger.warn('SemanticExtractor', 'LIR enabled but no CompostParser provided');
      return null;
    }

    try {
      // Try to parse the file using CompostParser
      const tokens = await this.parser.parseFile(filePath);

      // Return all parsed tokens
      return tokens.length > 0 ? tokens : null;
    } catch (error) {
      // Log warning and return null on parse failure
      if (error instanceof LIRParseError) {
        Logger.warn('SemanticExtractor', `LIR parsing failed for ${filePath}: ${error.message}`);
      } else if (error instanceof Error) {
        Logger.warn('SemanticExtractor', `Unexpected error during LIR extraction for ${filePath}: ${error.message}`);
      }
      return null;
    }
  }

  /** Auto-detect file type and extract semantic content. */
  async extract(filePath: string): Promise<string | null> {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const textExts = ['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'csv', 'xml', 'html', 'css'];
    const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'kt', 'rb', 'php', 'swift', 'c', 'cpp', 'h', 'glsl', 'frag', 'vert'];
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tiff'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

    // If LIR is enabled and this is a code file, try LIR extraction first
    if (this.config.lirEnabled && codeExts.includes(ext)) {
      const lirTokens = await this.extractLIR(filePath);
      if (lirTokens && lirTokens.length > 0) {
        // Convert LIR tokens to string for backward compatibility
        return lirArrayToString(lirTokens);
      }
      // Fall through to legacy extraction if LIR fails
    }

    if (textExts.includes(ext)) {
      const content = await fs.readFile(filePath, 'utf-8').catch((err) => {
        Logger.warn('SemanticExtractor', `Failed to read ${filePath}:`, err instanceof Error ? err.message : err);
        return '';
      });
      return this.extractText(content, filePath);
    }
    if (codeExts.includes(ext)) {
      return this.extractCode(filePath);
    }
    if (imageExts.includes(ext)) {
      return this.extractImage(filePath);
    }
    if (audioExts.includes(ext)) {
      return await this.extractAudio(filePath);
    }
    if (videoExts.includes(ext)) {
      return await this.extractVideo(filePath);
    }

    return null; // Unsupported format
  }

  /** Clear extraction cache. */
  clearCache(): void {
    this.cache.clear();
  }
}
