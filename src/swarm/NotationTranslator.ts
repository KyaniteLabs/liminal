/**
 * Bidirectional translator between creative notation tokens and natural language.
 * Wraps CreativeNotation primitives with prompt-aware methods for expert personas.
 */

import {
  NOTATION_REGISTRY,
  expandNotation,
  compressToNotation,
  type NotationToken,
} from './CreativeNotation.js';

/** Sentence-level patterns found in expert prompts, keyed by their ~token. */
const PROMPT_PATTERNS: ReadonlyMap<string, string> = new Map([
  // Philosophy lines (common across experts)
  ['~less-more', 'Less is more: every element must earn its place'],
  ['~nature-curves', 'Nature never draws a straight line'],
  ['~math-language', 'Mathematics is the language of nature'],
  ['~physics-reaction', 'Every action should have an appropriate reaction'],
  ['~music-color', 'Music has color, shape, and motion'],
  // Shared code guidelines
  ['~clean-code', 'Write clean, readable code with clear structure'],
  ['~balance-art', 'Balance artistic expression with technical precision'],
  ['~visual-impact', 'Prioritize visual impact over code complexity'],
  // Prompt structure markers
  ['~philosophy', 'Philosophy:'],
  ['~techniques', 'Code approach:'],
  ['~influences', 'Influences:'],
]);

/** encode/decode handle raw text. encodePrompt/decodePrompt are prompt-aware. */
export class NotationTranslator {
  /** Encode natural language text into notation tokens. */
  encode(text: string): string {
    return compressToNotation(text);
  }

  /** Decode notation tokens back into natural language. */
  decode(notation: string): string {
    return expandNotation(notation);
  }

  /**
   * Compress a full system prompt (e.g. from ExpertPersonas) into notation.
   *
   * Strategy: walk the prompt line-by-line, matching against known patterns.
   * Matched lines collapse to their token. Unmatched lines pass through.
   * Philosophy/technique bullet markers (`- ...`) are stripped to the bare
   * phrase before matching.
   */
  encodePrompt(systemPrompt: string): string {
    const lines = systemPrompt.split('\n');
    const out: string[] = [];

    for (const raw of lines) {
      const trimmed = raw.trim();

      // Skip empty lines but preserve one separator
      if (trimmed === '') {
        if (out[out.length - 1] !== '') out.push('');
        continue;
      }

      // Strip leading bullet for matching
      const content = trimmed.startsWith('- ') ? trimmed.slice(2) : trimmed;

      // Check prompt patterns first
      let matched = false;
      for (const [token, pattern] of PROMPT_PATTERNS) {
        if (content === pattern || content.startsWith(pattern)) {
          out.push(token);
          matched = true;
          break;
        }
      }
      if (matched) continue;

      // Fall through to registry-based compression
      out.push(compressToNotation(content));
    }

    return out.join('\n');
  }

  /**
   * Expand a notation-compressed prompt back to full English.
   *
   * Expands every `~token` it recognises. Lines without tokens pass
   * through unchanged, ready for LLM consumption.
   */
  decodePrompt(notation: string): string {
    return notation
      .split('\n')
      .map(line => {
        // Try expanding via the prompt-pattern map first
        for (const [token, expansion] of PROMPT_PATTERNS) {
          if (line === token) return expansion;
        }
        // Fall through to the global registry
        return expandNotation(line);
      })
      .join('\n');
  }

  /** Expose the underlying registry for inspection or extension. */
  get registry(): ReadonlyMap<string, NotationToken> {
    return NOTATION_REGISTRY;
  }

  /** Expose prompt-specific patterns for inspection. */
  get promptPatterns(): ReadonlyMap<string, string> {
    return PROMPT_PATTERNS;
  }
}
