import { describe, it, expect } from 'vitest';
/**
 * Tests for compost type definitions and defaults.
 */

import type {
  CompostFragment,
  FragmentScore,
  Seed,
  SoupState,
  CollisionResult,
  DigestStats,
  FragmentMetadata,
  RawByteData,
  ExtractionResult,
  DigestResult,
  MillStatus,
  FragmentLayer,
} from '../../src/compost/types.js';

describe('Compost Types', () => {
  it('CompostFragment has all required fields', () => {
    const frag: CompostFragment = {
      id: 'frag-1',
      source: '/path/to/file.txt',
      domain: 'ceramics',
      layer: 'semantic' as FragmentLayer,
      content: 'Some content',
      metadata: {
        fileType: 'txt',
        timestamp: new Date().toISOString(),
        hash: 'abc123',
        size: 100,
        extractedAt: new Date().toISOString(),
      },
      tags: ['ceramics', 'text'],
    };
    expect(frag.id).toBe('frag-1');
    expect(frag.layer).toBe('semantic');
    expect(frag.score).toBeUndefined();
  });

  it('FragmentScore has all 6 dimensions plus total', () => {
    const score: FragmentScore = {
      total: 7.5,
      novelty: 0.8,
      density: 0.7,
      crossDomain: 0.9,
      metadataRarity: 0.6,
      connectionStrength: 0.5,
    };
    expect(Object.keys(score)).toHaveLength(6);
    expect(score.total).toBe(7.5);
  });

  it('Seed has usage tracking fields', () => {
    const seed: Seed = {
      id: 'seed-1',
      content: 'A creative idea',
      score: 8.5,
      source: {
        fragments: ['frag-1', 'frag-2'],
        collisionType: 'timestamp',
        domains: ['ceramics', 'music'],
      },
      promotedAt: new Date().toISOString(),
      usedBy: [],
      useCount: 0,
    };
    expect(seed.usedBy).toEqual([]);
    expect(seed.useCount).toBe(0);
  });

  it('SoupState has population and generation tracking', () => {
    const state: SoupState = {
      population: [],
      generation: 0,
      bestSeed: null,
      totalSeedsPromoted: 0,
      domainHeatmap: {},
      lastCycleAt: '',
    };
    expect(state.population).toEqual([]);
    expect(state.generation).toBe(0);
  });

  it('CollisionResult links two fragments with a strategy', () => {
    const frag: CompostFragment = {
      id: 'f1',
      source: 'a.txt',
      domain: 'ceramics',
      layer: 'semantic',
      content: 'clay',
      metadata: { fileType: 'txt', timestamp: '', hash: '', size: 0, extractedAt: '' },
      tags: [],
    };
    const result: CollisionResult = {
      fragmentA: frag,
      fragmentB: { ...frag, id: 'f2', domain: 'music', content: 'rhythm' },
      strategy: 'domain-opposite',
      mergedContent: 'clay rhythm',
    };
    expect(result.strategy).toBe('domain-opposite');
  });

  it('DigestStats tracks file processing metrics', () => {
    const stats: DigestStats = {
      filesProcessed: 10,
      totalBytes: 1024,
      domains: ['ceramics', 'music'],
      fragmentCount: 50,
      collisionCount: 20,
      seedsPromoted: 5,
      soupCycles: 100,
      durationMs: 5000,
    };
    expect(stats.filesProcessed).toBe(10);
    expect(stats.domains).toHaveLength(2);
  });

  it('DigestResult wraps stats, seeds, and path', () => {
    const result: DigestResult = {
      stats: {
        filesProcessed: 1,
        totalBytes: 100,
        domains: [],
        fragmentCount: 0,
        collisionCount: 0,
        seedsPromoted: 0,
        soupCycles: 0,
        durationMs: 0,
      },
      seeds: [],
      digestPath: 'compost/digest/2026-03-20.md',
    };
    expect(result.digestPath).toContain('digest');
  });

  it('MillStatus captures heap and soup state', () => {
    const status: MillStatus = {
      heapSize: 1024,
      heapFileCount: 5,
      seedCount: 10,
      soupRunning: false,
      soupGeneration: 0,
      lastDigestAt: null,
    };
    expect(status.soupRunning).toBe(false);
    expect(status.lastDigestAt).toBeNull();
  });

  it('FragmentMetadata supports domain-specific fields', () => {
    const meta: FragmentMetadata = {
      fileType: 'jpg',
      timestamp: '',
      hash: '',
      size: 5000,
      extractedAt: '',
      dimensions: { width: 1920, height: 1080 },
      format: 'JPEG',
      iso: 400,
      exposure: 1.0 / 125,
    };
    expect(meta.dimensions?.width).toBe(1920);
    expect(meta.iso).toBe(400);
  });

  it('RawByteData captures hex and hash info', () => {
    const data: RawByteData = {
      headerHex: '89504e47',
      tailHex: 'ae426082',
      sha256: 'a'.repeat(64),
      size: 1024,
      hexChunks: ['89504e47'],
      base64: null,
    };
    expect(data.sha256).toHaveLength(64);
    expect(data.base64).toBeNull();
  });

  it('ExtractionResult combines all three layers', () => {
    const meta: FragmentMetadata = {
      fileType: 'txt',
      timestamp: '',
      hash: '',
      size: 50,
      extractedAt: '',
    };
    const raw: RawByteData = {
      headerHex: '',
      tailHex: '',
      sha256: '',
      size: 50,
      hexChunks: [],
      base64: null,
    };
    const result: ExtractionResult = {
      filePath: '/test/file.txt',
      semantic: 'Hello world',
      metadata: meta,
      rawBytes: raw,
    };
    expect(result.semantic).toBe('Hello world');
  });
});
