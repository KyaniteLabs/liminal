/**
 * Unit tests for SeedBank.getRandomSeed()
 *
 * Tests that the new method returns full Seed objects with LIR data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { SeedBank } from '../../../src/compost/SeedBank.js';
import type { CompostConfig, Seed } from '../../../src/compost/types.js';
import type { LIRCodeToken } from '../../../src/core/lir/types.js';

/** Create a temp directory and return its path. */
async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-test-'));
}

/** Build a minimal CompostConfig pointing at a temp dir. */
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

function makeSeedWithLIR(overrides?: Partial<Seed>): Seed {
  const lir: LIRCodeToken = {
    id: 'code-1',
    type: 'code',
    domain: 'math',
    layer: 'business-logic',
    name: 'fibonacci',
    kind: 'function',
    signature: 'fibonacci(n: number): number',
    summary: 'Computes Fibonacci numbers',
    source: 'function fibonacci(n) { ... }',
    language: 'typescript',
    location: { file: 'math.ts', startLine: 1, endLine: 3 },
    relationships: { calls: [], imports: [], exports: ['fibonacci'], extends: [], importGraph: [] },
    metrics: { loc: 3, cyclomaticComplexity: 1, paramCount: 1, importCount: 0, exportCount: 1, callCount: 0, classDepth: 0, nestingDepth: 0 },
    metadata: {},
    tags: ['math'],
  };

  return {
    id: 'frag-test-1',
    content: 'raw content',
    score: 8.5,
    source: { fragments: ['f1'], collisionType: 'heuristic', domains: ['code'] },
    promotedAt: '2026-03-22T12:00:00Z',
    usedBy: [],
    useCount: 0,
    lir,
    ...overrides,
  };
}

describe('SeedBank.getRandomSeed()', () => {
  let seedDir: string;

  beforeEach(async () => {
    seedDir = await tmpDir();
  });

  it('should return a full Seed object with all fields including lir', async () => {
    const bank = new SeedBank(makeConfig(seedDir));
    const seed = makeSeedWithLIR();
    await bank.add(seed);

    const result = await bank.getRandomSeed();

    expect(result!.id).toBe('frag-test-1');
    expect(result!.content).toBe('raw content');
    expect(result!.score).toBe(8.5);

    expect(result!.lir!.type).toBe('code');
    expect(result!.lir!.name).toBe('fibonacci');
  });

  it('should return undefined when bank is empty', async () => {
    const bank = new SeedBank(makeConfig(seedDir));

    const result = await bank.getRandomSeed();

    expect(result).toBeUndefined();
  });

  it('getRandomSeed() returns a seed with content', async () => {
    const bank = new SeedBank(makeConfig(seedDir));
    const seed = makeSeedWithLIR();
    await bank.add(seed);

    const result = await bank.getRandomSeed();

    expect(result).not.toBeNull();
    expect(result!.lir).not.toBeNull();
  });

  it('should return a seed from the bank when multiple seeds exist', async () => {
    const bank = new SeedBank(makeConfig(seedDir));
    await bank.add(makeSeedWithLIR({ id: 'seed-a', content: 'content a' }));
    await bank.add(makeSeedWithLIR({ id: 'seed-b', content: 'content b' }));

    const result = await bank.getRandomSeed();

    expect(result).not.toBeNull();
    expect(['seed-a', 'seed-b']).toContain(result!.id);
  });
});
