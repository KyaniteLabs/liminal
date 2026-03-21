import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * AestheticModel tests
 */

import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { AestheticModel, AestheticDataPoint } from '../../../src/evolution/AestheticModel.js';

describe('AestheticModel', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aesthetic-model-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('constructor defaults k to 5', () => {
    const model = new AestheticModel();
    expect(model.size()).toBe(0);
    // Default k=5 — verify by adding exactly 5 items and checking prediction works
    model.update([
      { behavior: [0.1, 0.1], rating: 3, domain: 'test' },
      { behavior: [0.2, 0.2], rating: 3, domain: 'test' },
      { behavior: [0.3, 0.3], rating: 3, domain: 'test' },
      { behavior: [0.4, 0.4], rating: 3, domain: 'test' },
      { behavior: [0.5, 0.5], rating: 3, domain: 'test' },
      { behavior: [0.9, 0.9], rating: 1, domain: 'test' },
    ]);
    // With k=5, the 6th point (far away, low rating) should be excluded
    const score = model.predict([0.1, 0.1], { domain: 'test' });
    expect(score).toBeGreaterThan(0.4); // all 5 neighbors are rated 3 -> 0.6
  });

  it('constructor accepts custom k', () => {
    const model = new AestheticModel(2);
    expect(model.size()).toBe(0);
  });

  it('predict returns 0.5 for empty model (no data)', () => {
    const model = new AestheticModel();
    expect(model.predict([0.5, 0.5], { domain: 'test' })).toBe(0.5);
  });

  it('predict returns high score for similar highly-rated items', () => {
    const model = new AestheticModel(3);
    model.update([
      { behavior: [0.5, 0.5], rating: 5, domain: 'test' },
      { behavior: [0.51, 0.51], rating: 5, domain: 'test' },
      { behavior: [0.49, 0.49], rating: 5, domain: 'test' },
    ]);

    const score = model.predict([0.5, 0.5], { domain: 'test' });
    // All neighbors are very close and rated 5 -> score should be close to 1.0
    expect(score).toBeGreaterThan(0.9);
  });

  it('predict returns low score for similar lowly-rated items', () => {
    const model = new AestheticModel(3);
    model.update([
      { behavior: [0.5, 0.5], rating: 0, domain: 'test' },
      { behavior: [0.51, 0.51], rating: 0, domain: 'test' },
      { behavior: [0.49, 0.49], rating: 0, domain: 'test' },
    ]);

    const score = model.predict([0.5, 0.5], { domain: 'test' });
    // All neighbors are very close and rated 0 -> score should be close to 0.0
    expect(score).toBeLessThan(0.1);
  });

  it('predict gives domain bonus for matching domain', () => {
    const model = new AestheticModel(2);
    // Same behavior vector but different domains, different ratings
    model.update([
      { behavior: [0.5, 0.5], rating: 5, domain: 'art' },
      { behavior: [0.5, 0.5], rating: 1, domain: 'music' },
    ]);

    const artScore = model.predict([0.5, 0.5], { domain: 'art' });
    const musicScore = model.predict([0.5, 0.5], { domain: 'music' });

    // Matching domain should boost that neighbor's weight, pulling score toward its rating
    expect(artScore).toBeGreaterThan(musicScore);
  });

  it('update adds data points, size increases', () => {
    const model = new AestheticModel();
    expect(model.size()).toBe(0);

    model.update([
      { behavior: [0.1, 0.1], rating: 3, domain: 'test' },
    ]);
    expect(model.size()).toBe(1);

    model.update([
      { behavior: [0.2, 0.2], rating: 4, domain: 'test' },
      { behavior: [0.3, 0.3], rating: 2, domain: 'test' },
    ]);
    expect(model.size()).toBe(3);
  });

  it('save writes JSON file', async () => {
    const model = new AestheticModel();
    model.update([
      { behavior: [0.5, 0.5], rating: 4, domain: 'test' },
    ]);

    const filePath = path.join(tmpDir, 'model.json');
    await model.save(filePath);

    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].rating).toBe(4);
    expect(parsed[0].behavior).toEqual([0.5, 0.5]);
    expect(parsed[0].domain).toBe('test');
  });

  it('load reads JSON file', async () => {
    const filePath = path.join(tmpDir, 'model.json');
    const data: AestheticDataPoint[] = [
      { behavior: [0.3, 0.7], rating: 3, domain: 'test' },
    ];
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');

    const model = new AestheticModel();
    await model.load(filePath);

    expect(model.size()).toBe(1);
    expect(model.predict([0.3, 0.7], { domain: 'test' })).toBeCloseTo(0.6, 5);
  });

  it('round-trip: save then load preserves predictions', async () => {
    const model = new AestheticModel(3);
    model.update([
      { behavior: [0.1, 0.1], rating: 5, domain: 'art' },
      { behavior: [0.9, 0.9], rating: 1, domain: 'music' },
      { behavior: [0.5, 0.5], rating: 3, domain: 'test' },
    ]);

    const query = [0.15, 0.15];
    const originalScore = model.predict(query, { domain: 'art' });

    const filePath = path.join(tmpDir, 'model.json');
    await model.save(filePath);

    const model2 = new AestheticModel(3);
    await model2.load(filePath);

    const restoredScore = model2.predict(query, { domain: 'art' });
    expect(restoredScore).toBeCloseTo(originalScore, 10);
  });

  it('clear empties model', () => {
    const model = new AestheticModel();
    model.update([
      { behavior: [0.1, 0.1], rating: 3, domain: 'test' },
      { behavior: [0.2, 0.2], rating: 4, domain: 'test' },
    ]);
    expect(model.size()).toBe(2);

    model.clear();
    expect(model.size()).toBe(0);
    // After clear, should return neutral 0.5
    expect(model.predict([0.5, 0.5], { domain: 'test' })).toBe(0.5);
  });

  it('handles different-dimension vectors (padding)', () => {
    const model = new AestheticModel(2);
    // 2D vectors in training data
    model.update([
      { behavior: [0.5, 0.5], rating: 5, domain: 'test' },
      { behavior: [0.5, 0.5], rating: 4, domain: 'test' },
    ]);

    // Query with 3D vector — extra dimension treated as 0 in training data
    // [0.5, 0.5, 0.5] vs [0.5, 0.5, 0] -> distance = sqrt(0 + 0 + 0.25) = 0.5
    const score = model.predict([0.5, 0.5, 0.5], { domain: 'test' });
    // Both neighbors have distance 0.5, weights are equal
    // Weighted average: (5 + 4) / 2 = 4.5, normalized: 4.5/5 = 0.9
    expect(score).toBeCloseTo(0.9, 5);
  });
});
