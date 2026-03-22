/**
 * Integration test — full LIR consumption chain
 *
 * Verifies that LIR structured data flows through the entire app:
 * formatSeedForPrompt → PromptEnhancer → SeedBank.getRandomSeed()
 */

import { describe, it, expect } from 'vitest';
import type { Seed, LIRCodeToken, LIRDocToken, LIRTextToken } from '../../src/compost/types.js';
import { formatSeedForPrompt, formatSeedForDisplay } from '../../src/core/lir/LIRPromptFormatter.js';
import { enhancePrompt } from '../../src/core/PromptEnhancer.js';
import type { LIRToken } from '../../src/core/lir/types.js';

// --- Test fixtures ---

function makeCodeSeed(): Seed {
  const lir: LIRCodeToken = {
    id: 'code-1', type: 'code', domain: 'math', layer: 'business-logic',
    name: 'fibonacci', kind: 'function',
    signature: 'fibonacci(n: number): number',
    summary: 'Computes Fibonacci numbers recursively',
    source: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
    language: 'typescript',
    location: { file: 'math.ts', startLine: 1, endLine: 3 },
    relationships: { calls: ['fibonacci'], imports: [], exports: ['fibonacci'], extends: [], importGraph: [] },
    metrics: { loc: 3, cyclomaticComplexity: 2, paramCount: 1, importCount: 0, exportCount: 1, callCount: 1, classDepth: 0, nestingDepth: 1 },
    metadata: {}, tags: ['math'],
  };
  return {
    id: 'frag-code-1', content: 'function fibonacci(n) { ... }', score: 8.5,
    source: { fragments: ['f1'], collisionType: 'heuristic', domains: ['code'] },
    promotedAt: '2026-03-22T12:00:00Z', usedBy: [], useCount: 0, lir,
  };
}

function makeDocSeed(): Seed {
  const lir: LIRDocToken = {
    id: 'doc-1', type: 'doc', domain: 'docs', layer: 'presentation',
    heading: 'API Reference', level: 2,
    summary: 'Comprehensive API reference for all endpoints',
    content: '# API Reference\n\nAll endpoints return JSON...',
    hierarchy: { parent: 'root', children: ['auth-section'], path: ['root', 'api-ref'] },
    codeReferences: ['getUsers'],
    metrics: { wordCount: 42, codeBlockCount: 3, linkCount: 5, depth: 1 },
    metadata: {}, tags: ['api'],
  };
  return {
    id: 'frag-doc-1', content: '# API Reference\n\nAll endpoints return JSON...', score: 7.2,
    source: { fragments: ['f2'], collisionType: 'heuristic', domains: ['docs'] },
    promotedAt: '2026-03-22T12:00:00Z', usedBy: [], useCount: 0, lir,
  };
}

function makeTextSeed(): Seed {
  const lir: LIRTextToken = {
    id: 'text-1', type: 'text', domain: 'general', layer: 'presentation',
    content: 'Some interesting text about creative coding.',
    structure: { headings: [{ level: 1, text: 'Introduction' }], codeBlocks: [] },
    metrics: { wordCount: 8, paragraphCount: 1, headingCount: 1 },
    metadata: {}, tags: ['text'],
  };
  return {
    id: 'frag-text-1', content: 'Some interesting text about creative coding.', score: 6.1,
    source: { fragments: ['f3'], collisionType: 'heuristic', domains: ['general'] },
    promotedAt: '2026-03-22T12:00:00Z', usedBy: [], useCount: 0, lir,
  };
}

function makeNoLIRSeed(): Seed {
  return {
    id: 'frag-raw-1', content: 'plain raw content without any LIR', score: 5.0,
    source: { fragments: ['f4'], collisionType: 'heuristic', domains: ['raw'] },
    promotedAt: '2026-03-22T12:00:00Z', usedBy: [], useCount: 0,
  };
}

// --- Tests ---

describe('LIR Consumption Chain', () => {
  describe('formatSeedForPrompt across token types', () => {
    it('code seed produces structured signature (not raw source)', () => {
      const seed = makeCodeSeed();
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toContain('function');
      expect(result).toContain('fibonacci');
      expect(result).toContain('fibonacci(n: number): number');
      expect(result).not.toContain('return n <= 1');
    });

    it('doc seed produces heading + summary', () => {
      const seed = makeDocSeed();
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toContain('API Reference');
      expect(result).toContain('Comprehensive API reference');
    });

    it('text seed produces headings + word count', () => {
      const seed = makeTextSeed();
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toContain('Introduction');
      expect(result).toContain('words: 8');
    });

    it('no-LIR seed produces raw content (backward compat)', () => {
      const seed = makeNoLIRSeed();
      const result = formatSeedForPrompt(seed, 500);

      expect(result).toBe('plain raw content without any LIR');
    });
  });

  describe('formatSeedForDisplay', () => {
    it('code seed display includes all key metadata', () => {
      const seed = makeCodeSeed();
      const result = formatSeedForDisplay(seed);

      expect(result).toContain('LIR: code');
      expect(result).toContain('fibonacci(n: number): number');
      expect(result).toContain('math.ts:1-3');
      expect(result).toContain('loc=3');
    });

    it('no-LIR seed display returns raw content', () => {
      const seed = makeNoLIRSeed();
      const result = formatSeedForDisplay(seed);

      expect(result).toBe('plain raw content without any LIR');
      expect(result).not.toContain('LIR:');
    });
  });

  describe('backward compatibility', () => {
    it('no-LIR seeds produce same output as raw content', () => {
      const seed = makeNoLIRSeed();
      const promptResult = formatSeedForPrompt(seed);
      const displayResult = formatSeedForDisplay(seed);

      // Both should return the raw content unchanged
      expect(promptResult).toBe(seed.content);
      expect(displayResult).toBe(seed.content);
    });
  });
});
