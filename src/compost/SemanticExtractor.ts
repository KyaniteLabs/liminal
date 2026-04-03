/**
 * SemanticExtractor — LLM-based semantic content extraction for compost files.
 * Handles text, code, images, audio, and video extraction via LLM.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PromptLibrary } from '../prompts/PromptLibrary.js';
import { CompostParser } from '../core/parsing/CompostParser.js';
import { lirArrayToString } from '../core/lir/CompatibilityAdapter.js';
import { LIRParseError } from '../core/lir/errors.js';
import type { CompostConfig } from './types.js';
import type { LIRToken } from '../core/lir/types.js';

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
      console.warn('[SemanticExtractor] extractCode failed:', err);
      const fallback = `[Code file: ${path.basename(filePath)}]`;
      this.cache.set(cacheKey, fallback);
      return fallback;
    }
  }

  /** Extract semantic info from images using vision model.
   *  @todo Implement when LLM client supports multimodal (image) inputs.
   *  Currently returns a stub since the LLMClientLike interface does not support image data.
   */
  extractImage(filePath: string): string {
    return `[Image file: ${path.basename(filePath)} — multimodal extraction requires vision-capable LLM client]`;
  }

  /** Extract semantic info from audio files.
   *  @todo Implement using Whisper API or similar for transcription + LLM summarization.
   *  @deprecated Stub — returns placeholder text, not real transcription.
   */
  extractAudio(filePath: string): string {
    return `[Audio file: ${path.basename(filePath)} — transcription/summary not yet implemented]`;
  }

  /** Extract semantic info from video files.
   *  @todo Implement using frame sampling + vision model for scene description.
   *  @deprecated Stub — returns placeholder text, not real scene descriptions.
   */
  extractVideo(filePath: string): string {
    return `[Video file: ${path.basename(filePath)} — frame description not yet implemented]`;
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
      console.warn('[SemanticExtractor] LIR enabled but no CompostParser provided');
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
        console.warn(
          `[SemanticExtractor] LIR parsing failed for ${filePath}: ${error.message}`,
        );
      } else if (error instanceof Error) {
        console.warn(
          `[SemanticExtractor] Unexpected error during LIR extraction for ${filePath}: ${error.message}`,
        );
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
        console.warn(`[SemanticExtractor] Failed to read ${filePath}:`, err instanceof Error ? err.message : err);
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
      return this.extractAudio(filePath);
    }
    if (videoExts.includes(ext)) {
      return this.extractVideo(filePath);
    }

    return null; // Unsupported format
  }

  /** Clear extraction cache. */
  clearCache(): void {
    this.cache.clear();
  }
}
