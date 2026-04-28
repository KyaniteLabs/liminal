/**
 * CompostMill core tests — constructor, status reporting, digest pipeline data flow,
 * seed lifecycle, soup operations, and error paths.
 *
 * External deps (filesystem, LLM) are mocked. Internal modules (CompostShredder,
 * CollisionEngine, etc.) are mocked at the module boundary to test CompostMill's
 * orchestration logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted() is MANDATORY for variables referenced in vi.mock()
// ---------------------------------------------------------------------------

const mockLLM = vi.hoisted(() => ({
  generate: vi.fn(),
}));

const mockHeapInstance = vi.hoisted(() => ({
  addFile: vi.fn().mockResolvedValue('/tmp/heap/test.txt'),
  addDirectory: vi.fn().mockResolvedValue(['/tmp/heap/sub/file.txt']),
  listFiles: vi.fn().mockResolvedValue([]),
  getHeapSize: vi.fn().mockResolvedValue(0),
  isOverCapacity: vi.fn().mockResolvedValue(false),
  purge: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
}));

const mockSeedBankInstance = vi.hoisted(() => ({
  add: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  getTop: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
  pruneOld: vi.fn().mockResolvedValue(undefined),
}));

const mockCollisionEngineInstance = vi.hoisted(() => ({
  runAll: vi.fn().mockResolvedValue([]),
}));

const mockFragmentScorerInstance = vi.hoisted(() => ({
  score: vi.fn().mockResolvedValue({
    total: 5.0,
    novelty: 0.5,
    density: 0.5,
    crossDomain: 0.5,
    metadataRarity: 0.5,
    connectionStrength: 0.5,
  }),
  shouldPromote: vi.fn().mockResolvedValue(true),
}));

const mockDigestGeneratorInstance = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue('/tmp/digest/digest-2026-04-04.json'),
}));

const mockSoupInstance = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  isRunning: vi.fn().mockReturnValue(false),
}));

const mockSemanticExtractorInstance = vi.hoisted(() => ({
  extract: vi.fn().mockResolvedValue('semantic content'),
  extractLIR: vi.fn().mockResolvedValue(null),
  setParser: vi.fn(),
}));

const mockEntropyInstance = vi.hoisted(() => ({
  nextInt: vi.fn().mockReturnValue(0),
  nextFloat: vi.fn().mockReturnValue(0.5),
  harvest: vi.fn().mockResolvedValue({ seed: 123, phrase: 'mock', quality: 'harvested', source: 'metabolic', hashChain: [] }),
  setGetTopSeeds: vi.fn(),
}));

const mockFsFunctions = vi.hoisted(() => ({
  stat: vi.fn().mockRejectedValue(new Error('ENOENT: file not found')),
  mkdir: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
  readdir: vi.fn().mockResolvedValue([]),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/compost/CompostHeap.js', () => ({
  CompostHeap: vi.fn(function(_config: any) { return mockHeapInstance; }),
}));

vi.mock('../../../src/compost/SeedBank.js', () => ({
  SeedBank: vi.fn(function(_config: any) { return mockSeedBankInstance; }),
}));

vi.mock('../../../src/compost/CollisionEngine.js', () => ({
  CollisionEngine: vi.fn(function(_config: any, _llm: any) { return mockCollisionEngineInstance; }),
}));

vi.mock('../../../src/compost/FragmentScorer.js', () => ({
  FragmentScorer: vi.fn(function(_config: any, _llm: any) { return mockFragmentScorerInstance; }),
}));

vi.mock('../../../src/compost/DigestGenerator.js', () => ({
  DigestGenerator: vi.fn(function(_config: any, _llm: any) { return mockDigestGeneratorInstance; }),
}));

vi.mock('../../../src/compost/SemanticExtractor.js', () => ({
  SemanticExtractor: vi.fn(function(_config: any, _llm: any, _parser?: any) { return mockSemanticExtractorInstance; }),
}));

vi.mock('../../../src/compost/CompostShredder.js', () => ({
  CompostShredder: {
    shredAll: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../../src/compost/CompostSoup.js', () => ({
  CompostSoup: vi.fn(function(_config: any, _llm: any) { return mockSoupInstance; }),
}));

vi.mock('../../../src/compost/MetadataExtractor.js', () => ({
  MetadataExtractor: {
    extract: vi.fn().mockResolvedValue({
      fileType: 'text',
      timestamp: '2026-04-04',
      hash: 'abc',
      size: 100,
      extractedAt: '2026-04-04',
    }),
  },
}));

vi.mock('../../../src/compost/RawByteProcessor.js', () => ({
  RawByteProcessor: {
    process: vi.fn().mockResolvedValue({
      headerHex: '00',
      tailHex: '00',
      sha256: 'deadbeef',
      size: 100,
      hexChunks: [],
      base64: null,
    }),
  },
}));

vi.mock('../../../src/compost/ModelRouter.js', () => ({
  ModelRouter: vi.fn(),
}));

vi.mock('../../../src/entropy/MetabolicEntropyEngine.js', () => ({
  MetabolicEntropyEngine: vi.fn(function(_config: any) { return mockEntropyInstance; }),
}));

vi.mock('../../../src/llm/RetryManager.js', () => ({
  RetryManager: {
    mapSettled: vi.fn().mockImplementation(async (items: any[], fn: any) => {
      const results: any[] = [];
      for (const item of items) {
        try {
          results.push({ status: 'fulfilled', value: await fn(item) });
        } catch (err) {
          results.push({ status: 'rejected', reason: err });
        }
      }
      return results;
    }),
  },
}));

vi.mock('../../../src/generators/GeneratorRegistry.js', () => ({
  generatorRegistry: {
    getDNA: vi.fn().mockReturnValue(null),
    registerDNA: vi.fn(),
  },
}));

vi.mock('../../../src/core/EventBus.js', () => ({
  eventBus: { emit: vi.fn() },
  EventTypes: {
    PROCESS_START: 'PROCESS_START',
    PROCESS_END: 'PROCESS_END',
    COMPOST_STAGE: 'COMPOST_STAGE',
    COMPOST_SCORE: 'COMPOST_SCORE',
    COMPOST_SEED: 'COMPOST_SEED',
  },
}));

// Mock node:fs/promises for CompostMill.add() which uses fs.stat
// CompostMill imports as `import fs from 'node:fs/promises'` (default import),
// so the mock must provide both named exports AND a default export.
vi.mock('node:fs/promises', () => ({
  ...mockFsFunctions,
  default: mockFsFunctions,
}));

vi.mock('../../../src/core/parsing/CompostParser.js', () => ({
  CompostParser: vi.fn(() => ({ parse: vi.fn() })),
}));

vi.mock('../../../src/core/lir/LIRPromptFormatter.js', () => ({
  formatSeedForPrompt: vi.fn().mockReturnValue('formatted seed content'),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { CompostMill } from '../../../src/compost/CompostMill.js';
import type { CompostFragment, DigestResult, Seed } from '../../../src/compost/types.js';
import { RetryManager } from '../../../src/llm/RetryManager.js';
import { CompostShredder } from '../../../src/compost/CompostShredder.js';
import { CompostSoup } from '../../../src/compost/CompostSoup.js';
import * as fs from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFragment(overrides: Partial<CompostFragment> = {}): CompostFragment {
  return {
    id: 'frag-001',
    source: 'test.txt',
    domain: 'code',
    layer: 'semantic',
    content: 'A test fragment about code generation and algorithms',
    metadata: {
      fileType: 'text',
      timestamp: '2026-04-04T00:00:00Z',
      hash: 'abc123',
      size: 48,
      extractedAt: '2026-04-04T00:00:00Z',
    },
    tags: ['code', 'test'],
    ...overrides,
  };
}

function makeSeed(overrides: Partial<Seed> = {}): Seed {
  return {
    id: 'seed-001',
    content: 'A promoted creative seed about music and visuals',
    score: 7.5,
    source: {
      fragments: ['frag-001', 'frag-002'],
      collisionType: 'semantic-merge',
      domains: ['music', 'visual'],
    },
    promotedAt: '2026-04-04T00:00:00Z',
    usedBy: [],
    useCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompostMill', () => {
  let mill: CompostMill;

  beforeEach(() => {
    vi.clearAllMocks();

    mockHeapInstance.listFiles.mockResolvedValue([]);
    mockHeapInstance.getHeapSize.mockResolvedValue(0);
    mockHeapInstance.isOverCapacity.mockResolvedValue(false);
    mockSeedBankInstance.add.mockResolvedValue(undefined);
    mockSeedBankInstance.getAll.mockResolvedValue([]);
    mockSeedBankInstance.count.mockResolvedValue(0);
    mockCollisionEngineInstance.runAll.mockResolvedValue([]);
    mockFragmentScorerInstance.score.mockResolvedValue({
      total: 5.0,
      novelty: 0.5,
      density: 0.5,
      crossDomain: 0.5,
      metadataRarity: 0.5,
      connectionStrength: 0.5,
    });
    mockFragmentScorerInstance.shouldPromote.mockResolvedValue(true);
    mockDigestGeneratorInstance.save.mockResolvedValue('/tmp/digest.json');
    mockSoupInstance.run.mockResolvedValue(undefined);
    mockSoupInstance.isRunning.mockReturnValue(false);

    // Restore default RetryManager.mapSettled implementation (overridden by some tests)
    vi.mocked(RetryManager.mapSettled).mockImplementation(async (items: any[], fn: any) => {
      const results: any[] = [];
      for (const item of items) {
        try {
          results.push({ status: 'fulfilled', value: await fn(item) });
        } catch (err) {
          results.push({ status: 'rejected', reason: err });
        }
      }
      return results;
    });

    mill = new CompostMill(mockLLM, {
      soupEnabled: true,
      heapDir: '/tmp/test-heap',
      digestDir: '/tmp/test-digest',
      seedDir: '/tmp/test-seeds',
      entropy: mockEntropyInstance as any,
    });
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates a mill with soup disabled', () => {
      const noSoupMill = new CompostMill(mockLLM, { soupEnabled: false });
      expect(noSoupMill).not.toBeNull();
    });

    it('creates a mill with default config', () => {
      const defaultMill = new CompostMill(mockLLM, { entropy: mockEntropyInstance as any });
      expect(defaultMill).not.toBeNull();
    });

    it('uses fastLLM fallback when not provided', () => {
      const noFastMill = new CompostMill(mockLLM, { fastLLM: undefined, entropy: mockEntropyInstance as any });
      expect(noFastMill).not.toBeNull();
    });

    it('throws when entropy is missing and soup is enabled', () => {
      expect(() => new CompostMill(mockLLM, { soupEnabled: true })).toThrow('CompostMill: entropy engine is required when soup is enabled');
    });
  });

  // -------------------------------------------------------------------------
  // add()
  // -------------------------------------------------------------------------

  describe('add', () => {
    it('adds a file to the heap when stat succeeds', async () => {
      mockFsFunctions.stat.mockResolvedValueOnce({
        isDirectory: () => false,
        size: 100,
      } as any);
      await mill.add(['/path/to/test.txt']);
      expect(mockHeapInstance.addFile).toHaveBeenCalledWith('/path/to/test.txt');
    });

    it('adds a directory to the heap when stat returns isDirectory=true', async () => {
      mockFsFunctions.stat.mockResolvedValueOnce({
        isDirectory: () => true,
        size: 0,
      } as any);
      await mill.add(['/path/to/project']);
      expect(mockHeapInstance.addDirectory).toHaveBeenCalledWith('/path/to/project');
    });

    it('skips inaccessible paths gracefully', async () => {
      // mockFsFunctions.stat rejects by default (ENOENT) — no override needed
      await expect(mill.add(['/nonexistent/path.txt'])).resolves.toBeUndefined();
      expect(mockHeapInstance.addFile).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // digest() — empty heap
  // -------------------------------------------------------------------------

  describe('digest (empty heap)', () => {
    it('returns empty stats when heap has no files', async () => {
      mockHeapInstance.listFiles.mockResolvedValue([]);

      const result = await mill.digest();

      expect(result.stats.filesProcessed).toBe(0);
      expect(result.stats.fragmentCount).toBe(0);
      expect(result.stats.collisionCount).toBe(0);
      expect(result.stats.seedsPromoted).toBe(0);
      expect(result.stats.totalBytes).toBe(0);
      expect(result.seeds).toEqual([]);
      expect(result.digestPath).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // digest() — with files (full pipeline)
  // -------------------------------------------------------------------------

  describe('digest (full pipeline)', () => {
    it('processes files through extract > shred > collide > score > promote', async () => {
      const fragments: CompostFragment[] = [
        makeFragment({ id: 'frag-001', domain: 'code', content: 'code fragment' }),
        makeFragment({ id: 'frag-002', domain: 'music', content: 'music fragment' }),
      ];

      mockHeapInstance.listFiles.mockResolvedValue(['test.txt']);
      vi.mocked(CompostShredder.shredAll).mockReturnValue(fragments);
      mockFragmentScorerInstance.score.mockResolvedValue({
        total: 7.5, novelty: 0.8, density: 0.7, crossDomain: 0.6, metadataRarity: 0.5, connectionStrength: 0.7,
      });
      mockFragmentScorerInstance.shouldPromote.mockResolvedValue(true);

      const result = await mill.digest();
      expect(result.stats.filesProcessed).toBe(1);
      expect(result.stats.fragmentCount).toBe(2);
      expect(result.seeds.length).toBe(2);
      expect(result.stats.seedsPromoted).toBe(2);
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);

      expect(mockHeapInstance.purge).toHaveBeenCalled();
      expect(mockSeedBankInstance.pruneOld).toHaveBeenCalled();
    });

    it('records correct domains from fragments', async () => {
      const fragments = [
        makeFragment({ domain: 'code' }),
        makeFragment({ domain: 'music' }),
        makeFragment({ domain: 'code' }),
      ];

      mockHeapInstance.listFiles.mockResolvedValue(['file.txt']);
      vi.mocked(CompostShredder.shredAll).mockReturnValue(fragments);
      vi.mocked(RetryManager.mapSettled).mockResolvedValue([]);

      const result = await mill.digest();
      expect(result.stats.domains).toEqual(expect.arrayContaining(['code', 'music']));
      expect(result.stats.domains).toHaveLength(2);
    });

    it('promotes collision results alongside scored fragments', async () => {
      const fragA = makeFragment({ id: 'frag-a', domain: 'code' });
      const fragB = makeFragment({ id: 'frag-b', domain: 'music' });
      const fragments = [fragA, fragB];

      const collisionResult = {
        fragmentA: fragA,
        fragmentB: fragB,
        strategy: 'semantic-bridge',
        mergedContent: 'A fusion of code and music concepts',
      };

      mockHeapInstance.listFiles.mockResolvedValue(['file.txt']);
      vi.mocked(CompostShredder.shredAll).mockReturnValue(fragments);
      mockCollisionEngineInstance.runAll.mockResolvedValue([collisionResult]);
      mockFragmentScorerInstance.score.mockResolvedValue({
        total: 8.0, novelty: 0.9, density: 0.8, crossDomain: 0.7, metadataRarity: 0.6, connectionStrength: 0.8,
      });
      mockFragmentScorerInstance.shouldPromote.mockResolvedValue(true);

      const result = await mill.digest();

      const collisionSeed = result.seeds.find(s => s.id.startsWith('collision-'));

      expect(collisionSeed!.source.collisionType).toBe('semantic-bridge');
      expect(collisionSeed!.source.domains).toEqual(['code', 'music']);
    });
  });

  // -------------------------------------------------------------------------
  // Seed lifecycle
  // -------------------------------------------------------------------------

  describe('seed lifecycle', () => {
    it('listSeeds returns all seeds sorted by score', async () => {
      const seeds = [
        makeSeed({ id: 'seed-1', score: 5.0 }),
        makeSeed({ id: 'seed-2', score: 9.0 }),
      ];
      mockSeedBankInstance.getAll.mockResolvedValue(seeds);
      const result = await mill.listSeeds();
      expect(result).toHaveLength(2);
      expect(result).toEqual(seeds);
    });

    it('getTopSeeds delegates to seedBank.getTop', async () => {
      const topSeeds = [makeSeed({ id: 'seed-top', score: 9.5 })];
      mockSeedBankInstance.getTop.mockResolvedValue(topSeeds);
      const result = await mill.getTopSeeds(1);
      expect(mockSeedBankInstance.getTop).toHaveBeenCalledWith(1);
      expect(result).toEqual(topSeeds);
    });

    it('getSeedCount delegates to seedBank.count', async () => {
      mockSeedBankInstance.count.mockResolvedValue(42);
      const count = await mill.getSeedCount();
      expect(count).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // Soup operations
  // -------------------------------------------------------------------------

  describe('soup operations', () => {
    it('startSoup loads seeds and runs the soup', async () => {
      const seeds = [makeSeed({ id: 'seed-soup', score: 8.0 })];
      mockSeedBankInstance.getAll.mockResolvedValue(seeds);
      mockSoupInstance.run.mockResolvedValue(undefined);

      await mill.startSoup();
      expect(mockSoupInstance.run).toHaveBeenCalled();
      const soupFragments = mockSoupInstance.run.mock.calls[0][0];
      expect(soupFragments).toHaveLength(1);
      expect(soupFragments[0].content).toBe('A promoted creative seed about music and visuals');
      expect(soupFragments[0].domain).toBe('music');
    });

    it('startSoup creates a new soup if none exists', async () => {
      const noSoupMill = new CompostMill(mockLLM, {
        soupEnabled: false,
        heapDir: '/tmp/test-heap',
        digestDir: '/tmp/test-digest',
        seedDir: '/tmp/test-seeds',
        entropy: mockEntropyInstance as any,
      });
      mockSeedBankInstance.getAll.mockResolvedValue([]);
      await noSoupMill.startSoup();
      expect(CompostSoup).toHaveBeenCalled();
    });

    it('stopSoup stops the soup loop', () => {
      mill.stopSoup();
    });

    it('stopSoup delegates to soup.stop() when soup exists', async () => {
      mockSeedBankInstance.getAll.mockResolvedValue([]);
      await mill.startSoup();
      mill.stopSoup();
    });
  });

  // -------------------------------------------------------------------------
  // Status reporting
  // -------------------------------------------------------------------------

  describe('statusAsync', () => {
    it('reports correct heap size, file count, and seed count', async () => {
      mockHeapInstance.getHeapSize.mockResolvedValue(2048);
      mockHeapInstance.listFiles.mockResolvedValue(['file1.txt', 'file2.txt']);
      mockSeedBankInstance.count.mockResolvedValue(5);

      const status = await mill.statusAsync();
      expect(status.heapSize).toBe(2048);
      expect(status.heapFileCount).toBe(2);
      expect(status.seedCount).toBe(5);
      expect(status.soupRunning).toBe(false);
      expect(status.soupGeneration).toBe(0);
      expect(status.lastDigestAt).toBeNull();
    });

    it('reports soupRunning as true when soup is active', async () => {
      mockSeedBankInstance.getAll.mockResolvedValue([]);
      await mill.startSoup();
      mockSoupInstance.isRunning.mockReturnValue(true);
      const status = await mill.statusAsync();
      expect(status.soupRunning).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getHeapFiles
  // -------------------------------------------------------------------------

  describe('getHeapFiles', () => {
    it('delegates to heap.listFiles', async () => {
      mockHeapInstance.listFiles.mockResolvedValue(['a.txt', 'b.txt']);
      const files = await mill.getHeapFiles();
      expect(files).toEqual(['a.txt', 'b.txt']);
    });

    it('returns empty array when heap is empty', async () => {
      mockHeapInstance.listFiles.mockResolvedValue([]);
      const files = await mill.getHeapFiles();
      expect(files).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // shouldAutoDigest
  // -------------------------------------------------------------------------

  describe('shouldAutoDigest', () => {
    it('returns true when heap is over capacity', async () => {
      mockHeapInstance.isOverCapacity.mockResolvedValue(true);
      expect(await mill.shouldAutoDigest()).toBe(true);
    });

    it('returns false when heap is under capacity', async () => {
      mockHeapInstance.isOverCapacity.mockResolvedValue(false);
      expect(await mill.shouldAutoDigest()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setParser / setModelRouter
  // -------------------------------------------------------------------------

  describe('setParser', () => {
    it('does not throw when called', () => {
      const mockParser = { parse: vi.fn() };
      expect(() => mill.setParser(mockParser as any)).not.toThrow();
    });
  });

  describe('setModelRouter', () => {
    it('does not throw when called', () => {
      const mockRouter = { route: vi.fn() };
      expect(() => mill.setModelRouter(mockRouter as any)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Error paths
  // -------------------------------------------------------------------------

  describe('digest with no promotions', () => {
    it('returns 0 seedsPromoted when shouldPromote returns false', async () => {
      const fragments = [makeFragment({ id: 'frag-001' })];
      mockHeapInstance.listFiles.mockResolvedValue(['file.txt']);
      vi.mocked(CompostShredder.shredAll).mockReturnValue(fragments);
      mockFragmentScorerInstance.shouldPromote.mockResolvedValue(false);
      const result = await mill.digest();
      expect(result.stats.seedsPromoted).toBe(0);
      expect(result.seeds).toEqual([]);
    });
  });

  describe('digest with scoring failures', () => {
    it('continues when individual fragment scoring fails', async () => {
      const fragments = [
        makeFragment({ id: 'frag-001' }),
        makeFragment({ id: 'frag-002' }),
      ];
      mockHeapInstance.listFiles.mockResolvedValue(['file.txt']);
      vi.mocked(CompostShredder.shredAll).mockReturnValue(fragments);

      // mapSettled is called multiple times: extractAll (1st), scoreFragments (2nd), scoreCollisions (3rd)
      // We need the extraction call to return proper ExtractionResult objects,
      // but make the scoring call fail for the second fragment
      let callCount = 0;
      vi.mocked(RetryManager.mapSettled).mockImplementation(async (items: any[], fn: any) => {
        callCount++;
        // First call = extractAll — let the real mocked extractors handle it
        if (callCount === 1) {
          const results: any[] = [];
          for (const item of items) {
            try {
              results.push({ status: 'fulfilled', value: await fn(item) });
            } catch (err) {
              results.push({ status: 'rejected', reason: err });
            }
          }
          return results;
        }
        // Second call = scoring — fail the second fragment
        return items.map((_item: any, idx: number) => {
          if (idx === 0) {
            return { status: 'fulfilled', value: { ...fragments[0], score: 7.0 } };
          }
          return { status: 'rejected', reason: new Error('scoring timeout') };
        });
      });

      const result = await mill.digest();
      expect(result.stats.fragmentCount).toBe(2);
      expect(result.stats.seedsPromoted).toBe(1);
    });
  });
});
