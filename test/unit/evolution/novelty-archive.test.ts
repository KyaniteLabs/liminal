/**
 * NoveltyArchive tests
 */

import { NoveltyArchive } from '../../../src/evolution/NoveltyArchive.js';

describe('NoveltyArchive', () => {
  it('constructor defaults to capacity 1000 and k=5', () => {
    const archive = new NoveltyArchive();
    expect(archive.size()).toBe(0);
  });

  it('constructor accepts custom capacity and k', () => {
    const archive = new NoveltyArchive(50, 3);
    expect(archive.size()).toBe(0);
  });

  it('add adds items and size increases', () => {
    const archive = new NoveltyArchive();
    archive.add([0.5, 0.5]);
    expect(archive.size()).toBe(1);
    archive.add([0.1, 0.9]);
    expect(archive.size()).toBe(2);
  });

  it('add respects capacity with FIFO eviction', () => {
    const archive = new NoveltyArchive(3, 2);
    archive.add([0.0, 0.0]);
    archive.add([0.5, 0.5]);
    archive.add([1.0, 1.0]);
    expect(archive.size()).toBe(3);

    // Adding a 4th should evict the oldest [0.0, 0.0]
    archive.add([0.3, 0.3]);
    expect(archive.size()).toBe(3);

    // Archive now contains [0.5, 0.5], [1.0, 1.0], [0.3, 0.3]
    // Query near the evicted item — no exact match, so novelty should be moderate
    const score = archive.noveltyScore([0.0, 0.0]);
    expect(score).toBeGreaterThan(0.1);

    // Query the item that is still in archive — should have low novelty
    const existingScore = archive.noveltyScore([0.5, 0.5]);
    expect(existingScore).toBeLessThan(score);
  });

  it('noveltyScore returns 1.0 for empty archive', () => {
    const archive = new NoveltyArchive();
    expect(archive.noveltyScore([0.5, 0.5])).toBe(1.0);
  });

  it('noveltyScore increases for items far from archive', () => {
    const archive = new NoveltyArchive(100, 3);
    // Fill archive with items near [0.1, 0.1]
    for (let i = 0; i < 10; i++) {
      archive.add([0.1, 0.1]);
    }

    const nearScore = archive.noveltyScore([0.1, 0.1]);
    const farScore = archive.noveltyScore([0.9, 0.9]);

    expect(farScore).toBeGreaterThan(nearScore);
  });

  it('noveltyScore decreases for items similar to archive', () => {
    const archive = new NoveltyArchive(100, 3);
    for (let i = 0; i < 10; i++) {
      archive.add([0.8, 0.2]);
    }

    const similarScore = archive.noveltyScore([0.8, 0.2]);
    const differentScore = archive.noveltyScore([0.2, 0.8]);

    expect(differentScore).toBeGreaterThan(similarScore);
    // Similar item should have very low novelty (close to 0)
    expect(similarScore).toBeLessThan(0.1);
  });

  it('sparseness equals noveltyScore', () => {
    const archive = new NoveltyArchive(100, 3);
    archive.add([0.5, 0.5]);
    const behavior = [0.2, 0.8];

    expect(archive.sparseness(behavior)).toBe(archive.noveltyScore(behavior));
  });

  it('clear empties the archive', () => {
    const archive = new NoveltyArchive();
    archive.add([0.1, 0.2]);
    archive.add([0.3, 0.4]);
    expect(archive.size()).toBe(2);

    archive.clear();
    expect(archive.size()).toBe(0);
    // After clear, novelty should be 1.0 again
    expect(archive.noveltyScore([0.5, 0.5])).toBe(1.0);
  });

  it('handles different-dimension vectors with zero-padding', () => {
    const archive = new NoveltyArchive(100, 2);
    // 2D vectors in archive
    archive.add([1.0, 1.0]);
    archive.add([0.0, 0.0]);

    // Query with 3D vector — extra dimension padded with 0 in archive items
    // [1.0, 1.0, 1.0] vs [1.0, 1.0, 0] -> distance = |1-0| / sqrt(3) = 1/sqrt(3) ≈ 0.577
    // [1.0, 1.0, 1.0] vs [0.0, 0.0, 0] -> distance = sqrt(2+1)/sqrt(3) = sqrt(3)/sqrt(3) = 1.0
    const score = archive.noveltyScore([1.0, 1.0, 1.0]);
    // Average of 0.577 and 1.0 ≈ 0.789
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(1.0);
  });

  it('k neighbors work correctly with small archive', () => {
    const archive = new NoveltyArchive(100, 5);
    // Only add 2 items
    archive.add([0.0, 0.0]);
    archive.add([1.0, 1.0]);

    // Should use all 2 items (min of k=5 and size=2)
    const score = archive.noveltyScore([0.5, 0.5]);
    // Distance to [0,0]: sqrt(0.5)/sqrt(2) = sqrt(0.5)/sqrt(2) = sqrt(1/4) = 0.5
    // Wait: sqrt((0.5^2 + 0.5^2)) / sqrt(2) = sqrt(0.5)/sqrt(2) = sqrt(0.25) = 0.5
    // Distance to [1,1]: sqrt((0.5^2 + 0.5^2)) / sqrt(2) = 0.5
    // Average: 0.5
    expect(score).toBeCloseTo(0.5, 10);
  });
});
