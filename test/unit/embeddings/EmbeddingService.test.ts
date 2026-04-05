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
    it('embeds multiple texts sequentially', async () => {
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
      // Make the @xenova/transformers pipeline() reject during initialization
      const { pipeline } = await import('@xenova/transformers');
      vi.mocked(pipeline).mockRejectedValueOnce(new Error('model download failed'));

      const svc = new EmbeddingService({ useLocal: true });
      // First embed triggers init which fails, then no localPipeline, no openAI key
      await expect(svc.embed('first')).rejects.toThrow(
        'No embedding provider available',
      );
    });
  });
});
