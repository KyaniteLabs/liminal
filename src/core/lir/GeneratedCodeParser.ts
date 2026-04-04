/**
 * GeneratedCodeParser - Fast, ephemeral LIR parsing of generated code
 *
 * Wraps CodeParser to parse freshly generated code (e.g., from RalphLoop)
 * into LIRCodeToken[] for structured evaluation by aesthetic critics
 * and CreativeEvaluator.
 *
 * Not cached — generated code is ephemeral and unique per iteration.
 * Falls back to empty array on parse errors (triggers regex fallback).
 */

import { CodeParser } from '../parsing/CodeParser.js';
import { Logger } from '../../utils/Logger.js';
import type { LIRCodeToken } from './types.js';

export class GeneratedCodeParser {
  private parser = new CodeParser({ maxSymbolsPerFile: 100 });

  /**
   * Parse generated code into LIR tokens.
   *
   * Uses a synthetic file path since generated code has no file on disk.
   * Returns empty array on parse errors (e.g., p5.js global mode)
   * so callers can fall back to regex-based evaluation.
   */
  parse(generatedCode: string): LIRCodeToken[] {
    if (!generatedCode || generatedCode.trim().length === 0) {
      return [];
    }
    try {
      return this.parser.parse(generatedCode, 'generated.js');
    } catch (err) {
      Logger.debug('GeneratedCodeParser', 'Parse failed, returning empty:', err instanceof Error ? err.message : err);
      return [];
    }
  }
}
