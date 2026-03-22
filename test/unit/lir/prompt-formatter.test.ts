/**
 * Unit tests for LIRPromptFormatter
 *
 * Tests compact, budget-aware formatting of LIR tokens for prompt injection
 * and CLI display. TDD: write failing test first, then implement.
 */

import { describe, it, expect } from 'vitest';
import type { Seed } from '../../../src/compost/types.js';
import type { LIRToken, LIRCodeToken, LIRDocToken, LIRTextToken } from '../../../src/core/lir/types.js';
import {
  formatSeedForPrompt,
  formatLIRForPrompt,
  formatSeedForDisplay,
} from '../../../src/core/lir/LIRPromptFormatter.js';

// --- Test fixtures ---

function makeCodeToken(overrides?: Partial<LIRCodeToken>): LIRCodeToken {
  return {
    id: 'code-1',
    type: 'code',
    domain: 'math',
    layer: 'business-logic',
    name: 'fibonacci',
    kind: 'function',
    signature: 'fibonacci(n: number): number',
    summary: 'Computes Fibonacci numbers recursively',
    source: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
    language: 'typescript',
    location: { file: 'math.ts', startLine: 1, endLine: 3 },
    relationships: { calls: ['fibonacci'], imports: [], exports: ['fibonacci'], extends: [], importGraph: [] },
    metrics: { loc: 3, cyclomaticComplexity: 2, paramCount: 1, importCount: 0, exportCount: 1, callCount: 1, classDepth: 0, nestingDepth: 1 },
    metadata: {},
    tags: ['math', 'recursion'],
    ...overrides,
  };
}

function makeDocToken(overrides?: Partial<LIRDocToken>): LIRDocToken {
  return {
    id: 'doc-1',
    type: 'doc',
    domain: 'docs',
    layer: 'presentation',
    heading: 'API Reference',
    level: 2,
    summary: 'Comprehensive API reference for all endpoints',
    content: '# API Reference\n\nAll endpoints return JSON...',
    hierarchy: { parent: 'root', children: ['auth-section'], path: ['root', 'api-ref'] },
    codeReferences: ['getUsers'],
    metrics: { wordCount: 42, codeBlockCount: 3, linkCount: 5, depth: 1 },
    metadata: {},
    tags: ['api', 'reference'],
    ...overrides,
  };
}

function makeTextToken(overrides?: Partial<LIRTextToken>): LIRTextToken {
  return {
    id: 'text-1',
    type: 'text',
    domain: 'general',
    layer: 'presentation',
    content: 'Some interesting text about creative coding and generative art techniques.',
    structure: {
      headings: [{ level: 1, text: 'Introduction' }, { level: 2, text: 'Methods' }],
      codeBlocks: [],
    },
    metrics: { wordCount: 15, paragraphCount: 1, headingCount: 2 },
    metadata: {},
    tags: ['text'],
    ...overrides,
  };
}

function makeSeed(overrides?: Partial<Seed>): Seed {
  return {
    id: 'frag-abc123',
    content: 'raw content here',
    score: 8.5,
    source: { fragments: ['f1'], collisionType: 'heuristic', domains: ['code'] },
    promotedAt: '2026-03-22T12:00:00Z',
    usedBy: [],
    useCount: 0,
    ...overrides,
  };
}

// --- Tests ---

