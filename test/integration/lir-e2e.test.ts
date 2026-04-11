/**
 * End-to-end LIR verification test.
 *
 * Validates the full pipeline: add → extract → shred → score → promote → seed
 * with real parsers (no mocks) and verifies LIR tokens flow through correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostMill } from '../../src/compost/CompostMill.js';
import { CompostParser } from '../../src/core/parsing/CompostParser.js';
import type { LLMClientLike } from '../../src/compost/SemanticExtractor.js';
import type { LIRCodeToken, LIRDocToken, LIRTextToken } from '../../src/core/lir/types.js';

const createMockLLM = (): LLMClientLike => ({
  generate: vi.fn().mockResolvedValue({ code: 'mock', success: true }),
    generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }),
    generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }),
});

const TS_CODE = `export function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export class Sequence {
  private values: number[] = [];

  add(n: number): void {
    this.values.push(n);
  }

  sum(): number {
    return this.values.reduce((a, b) => a + b, 0);
  }
}
`;

const MD_CONTENT = `# API Reference

## fibonacci(n: number): number

Computes the nth Fibonacci number.

\`\`\`typescript
fibonacci(10) // 55
\`\`\`

## Sequence

A class for managing numeric sequences.

### add(n: number): void

Adds a number to the sequence.
`;

const TXT_CONTENT = `Liminal is a creative coding platform.

It supports generative art, music, and interactive experiences.

The compost system digests raw materials into reusable seeds.
`;

let tempDir: string;

function makeConfig(lirEnabled: boolean, heapDir: string, seedDir: string) {
  return {
    heapDir,
    seedDir,
    digestDir: path.join(heapDir, 'digest'),
    lirEnabled,
    soupEnabled: false,
    seedPromotionThreshold: 0.0,
    maxSeedsPerDigest: 100,
    fastLLM: createMockLLM() as LLMClientLike,
  };
}

describe('LIR E2E — full pipeline verification', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lir-e2e-'));
    const heapDir = path.join(tempDir, 'heap');
    await fs.mkdir(heapDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('.ts file → seed has LIRCodeToken with symbols, metrics, relationships', async () => {
    const heapDir = path.join(tempDir, 'heap');
    const seedDir = path.join(tempDir, 'seeds');
    await fs.writeFile(path.join(heapDir, 'math.ts'), TS_CODE);

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(createMockLLM(), makeConfig(true, heapDir, seedDir));
    mill.setParser(parser);

    const result = await mill.digest();

    // Should have seeds with code LIR
    const codeSeeds = result.seeds.filter(s => s.lir?.type === 'code');
    expect(codeSeeds.length).toBeGreaterThanOrEqual(1);

    const token = codeSeeds[0].lir as LIRCodeToken;
    expect(token.type).toBe('code');
    // Must have core fields
    expect(token.name).toBeDefined();
    expect(token.kind).toBeDefined();
    expect(token.signature).toBeDefined();
    expect(token.source).toBeDefined();
    expect(token.language).toBe('typescript');
    // Must have metrics
    expect(token.metrics.loc).toBeGreaterThan(0);
    expect(typeof token.metrics.cyclomaticComplexity).toBe('number');
    // Must have relationships
    expect(Array.isArray(token.relationships.calls)).toBe(true);
    expect(Array.isArray(token.relationships.imports)).toBe(true);
    expect(Array.isArray(token.relationships.exports)).toBe(true);
  });

  it('.md file → seed has LIRDocToken with sections', async () => {
    const heapDir = path.join(tempDir, 'heap');
    const seedDir = path.join(tempDir, 'seeds');
    await fs.writeFile(path.join(heapDir, 'api.md'), MD_CONTENT);

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(createMockLLM(), makeConfig(true, heapDir, seedDir));
    mill.setParser(parser);

    const result = await mill.digest();

    const docSeeds = result.seeds.filter(s => s.lir?.type === 'doc');
    expect(docSeeds.length).toBeGreaterThanOrEqual(1);

    const token = docSeeds[0].lir as LIRDocToken;
    expect(token.type).toBe('doc');
    expect(token.heading).toBeDefined();
    expect(typeof token.level).toBe('number');
    expect(token.content).toBeDefined();
    // Must have hierarchy
    expect(token.hierarchy).toBeDefined();
    expect(typeof token.metrics.wordCount).toBe('number');
  });

  it('.txt file → seed has LIRTextToken', async () => {
    const heapDir = path.join(tempDir, 'heap');
    const seedDir = path.join(tempDir, 'seeds');
    await fs.writeFile(path.join(heapDir, 'notes.txt'), TXT_CONTENT);

    const parser = new CompostParser(path.join(tempDir, 'cache'));
    const mill = new CompostMill(createMockLLM(), makeConfig(true, heapDir, seedDir));
    mill.setParser(parser);

    const result = await mill.digest();

    const textSeeds = result.seeds.filter(s => s.lir?.type === 'text');
    expect(textSeeds.length).toBeGreaterThanOrEqual(1);

    const token = textSeeds[0].lir as LIRTextToken;
    expect(token.type).toBe('text');
    expect(token.content).toBeDefined();
    expect(token.metrics.wordCount).toBeGreaterThan(0);
    expect(token.metrics.paragraphCount).toBeGreaterThan(0);
    expect(Array.isArray(token.structure.headings)).toBe(true);
  });

  it('lirEnabled: false → regression gate (same behavior as before)', async () => {
    const heapDir = path.join(tempDir, 'heap');
    const seedDir = path.join(tempDir, 'seeds');
    await fs.writeFile(path.join(heapDir, 'math.ts'), TS_CODE);
    await fs.writeFile(path.join(heapDir, 'api.md'), MD_CONTENT);

    // No parser, no LIR — fully legacy mode
    const mill = new CompostMill(createMockLLM(), makeConfig(false, heapDir, seedDir));

    const result = await mill.digest();

    // Should still produce seeds
    expect(result.seeds.length).toBeGreaterThanOrEqual(1);

    // No seeds should have LIR
    for (const seed of result.seeds) {
      expect(seed.lir).toBeUndefined();
    }
  });
});
