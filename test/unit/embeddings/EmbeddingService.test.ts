/**
 * EmbeddingService tests — local pipeline mocking, caching, truncation, dimension reporting.
 *
 * The @xenova/transformers `pipeline()` returns a callable function.
 * We mock it so that `pipeline('feature-extraction', modelName, opts)` returns
 * a function that itself returns a Tensor-like object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted() is MANDATORY for variables referenced in vi.mock()
// ---------------------------------------------------------------------------

const { mockPipelineFn } = vi.hoisted(() => ({
  mockPipelineFn: vi.fn(),
}));

// pipeline('feature-extraction', model, opts) → mockPipelineFn (callable)
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(mockPipelineFn),
}));

// Suppress Logger noise in test output
vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { EmbeddingService, resetGlobalEmbeddingService } from '../../../src/embeddings/EmbeddingService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake Float32Array of the given length filled with a constant value. */
function fakeVector(length: number, value = 0.5): Float32Array {
  const arr = new Float32Array(length);
  arr.fill(value);
  return arr;
}

/** Build a Tensor-like object that the pipeline callable returns. */
function fakeTensorOutput(length: number, value = 0.5) {
  return { data: fakeVector(length, value) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalEmbeddingService();
    // Default: pipeline callable returns a valid 384-dim tensor
    mockPipelineFn.mockResolvedValue(fakeTensorOutput(384, 0.5));
  });

  // -------------------------------------------------------------------------
  // Constructor & dimension reporting
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('reports 384 dimensions for local model (default)', () => {
      const svc = new EmbeddingService();
      expect(svc.getDimension()).toBe(384);
    });

    it('reports 1536 dimensions when useLocal is false', () => {
      const svc = new EmbeddingService({ useLocal: false });
      expect(svc.getDimension()).toBe(1536);
    });
  });

  // -------------------------------------------------------------------------
  // embed() — local pipeline path
  // -------------------------------------------------------------------------

  describe('embed (local pipeline)', () => {
    it('returns a 384-dim embedding result with correct metadata', async () => {
      mockPipelineFn.mockResolvedValueOnce(fakeTensorOutput(384, 0.42));

      const svc = new EmbeddingService({ useLocal: true });
      const result = await svc.embed('hello world');

      expect(result.vector).toHaveLength(384);
      expect(result.vector[0]).toBeCloseTo(0.42, 2);
      expect(result.model).toBe('Xenova/all-MiniLM-L6-v2');
      expect(result.dimension).toBe(384);
      expect(result.cached).toBe(false);
    });

    it('caches results and returns cached=true on second call', async () => {
      const svc = new EmbeddingService({ useLocal: true });

      const first = await svc.embed('cache me');
      expect(first.cached).toBe(false);

      const second = await svc.embed('cache me');
      expect(second.cached).toBe(true);
      expect(second.vector).toEqual(first.vector);

      // Pipeline callable should only have been invoked once
      expect(mockPipelineFn).toHaveBeenCalledTimes(1);
    });

    it('skips cache when useCache is false', async () => {
      const svc = new EmbeddingService({ useLocal: true });

      await svc.embed('no cache', false);
      await svc.embed('no cache', false);

      expect(mockPipelineFn).toHaveBeenCalledTimes(2);
    });

    it('truncates text exceeding maxLength before embedding', async () => {
      const longText = 'x'.repeat(600);
      let capturedText = '';

      mockPipelineFn.mockImplementationOnce(async (text: string) => {
        capturedText = text;
        return fakeTensorOutput(384, 0.1);
      });

      const svc = new EmbeddingService({ useLocal: true, maxLength: 100 });
      await svc.embed(longText);

      expect(capturedText.length).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // embed() — no provider available
  // -------------------------------------------------------------------------

  describe('embed (no provider)', () => {
    it('throws when useLocal is false and no openAIApiKey is provided', async () => {
      const svc = new EmbeddingService({ useLocal: false, openAIApiKey: '' });
      await expect(svc.embed('test')).rejects.toThrow(
        'No embedding provider available',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  describe('cache management', () => {
    it('clearCache empties the cache', async () => {
      const svc = new EmbeddingService({ useLocal: true });
      await svc.embed('alpha');

      expect(svc.getCacheStats().size).toBe(1);

      svc.clearCache();
      expect(svc.getCacheStats().size).toBe(0);
    });

    it('getCacheStats returns maxSize of 10000', () => {
      const svc = new EmbeddingService();
      expect(svc.getCacheStats().maxSize).toBe(10000);
    });
  });

  // -------------------------------------------------------------------------
  // embedBatch
  // -------------------------------------------------------------------------

  describe('embedBatch', () => {
    it('embeds every text and reports them all as freshly computed', async () => {
      const svc = new EmbeddingService({ useLocal: true });
      const results = await svc.embedBatch(['one', 'two', 'three']);

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.vector).toHaveLength(384);
        expect(r.cached).toBe(false); // first time for each
      }
    });

    it('returns empty array for empty input', async () => {
      const svc = new EmbeddingService({ useLocal: true });
      const results = await svc.embedBatch([]);
      expect(results).toEqual([]);
    });

    it('runs embeddings concurrently within a chunk (E6 — not a serial loop)', async () => {
      // Instrument the pipeline callable to record peak concurrency: each call
      // blocks on a manual resolver until ALL pending calls have started.
      let inFlight = 0;
      let peak = 0;
      const resolvers: Array<() => void> = [];
      mockPipelineFn.mockImplementation(() => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        return new Promise((resolve) => {
          resolvers.push(() => {
            inFlight--;
            resolve(fakeTensorOutput(384, 0.5));
          });
        });
      });

      const svc = new EmbeddingService({ useLocal: true });
      // Initialize first so the only awaits left in embedBatch are the embeds.
      await svc.initialize();

      const texts = ['a', 'b', 'c', 'd'];
      const batchPromise = svc.embedBatch(texts, 4);

      // Flush microtasks until all 4 embeds have entered the pipeline (bounded
      // so a serial implementation can't hang the test).
      for (let i = 0; i < 30 && resolvers.length < texts.length; i++) {
        await Promise.resolve();
      }

      // If embedBatch were serial, only ONE call would ever be in flight.
      // With bounded-parallel (concurrency 4), all 4 start before any resolves.
      expect(peak).toBe(4);

      // Drain — resolve all in-flight calls so the batch completes.
      for (const r of resolvers) r();
      const results = await batchPromise;
      expect(results).toHaveLength(4);
    });

    it('bounds concurrency to the requested chunk size', async () => {
      let inFlight = 0;
      let peak = 0;
      const resolvers: Array<() => void> = [];
      mockPipelineFn.mockImplementation(() => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        return new Promise((resolve) => {
          resolvers.push(() => {
            inFlight--;
            resolve(fakeTensorOutput(384, 0.5));
          });
        });
      });

      const svc = new EmbeddingService({ useLocal: true });
      await svc.initialize();
      // 5 texts, concurrency 2 → at most 2 in flight at any time.
      const texts = ['a', 'b', 'c', 'd', 'e'];
      const batchPromise = svc.embedBatch(texts, 2);

      // Drain in waves; resolve whatever has started so the next chunk runs.
      // Bounded loop guards against a hang if concurrency were unbounded.
      let settled = false;
      batchPromise.then(() => {
        settled = true;
      });
      for (let i = 0; i < 100 && !settled; i++) {
        await Promise.resolve();
        while (resolvers.length > 0) {
          const r = resolvers.shift()!;
          r();
        }
      }

      const results = await batchPromise;
      expect(results).toHaveLength(5);
      // Peak in-flight must never exceed the requested concurrency of 2.
      expect(peak).toBeLessThanOrEqual(2);
    });

    it('preserves input order in the returned results', async () => {
      // Distinct vector value per text → identify which result is which.
      const valueByText: Record<string, number> = {
        first: 0.1,
        second: 0.2,
        third: 0.3,
      };
      mockPipelineFn.mockImplementation((text: string) =>
        Promise.resolve(fakeTensorOutput(384, valueByText[text])),
      );

      const svc = new EmbeddingService({ useLocal: true });
      const results = await svc.embedBatch(['first', 'second', 'third'], 8);

      expect(results).toHaveLength(3);
      expect(results[0].vector[0]).toBeCloseTo(0.1, 5);
      expect(results[1].vector[0]).toBeCloseTo(0.2, 5);
      expect(results[2].vector[0]).toBeCloseTo(0.3, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty string input', async () => {
      mockPipelineFn.mockResolvedValueOnce(fakeTensorOutput(384, 0));

      const svc = new EmbeddingService({ useLocal: true });
      const result = await svc.embed('');

      expect(result.vector).toHaveLength(384);
      expect(result.cached).toBe(false);
    });

    it('falls back to no-provider error when init fails and no OpenAI key', async () => {
      // When pipeline rejects, EmbeddingService throws (no fallback path)
      // This test verifies that behavior: init failure with no fallback = error
      const { pipeline } = await import('@xenova/transformers');
      vi.mocked(pipeline).mockRejectedValueOnce(new Error('model download failed'));

      const svc = new EmbeddingService({ useLocal: true });
      await expect(svc.embed('first')).rejects.toThrow('model download failed');
    });
  });
});