describe('LIRPromptFormatter', () => {
  describe('formatCodeToken', () => {
    it('should format a code token as compact signature + metrics', () => {
      const token = makeCodeToken();
      const result = formatLIRForPrompt(token, 500);

      expect(result).toContain('function');
      expect(result).toContain('fibonacci');
      expect(result).toContain('fibonacci(n: number): number');
      expect(result).toContain('loc: 3');
      expect(result).toContain('complexity: 2');
      expect(result).toContain('exports: fibonacci');
      // Should NOT contain raw source code
      expect(result).not.toContain('return n <= 1');
    });

    it('should not include raw source code', () => {
      const token = makeCodeToken();
      const result = formatLIRForPrompt(token, 500);

      expect(result).not.toContain(token.source);
    });

    it('should show language', () => {
      const token = makeCodeToken();
      const result = formatLIRForPrompt(token, 500);

      expect(result).toContain('typescript');
    });
  });

  describe('formatDocToken', () => {
    it('should format a doc token as heading + summary', () => {
      const token = makeDocToken();
      const result = formatLIRForPrompt(token, 500);

      expect(result).toContain('API Reference');
      expect(result).toContain('Comprehensive API reference for all endpoints');
    });

    it('should show word count', () => {
      const token = makeDocToken();
      const result = formatLIRForPrompt(token, 500);

      expect(result).toContain('words: 42');
    });

    it('should not include full doc content', () => {
      const token = makeDocToken();
      const result = formatLIRForPrompt(token, 500);

      // Should contain heading + summary but not the full body text
      expect(result).not.toContain('All endpoints return JSON');
    });
  });

  describe('formatTextToken', () => {
    it('should format a text token with headings and word count', () => {
      const token = makeTextToken();
      const result = formatLIRForPrompt(token, 500);

      expect(result).toContain('Introduction');
      expect(result).toContain('Methods');
      expect(result).toContain('words: 15');
    });

    it('should handle text token with no headings', () => {
      const token = makeTextToken({
        structure: { headings: [], codeBlocks: [] },
      });
      const result = formatLIRForPrompt(token, 500);

      expect(result).toContain('words: 15');
    });
  });

  describe('formatSeedForPrompt', () => {
    it('should use LIR formatter when seed has a code LIR token', () => {
      const seed = makeSeed({ lir: makeCodeToken() });
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toContain('function');
      expect(result).toContain('fibonacci');
      expect(result).not.toContain('raw content here');
    });

    it('should use LIR formatter when seed has a doc LIR token', () => {
      const seed = makeSeed({ lir: makeDocToken() });
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toContain('API Reference');
      expect(result).not.toContain('raw content here');
    });

    it('should use LIR formatter when seed has a text LIR token', () => {
      const seed = makeSeed({ lir: makeTextToken() });
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toContain('Introduction');
      expect(result).not.toContain('raw content here');
    });

    it('should fall back to raw content when seed has no LIR', () => {
      const seed = makeSeed();
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toBe('raw content here');
    });

    it('should respect budget and truncate long output', () => {
      // Create a code token with a very long summary that would exceed budget
      const token = makeCodeToken({
        summary: 'A'.repeat(1000),
        name: 'veryLongFunctionNameThatExceedsBudget',
        signature: 'veryLongFunctionNameThatExceedsBudget(a: string, b: string, c: string, d: string): VeryLongReturnType',
      });
      const seed = makeSeed({ lir: token });
      const result = formatSeedForPrompt(seed, 100);

      expect(result.length).toBeLessThanOrEqual(105); // budget + margin for truncation marker
    });

    it('should use default budget of 500', () => {
      const seed = makeSeed({ lir: makeCodeToken() });
      const result = formatSeedForPrompt(seed);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(510);
    });
  });

  describe('formatSeedForDisplay', () => {
    it('should show rich multi-line output for code seed', () => {
      const seed = makeSeed({ lir: makeCodeToken() });
      const result = formatSeedForDisplay(seed);

      expect(result).toContain('LIR: code');
      expect(result).toContain('fibonacci');
      expect(result).toContain('fibonacci(n: number): number');
      expect(result).toContain('typescript');
      expect(result).toContain('math.ts:1-3');
      expect(result).toContain('loc=3');
      expect(result).toContain('complexity=2');
      expect(result).toContain('Exports: fibonacci');
    });

    it('should show rich multi-line output for doc seed', () => {
      const seed = makeSeed({ lir: makeDocToken() });
      const result = formatSeedForDisplay(seed);

      expect(result).toContain('LIR: doc');
      expect(result).toContain('API Reference');
      expect(result).toContain('words=42');
    });

    it('should show rich multi-line output for text seed', () => {
      const seed = makeSeed({ lir: makeTextToken() });
      const result = formatSeedForDisplay(seed);

      expect(result).toContain('LIR: text');
      expect(result).toContain('Introduction');
      expect(result).toContain('words=15');
    });

    it('should fall back gracefully when seed has no LIR', () => {
      const seed = makeSeed();
      const result = formatSeedForDisplay(seed);

      expect(result).toContain('raw content here');
      expect(result).not.toContain('LIR:');
    });

    it('should include raw content at the end for seeds with LIR', () => {
      const seed = makeSeed({ lir: makeCodeToken(), content: 'function fibonacci(n) { ... }' });
      const result = formatSeedForDisplay(seed);

      expect(result).toContain('function fibonacci(n) { ... }');
    });
  });
});
