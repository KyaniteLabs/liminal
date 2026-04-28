/**
 * Tests for semantic search using embeddings.
 * Tests EmbeddingService interface, vector utilities, and SeedBank semantic retrieval.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  dotProduct,
  findKNearestNeighbors,
} from '../../src/utils/vectors.js';
import { SeedBank, type EmbeddedSeed } from '../../src/compost/SeedBank.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import { MapElites } from '../../src/evolution/MapElites.js';
import type { EmbeddingService, EmbeddingResult } from '../../src/embeddings/EmbeddingService.js';

describe('Semantic Search with Embeddings', () => {
  describe('Vector Utilities', () => {
    describe('cosineSimilarity', () => {
      it('returns 1 for identical vectors', () => {
        const vec = [1, 2, 3, 4, 5];
        expect(cosineSimilarity(vec, vec)).toBeCloseTo(1, 10);
      });

      it('returns 0 for orthogonal vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [0, 1, 0];
        expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0, 10);
      });

      it('returns -1 for opposite vectors', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [-1, -2, -3];
        expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1, 10);
      });

      it('throws for vectors of different lengths', () => {
        expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
          'Vector length mismatch'
        );
      });

      it('handles zero vectors', () => {
        expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
      });

      it('calculates correct similarity for known vectors', () => {
        const vec1 = [1, 0];
        const vec2 = [1, 1];
        expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0.707, 2);
      });
    });

    describe('euclideanDistance', () => {
      it('returns 0 for identical vectors', () => {
        const vec = [1, 2, 3];
        expect(euclideanDistance(vec, vec)).toBe(0);
      });

      it('calculates correct distance', () => {
        const vec1 = [0, 0];
        const vec2 = [3, 4];
        expect(euclideanDistance(vec1, vec2)).toBe(5);
      });

      it('handles vectors of different lengths', () => {
        const vec1 = [1, 2];
        const vec2 = [1, 2, 3];
        expect(euclideanDistance(vec1, vec2)).toBe(3);
      });

      it('handles empty vectors', () => {
        expect(euclideanDistance([], [])).toBe(0);
      });
    });

    describe('normalizeVector', () => {
      it('returns unit vector', () => {
        const vec = [3, 4];
        const normalized = normalizeVector(vec);
        const magnitude = Math.sqrt(
          normalized.reduce((sum, v) => sum + v * v, 0)
        );
        expect(magnitude).toBeCloseTo(1, 10);
      });

      it('preserves direction', () => {
        const vec = [3, 4];
        const normalized = normalizeVector(vec);
        expect(normalized[0] / normalized[1]).toBeCloseTo(3 / 4, 10);
      });

      it('handles zero vector', () => {
        const vec = [0, 0, 0];
        expect(normalizeVector(vec)).toEqual(vec);
      });
    });

    describe('dotProduct', () => {
      it('calculates correct dot product', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [4, 5, 6];
        expect(dotProduct(vec1, vec2)).toBe(32);
      });

      it('returns 0 for orthogonal vectors', () => {
        const vec1 = [1, 0];
        const vec2 = [0, 1];
        expect(dotProduct(vec1, vec2)).toBe(0);
      });

      it('handles different length vectors', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [4, 5];
        expect(dotProduct(vec1, vec2)).toBe(14);
      });
    });

    describe('findKNearestNeighbors', () => {
      it('returns k nearest neighbors by cosine similarity', () => {
        const query = [1, 0, 0];
        const vectors = [
          [1, 0, 0],
          [0.9, 0.1, 0],
          [0, 1, 0],
          [-1, 0, 0],
          [0.8, 0.2, 0],
        ];

        const neighbors = findKNearestNeighbors(query, vectors, 3);
        expect(neighbors).toHaveLength(3);
        expect(neighbors[0]).toBe(0);
      });

      it('handles k larger than vectors length', () => {
        const query = [1, 0];
        const vectors = [[1, 0]];
        const neighbors = findKNearestNeighbors(query, vectors, 5);
        expect(neighbors).toHaveLength(1);
      });

      it('returns empty array for empty vectors', () => {
        const query = [1, 0];
        const neighbors = findKNearestNeighbors(query, [], 3);
        expect(neighbors).toHaveLength(0);
      });
    });
  });

  describe('SeedBank with Mocked Embeddings', () => {
    let tmpDir: string;
    let bank: SeedBank;
    let mockEmbeddingService: EmbeddingService;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-semantic-test-'));
      const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds') });
      
      // Create mock embedding service
      let cacheKey = 0;
      const mockEmbed = vi.fn().mockImplementation(async (text: string) => {
        // Create a deterministic mock embedding based on text content
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const vector = new Array(384).fill(0).map((_, i) => {
          return Math.sin((hash + i) / 10) * 0.5;
        });
        return {
          vector,
          model: 'mock-model',
          dimension: 384,
          cached: false,
        } as EmbeddingResult;
      });

      mockEmbeddingService = {
        embed: mockEmbed,
        embedBatch: vi.fn(),
        initialize: vi.fn().mockResolvedValue(undefined),
        getDimension: vi.fn().mockReturnValue(384),
        clearCache: vi.fn(),
        getCacheStats: vi.fn().mockReturnValue({ size: 0, maxSize: 10000 }),
      } as unknown as EmbeddingService;

      bank = new SeedBank(config, mockEmbeddingService);
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    function makeSeed(overrides: Partial<EmbeddedSeed> = {}): EmbeddedSeed {
      return {
        id: `seed-${Math.random().toString(36).slice(2, 8)}`,
        content: 'A creative idea about glaze dynamics',
        score: 8.5,
        source: {
          fragments: ['frag-1', 'frag-2'],
          collisionType: 'timestamp',
          domains: ['ceramics', 'music'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
        ...overrides,
      };
    }

    it('should detect embedding support', () => {
      expect(bank.isEmbeddingEnabled()).toBe(true);
    });

    it('should add seed with embedding', async () => {
      const seed = makeSeed({ content: 'A beautiful ceramic glaze' });
      await bank.add(seed);

      const retrieved = await bank.getAll();
      expect(retrieved).toHaveLength(1);

      expect(retrieved[0].embedding).toHaveLength(384);
      expect(retrieved[0].embeddingModel).toBe('mock-model');
      expect(retrieved[0].embeddedAt).not.toBeNull();
      expect(mockEmbeddingService.embed).toHaveBeenCalled();
    });

    it('should retrieve seeds using semantic search', async () => {
      await bank.add(
        makeSeed({
          id: 'ceramic-seed',
          content: 'Beautiful ceramic glaze with blue patterns',
          source: { fragments: [], collisionType: 't', domains: ['ceramics'] },
        })
      );
      await bank.add(
        makeSeed({
          id: 'music-seed',
          content: 'Rhythmic jazz composition with saxophone',
          source: { fragments: [], collisionType: 't', domains: ['music'] },
        })
      );

      const results = await bank.retrieveRelevantSeeds('pottery and clay art', 2);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find similar seeds by embedding', async () => {
      await bank.add(
        makeSeed({
          id: 'art-seed',
          content: 'Abstract expressionist painting technique',
          source: { fragments: [], collisionType: 't', domains: ['art'] },
        })
      );

      const queryEmbedding = new Array(384).fill(0.1);
      const similar = await bank.findSimilarByEmbedding(queryEmbedding, 2);
      expect(similar.length).toBeGreaterThan(0);
    });

    it('should update missing embeddings', async () => {
      const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds-no-embed') });
      const noEmbedBank = new SeedBank(config);

      await noEmbedBank.add(
        makeSeed({
          id: 'no-embed-seed',
          content: 'Test content without embedding',
        })
      );

      let retrieved = await noEmbedBank.getAll();
      expect(retrieved[0].embedding).toBeUndefined();

      noEmbedBank.setEmbeddingService(mockEmbeddingService);
      const updated = await noEmbedBank.updateMissingEmbeddings();
      expect(updated).toBe(1);

      retrieved = await noEmbedBank.getAll();
      expect(retrieved[0].embedding).not.toBeNull();
    });

    it('should embed text directly', async () => {
      const result = await bank.embed('test content');
      expect(result.vector).toHaveLength(384);
      expect(result.model).toBe('mock-model');
    });

    it('should throw when embedding without service', async () => {
      const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds-no-service') });
      const noServiceBank = new SeedBank(config);
      
      await expect(noServiceBank.embed('test')).rejects.toThrow(
        'Embedding service not configured'
      );
    });
  });

  describe('MapElites with Embedding Diversity', () => {
    let mapElites: MapElites;

    beforeEach(() => {
      mapElites = new MapElites([5, 5], {
        useEmbeddings: true,
        embeddingWeight: 0.5,
      });
    });

    it('should store embeddings with cells', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mapElites.insert('test-1', [0.5, 0.5], 10, embedding, 'test content');

      const cell = mapElites.get(2, 2);
      expect(cell).not.toBeNull();
      expect(cell!.embedding).toEqual(embedding);
      expect(cell!.content).toBe('test content');
    });

    it('should calculate embedding-based diversity', () => {
      mapElites.insert('cell-1', [0.2, 0.2], 8, [0.9, 0.1, 0.0], 'content 1');
      mapElites.insert('cell-2', [0.8, 0.8], 9, [0.91, 0.09, 0.0], 'content 2');
      mapElites.insert('cell-3', [0.5, 0.5], 7, [0.0, 0.0, 1.0], 'content 3');

      const diversity = mapElites.getBehaviorDiversity();
      expect(diversity).toBeGreaterThan(0);
    });

    it('should support embedding options getters and setters', () => {
      expect(mapElites.getEmbeddingOptions()).toEqual({
        useEmbeddings: true,
        embeddingWeight: 0.5,
      });

      mapElites.setEmbeddingOptions(true, 0.7);
      expect(mapElites.getEmbeddingOptions().embeddingWeight).toBe(0.7);

      mapElites.setEmbeddingOptions(true, 1.5);
      expect(mapElites.getEmbeddingOptions().embeddingWeight).toBe(1);

      mapElites.setEmbeddingOptions(true, -0.5);
      expect(mapElites.getEmbeddingOptions().embeddingWeight).toBe(0);
    });

    it('should find similar cells by embedding', () => {
      const embeddings = [
        [1.0, 0.0, 0.0],
        [0.95, 0.05, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
      ];

      embeddings.forEach((emb, i) => {
        mapElites.insert(`cell-${i}`, [i / 4, i / 4], i + 5, emb, `content ${i}`);
      });

      const queryEmbedding = [1.0, 0.0, 0.0];
      const similar = mapElites.findSimilarByEmbedding(queryEmbedding, 2);

      expect(similar).toHaveLength(2);
      expect(similar[0].cell.creationId).toBe('cell-0');
      expect(similar[0].similarity).toBeCloseTo(1, 5);
    });

    it('should insert with embedding-based behavior descriptor', () => {
      const embedding = new Array(384).fill(0).map((_, i) => Math.sin(i / 10));

      mapElites.insertWithEmbedding('test-cell', 10, embedding);

      const cell = mapElites.getAllCells()[0];

      expect(cell?.creationId).toBe('test-cell');
      expect(cell.embedding).toEqual(embedding);
      expect(cell.behavior).toHaveLength(2);
    });

    it('should fall back to behavior distance when embeddings disabled', () => {
      const noEmbedMapElites = new MapElites([5, 5], {
        useEmbeddings: false,
        embeddingWeight: 0.5,
      });

      noEmbedMapElites.insert('cell-1', [0.2, 0.2], 8, [0.9, 0.1], 'content 1');
      noEmbedMapElites.insert('cell-2', [0.8, 0.8], 9, [0.0, 1.0], 'content 2');

      const diversity = noEmbedMapElites.getBehaviorDiversity();
      expect(diversity).toBeGreaterThan(0);
    });

    it('should persist and load embedding options', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mapelites-test-'));
      const filePath = path.join(tmpDir, 'mapelites.json');

      mapElites.insert('cell-1', [0.5, 0.5], 10, [0.1, 0.2, 0.3], 'content');
      await mapElites.save(filePath);

      const loaded = new MapElites();
      await loaded.load(filePath);

      expect(loaded.getEmbeddingOptions()).toEqual({
        useEmbeddings: true,
        embeddingWeight: 0.5,
      });

      await fs.rm(tmpDir, { recursive: true, force: true });
    });
  });

  describe('Integration: Vector Similarity', () => {
    it('should calculate similarity between concept vectors', () => {
      // Simulate embeddings for different concepts
      const conceptA = [0.9, 0.1, 0.0, 0.0]; // "art" concept
      const conceptB = [0.85, 0.15, 0.0, 0.0]; // similar "art" concept
      const conceptC = [0.0, 0.0, 0.9, 0.1]; // "music" concept

      const similarityAB = cosineSimilarity(conceptA, conceptB);
      const similarityAC = cosineSimilarity(conceptA, conceptC);

      expect(similarityAB).toBeGreaterThan(0.9); // Very similar
      expect(similarityAC).toBeLessThan(0.5); // Not similar
    });

    it('should perform k-nearest neighbor search', () => {
      const query = [1.0, 0.0, 0.0]; // Target: "art"
      const items = [
        { id: 'art-1', vec: [0.95, 0.05, 0.0] },
        { id: 'art-2', vec: [0.9, 0.1, 0.0] },
        { id: 'music-1', vec: [0.0, 0.9, 0.1] },
        { id: 'code-1', vec: [0.0, 0.0, 1.0] },
      ];

      const vectors = items.map((i) => i.vec);
      const neighbors = findKNearestNeighbors(query, vectors, 2);

      expect(neighbors).toHaveLength(2);
      expect(items[neighbors[0]].id).toBe('art-1');
      expect(items[neighbors[1]].id).toBe('art-2');
    });
  });
});
