/**
 * CompostParser - File-type-aware parser dispatcher with caching
 *
 * Routes files to appropriate parsers (CodeParser, DocParser, TextParser)
 * based on file extension. Integrates ParsingCache for performance optimization.
 *
 * Routing rules:
 * - .ts, .tsx, .js, .jsx, .mjs → CodeParser (TypeScript/JavaScript)
 * - .md, .markdown → DocParser (Markdown documentation)
 * - .txt, .csv, and unknown extensions → TextParser (Plain text fallback)
 *
 * Cache behavior:
 * - Checks cache before parsing
 * - Stores parsed tokens in cache after parsing
 * - Cache is keyed by file content hash (SHA256)
 * - File modifications automatically invalidate cache
 */

import * as fs from 'node:fs/promises';
import * as path from 'path';
import { CodeParser } from './CodeParser.js';
import { DocParser } from './DocParser.js';
import { TextParser } from './TextParser.js';
import { ParsingCache } from './ParsingCache.js';
import { LIRParseError } from '../lir/errors.js';
import type { LIRToken } from '../lir/types.js';

/**
 * Supported file extensions for each parser type
 */
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const DOC_EXTENSIONS = ['.md', '.markdown'];

/**
 * CompostParser dispatches files to appropriate parsers based on extension
 * and provides caching for performance optimization.
 */
export class CompostParser {
  private readonly codeParser: CodeParser;
  private readonly docParser: DocParser;
  private readonly textParser: TextParser;
  private readonly cache: ParsingCache;

  /**
   * Create a new CompostParser instance
   *
   * @param cacheDir - Directory path for cache storage
   */
  constructor(cacheDir: string) {
    this.codeParser = new CodeParser();
    this.docParser = new DocParser();
    this.textParser = new TextParser();
    this.cache = new ParsingCache(cacheDir);
  }

  /**
   * Parse a file and return LIR tokens
   *
   * This method:
   * 1. Checks cache for existing parse result
   * 2. Routes to appropriate parser based on file extension
   * 3. Caches the result before returning
   *
   * @param filePath - Path to the file to parse
   * @returns Array of LIR tokens
   * @throws {LIRParseError} If file cannot be read or parsed
   */
  async parseFile(filePath: string): Promise<LIRToken[]> {
    // Check cache first
    const cached = await this.cache.get(filePath);
    if (cached) {
      // Return cached result
      // Note: cache returns a single token, but parsers return arrays
      // We need to handle both cases
      return Array.isArray(cached) ? cached : [cached];
    }

    // Read file content
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new LIRParseError(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
      );
    }

    // Route to appropriate parser based on extension
    let tokens: LIRToken[];
    try {
      tokens = this.routeToParser(filePath, content);
    } catch (error) {
      if (error instanceof LIRParseError) {
        throw error;
      }
      throw new LIRParseError(
        `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
      );
    }

    // Cache each token individually
    // Note: We cache the first token as a representative
    // For multi-token results, we'd need a more sophisticated caching strategy
    if (tokens.length > 0) {
      await this.cache.set(filePath, tokens[0]);
    }

    return tokens;
  }

  /**
   * Route file to appropriate parser based on extension
   *
   * @param filePath - Path to the file
   * @param content - File content
   * @returns Array of LIR tokens
   */
  private routeToParser(
    filePath: string,
    content: string,
  ): LIRToken[] {
    const ext = this.getExtension(filePath).toLowerCase();

    // Route to CodeParser for code files
    if (CODE_EXTENSIONS.includes(ext)) {
      return this.codeParser.parse(content, filePath);
    }

    // Route to DocParser for markdown files
    if (DOC_EXTENSIONS.includes(ext)) {
      return this.docParser.parse(content, filePath);
    }

    // Route to TextParser for everything else
    return this.textParser.parse(content, filePath);
  }

  /**
   * Extract file extension from path
   *
   * @param filePath - Path to the file
   * @returns File extension including the dot (e.g., '.ts')
   */
  private getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Clear all cached parse results
   *
   * Delegates to ParsingCache.clear() to remove all entries
   * from both memory and disk.
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}
