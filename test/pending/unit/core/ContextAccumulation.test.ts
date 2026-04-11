import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextAccumulation } from '../../../src/core/ContextAccumulation.js';
import type { IterationContext, PersistedLoopState } from '../../../src/core/ContextAccumulation.js';

// Mock fs and dependencies
const { mockWriteFileSync, mockReadFileSync, mockExistsSync, mockEnsureDir, mockSafeJsonParse } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockEnsureDir: vi.fn(),
  mockSafeJsonParse: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
  },
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
}));

vi.mock('path', () => ({
  default: {
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  },
}));

vi.mock('../../../src/security/JsonSchemas.js', () => ({
  safeJsonParse: mockSafeJsonParse,
  PersistedLoopStateSchema: {},
}));

vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: mockEnsureDir,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

function makeState(iteration: number, prompt: string = 'test'): IterationContext {
  return {
    iteration,
    prompt,
    usedPrompt: prompt,
    code: `code_${iteration}`,
    evaluation: { score: iteration * 0.1, issues: [] },
    timestamp: new Date().toISOString(),
  };
}

describe('ContextAccumulation', () => {
  let accumulation: ContextAccumulation;

  beforeEach(() => {
    vi.clearAllMocks();
    accumulation = new ContextAccumulation();
  });

  describe('save + load', () => {
    it('saves and loads a state', () => {
      const state = makeState(1);
      accumulation.save(state);
      const loaded = accumulation.load();
      expect(loaded).toEqual(state);
    });

    it('returns null when no state saved', () => {
      expect(accumulation.load()).toBeNull();
    });

    it('loads most recent state', () => {
      accumulation.save(makeState(1));
      accumulation.save(makeState(2));
      accumulation.save(makeState(3));
      const loaded = accumulation.load();
      expect(loaded!.iteration).toBe(3);
    });

    it('returns a deep copy (mutations dont affect internal state)', () => {
      accumulation.save(makeState(1));
      const loaded = accumulation.load()!;
      loaded.iteration = 999;
      expect(accumulation.load()!.iteration).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('returns empty array initially', () => {
      expect(accumulation.getHistory()).toEqual([]);
    });

    it('returns all saved states', () => {
      accumulation.save(makeState(1));
      accumulation.save(makeState(2));
      accumulation.save(makeState(3));
      const history = accumulation.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].iteration).toBe(1);
      expect(history[2].iteration).toBe(3);
    });

    it('returns deep copies', () => {
      accumulation.save(makeState(1));
      const history = accumulation.getHistory();
      history[0].iteration = 999;
      expect(accumulation.getHistory()[0].iteration).toBe(1);
    });

    it('truncates history at MAX_HISTORY_SIZE (50)', () => {
      for (let i = 0; i < 60; i++) {
        accumulation.save(makeState(i));
      }
      const history = accumulation.getHistory();
      expect(history).toHaveLength(50);
      // Oldest should be iteration 10 (first 10 dropped)
      expect(history[0].iteration).toBe(10);
    });
  });

  describe('clear', () => {
    it('clears all history', () => {
      accumulation.save(makeState(1));
      accumulation.save(makeState(2));
      accumulation.clear();
      expect(accumulation.getHistory()).toEqual([]);
      expect(accumulation.load()).toBeNull();
    });
  });

  describe('saveState', () => {
    it('persists state to file', () => {
      const state: PersistedLoopState = {
        bestFitness: 0.85,
        iterationsSinceLastImprovement: 3,
        budgetUsed: 0.5,
        totalIterations: 10,
        savedAt: '2024-01-01T00:00:00Z',
      };
      accumulation.saveState('/tmp/test-state.json', state);
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/tmp/test-state.json',
        expect.any(String),
        'utf-8',
      );
      const written = mockWriteFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.bestFitness).toBe(0.85);
    });

    it('throws on write failure', () => {
      mockWriteFileSync.mockImplementation(() => { throw new Error('disk full'); });
      expect(() => accumulation.saveState('/bad/path', {} as PersistedLoopState)).toThrow(
        'Failed to save loop state: disk full',
      );
    });
  });

  describe('loadState', () => {
    it('returns error Result when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = accumulation.loadState('/nonexistent.json');
      expect(result.isErr()).toBe(true);
      expect(result.error.message).toBe('Loop state file does not exist');
    });

    it('loads valid state from file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{"bestFitness":0.9,"iterationsSinceLastImprovement":0,"budgetUsed":0.3,"totalIterations":5,"savedAt":"2024-01-01"}');
      const parsed = { bestFitness: 0.9, iterationsSinceLastImprovement: 0, budgetUsed: 0.3, totalIterations: 5, savedAt: '2024-01-01' };
      mockSafeJsonParse.mockReturnValue(parsed);
      const result = accumulation.loadState('/valid-state.json');
      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual(parsed);
    });

    it('returns error Result on parse failure', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');
      mockSafeJsonParse.mockImplementation(() => { throw new Error('parse error'); });
      const result = accumulation.loadState('/bad.json');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('static methods (backward compat)', () => {
    beforeEach(() => {
      ContextAccumulation.clear();
    });

    afterEach(() => {
      ContextAccumulation.clear();
    });

    it('static save delegates to default instance', () => {
      ContextAccumulation.save(makeState(42));
      expect(ContextAccumulation.load()!.iteration).toBe(42);
    });

    it('static load returns from default instance', () => {
      expect(ContextAccumulation.load()).toBeNull();
      ContextAccumulation.save(makeState(5));
      expect(ContextAccumulation.load()!.iteration).toBe(5);
    });

    it('static getHistory returns from default instance', () => {
      ContextAccumulation.save(makeState(1));
      expect(ContextAccumulation.getHistory()).toHaveLength(1);
    });

    it('static clear clears default instance', () => {
      ContextAccumulation.save(makeState(1));
      ContextAccumulation.clear();
      expect(ContextAccumulation.load()).toBeNull();
    });
  });

  describe('instances are independent', () => {
    it('separate instances do not share history', () => {
      const a = new ContextAccumulation();
      const b = new ContextAccumulation();
      a.save(makeState(1));
      expect(b.load()).toBeNull();
      expect(a.load()!.iteration).toBe(1);
    });
  });
});
