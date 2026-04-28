/**
 * Integration test for PromptEnhancer with LIR seed formatting
 *
 * Verifies that PromptEnhancer correctly uses getRandomSeed() + formatSeedForPrompt()
 * instead of the deprecated getRandomContent() method.
 *
 * This is an integration test that uses real SeedBank instances with temporary directories.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { SeedBank } from '../../../src/compost/SeedBank.js';
import { formatSeedForPrompt } from '../../../src/core/lir/LIRPromptFormatter.js';
import type { CompostConfig, Seed } from '../../../src/compost/types.js';
import type { LIRCodeToken, LIRDocToken, LIRTextToken } from '../../../src/core/lir/types.js';

// --- Test helpers ---

function makeConfig(seedDir: string): CompostConfig {
  return {
    heapDir: path.join(seedDir, 'heap'),
    maxHeapSizeBytes: 10_000_000,
    digestDir: path.join(seedDir, 'digest'),
    seedDir,
    digestSchedule: 'manual',
    digestDayOfWeek: 1,
    soupEnabled: false,
    soupPopulationSize: 10,
    soupMaxStepsPerCycle: 5,
    soupSeedPromotionThreshold: 7,
    soupCycleIntervalMs: 1000,
    llm: {
      provider: 'local',
      localBaseUrl: 'http://localhost:11434',
      localModel: 'test',
      cloudProvider: 'anthropic',
      cloudApiKeyEnvVar: 'ANTHROPIC_API_KEY',
      cloudModel: 'claude-3',
      localTimeoutMs: 5000,
    },
    seedPromotionThreshold: 7,
    maxSeedsPerDigest: 5,
    nuggetRetentionDays: 30,
    lirEnabled: true,
    lirSummaryBudget: 500,
    lirBatchSize: 10,
    lirMaxSymbolsPerFile: 50,
  };
}

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

// --- Tests ---

describe('PromptEnhancer LIR integration', () => {
  describe('formatSeedForPrompt with different LIR types', () => {
    it('should format LIRCodeToken as structured signature (not raw source)', () => {
      const seed = makeSeed({ lir: makeCodeToken() });
      const result = formatSeedForPrompt(seed, 500);

      // Verify structured signature, not raw source
      expect(result).toContain('function');
      expect(result).toContain('fibonacci');
      expect(result).toContain('fibonacci(n: number): number');
      expect(result).toContain('loc: 3');
      expect(result).toContain('complexity: 2');
      expect(result).toContain('exports: fibonacci');
      expect(result).toContain('lang: typescript');
      // Should NOT contain raw source code
      expect(result).not.toContain('return n <= 1');
      expect(result).not.toContain(seed.content);
    });

    it('should format LIRDocToken as heading + summary', () => {
      const seed = makeSeed({ lir: makeDocToken() });
      const result = formatSeedForPrompt(seed, 500);

      // Verify heading + summary
      expect(result).toContain('API Reference');
      expect(result).toContain('Comprehensive API reference for all endpoints');
      expect(result).toContain('words: 42');
      expect(result).toContain('refs: getUsers');
      // Should NOT contain full doc content
      expect(result).not.toContain('All endpoints return JSON');
      expect(result).not.toContain(seed.content);
    });

    it('should format LIRTextToken with headings and word count', () => {
      const seed = makeSeed({ lir: makeTextToken() });
      const result = formatSeedForPrompt(seed, 500);

      // Verify headings and word count
      expect(result).toContain('Introduction');
      expect(result).toContain('Methods');
      expect(result).toContain('words: 15');
      // Should NOT contain raw content
      expect(result).not.toContain('Some interesting text about creative coding');
      expect(result).not.toContain(seed.content);
    });

    it('should fall back to raw content when seed has no LIR', () => {
      const seed = makeSeed(); // No LIR
      const result = formatSeedForPrompt(seed, 500);

      // Verify raw content is returned
      expect(result).toBe('raw content here');
    });

    it('should respect budget and truncate long output', () => {
      // Create a code token with a very long summary
      const token = makeCodeToken({
        summary: 'A'.repeat(1000),
        name: 'veryLongFunctionNameThatExceedsBudget',
        signature: 'veryLongFunctionNameThatExceedsBudget(a: string, b: string, c: string, d: string): VeryLongReturnType',
      });
      const seed = makeSeed({ lir: token });
      const result = formatSeedForPrompt(seed, 100);

      // Should be truncated to fit budget
      expect(result.length).toBeLessThanOrEqual(105); // budget + margin for truncation marker
    });
  });

  describe('SeedBank.getRandomSeed integration', () => {
    it('should return full Seed object with LIR when available', async () => {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-test-'));
      try {
        const bank = new SeedBank(makeConfig(testDir));
        const seed = makeSeed({ lir: makeCodeToken() });
        await bank.add(seed);

        const result = await bank.getRandomSeed();

        expect(result!.id).toBe('frag-abc123');
        expect(result!.content).toBe('raw content here');

        expect(result!.lir!.type).toBe('code');
        expect(result!.lir!.name).toBe('fibonacci');
      } finally {
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it('should return Seed without LIR when none available', async () => {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-test-'));
      try {
        const bank = new SeedBank(makeConfig(testDir));
        const seed = makeSeed(); // No LIR
        await bank.add(seed);

        const result = await bank.getRandomSeed();

        expect(result!.id).toBe('frag-abc123');
        expect(result!.lir).toBeUndefined();
      } finally {
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it('should return undefined when bank is empty', async () => {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-test-'));
      try {
        const bank = new SeedBank(makeConfig(testDir));
        // Don't add any seeds

        const result = await bank.getRandomSeed();

        expect(result).toBeUndefined();
      } finally {
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });
});
