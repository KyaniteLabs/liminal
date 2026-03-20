/**
 * NoveltyArchive unit tests
 */

import { NoveltyArchive } from '../../src/evolution/NoveltyArchive.js';

describe('NoveltyArchive', () => {
  describe('noveltyScore', () => {
    it('should return 1.0 for empty archive', () => {
      const archive = new NoveltyArchive();
      expect(archive.noveltyScore([0.5, 0.5])).toBe(1.0);
    });

    it('should return low score for similar items', () => {
      const archive = new NoveltyArchive();
      archive.add([0.5, 0.5]);
      archive.add([0.5, 0.5]);
      archive.add([0.5, 0.5]);
      // New item is very similar to existing ones
      expect(archive.noveltyScore([0.5, 0.5])).toBeCloseTo(0, 1);
    });

    it('should return high score for novel item', () => {
      const archive = new NoveltyArchive();
      archive.add([0.0, 0.0]);
      archive.add([0.1, 0.1]);
      archive.add([0.2, 0.2]);
      // New item is far from existing
      expect(archive.noveltyScore([0.9, 0.9])).toBeGreaterThan(0.3);
    });
  });

  describe('sparseness', () => {
    it('should be same as noveltyScore', () => {
      const archive = new NoveltyArchive();
      archive.add([0.5, 0.5]);
      archive.add([0.1, 0.9]);
      const novelty = archive.noveltyScore([0.7, 0.3]);
      const sparseness = archive.sparseness([0.7, 0.3]);
      expect(sparseness).toBe(novelty);
    });
  });

  describe('capacity', () => {
    it('should evict oldest items when at capacity', () => {
      const archive = new NoveltyArchive(3, 5);
      archive.add([1.0, 0.0]);
      archive.add([2.0, 0.0]);
      archive.add([3.0, 0.0]);
      archive.add([4.0, 0.0]); // evicts [1.0, 0.0]
      expect(archive.size()).toBe(3);
      // Novelty should be higher since [1.0, 0.0] was evicted
      expect(archive.noveltyScore([1.0, 0.0])).toBeGreaterThan(0);
    });
  });

  describe('k neighbors', () => {
    it('should use fewer neighbors when archive is small', () => {
      const archive = new NoveltyArchive(100, 10);
      archive.add([0.0, 0.0]);
      archive.add([1.0, 1.0]);
      // Only 2 items, so k=min(10, 2)=2
      const score = archive.noveltyScore([0.5, 0.5]);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      const archive = new NoveltyArchive();
      archive.add([0.5, 0.5]);
      archive.add([0.5, 0.5]);
      archive.clear();
      expect(archive.size()).toBe(0);
      expect(archive.noveltyScore([0.5, 0.5])).toBe(1.0);
    });
  });

  describe('different dimensions', () => {
    it('should handle vectors of different lengths', () => {
      const archive = new NoveltyArchive();
      archive.add([0.5, 0.5, 0.5]);
      // Query with 2D vector — shorter dimension padded with 0
      expect(archive.noveltyScore([0.0, 0.0])).toBeGreaterThan(0);
    });
  });
});
