import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * QualityArchive tests
 */

import { QualityArchive, ArchiveEntry } from '../../src/learning/QualityArchive.js';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('QualityArchive', () => {
  let tempArchivePath: string;
  let archive: QualityArchive;

  beforeEach(async () => {
    // Create a temporary file for each test
    const tempDir = tmpdir();
    const uniqueId = Math.random().toString(36).substring(7);
    tempArchivePath = join(tempDir, `quality-archive-test-${uniqueId}.json`);

    archive = new QualityArchive({
      path: tempArchivePath,
      minQuality: 0.7,
      maxExamplesPerDomain: 5,
    });

    await archive.load();
  });

  afterEach(async () => {
    // Clean up temp file
    try {
      await fs.unlink(tempArchivePath);
    } catch {
      // File might not exist
    }
  });

  it('constructor uses default values when no config provided', () => {
    const defaultArchive = new QualityArchive();
    expect(defaultArchive).toBeInstanceOf(QualityArchive);
  });

  it('load creates empty archive when file does not exist', async () => {
    const nonExistentPath = join(tmpdir(), 'non-existent-archive.json');
    const newArchive = new QualityArchive({ path: nonExistentPath });
    await newArchive.load();

    const stats = newArchive.getStats();
    expect(stats.totalOutputs).toBe(0);
  });

  it('add stores entry and persists to disk', async () => {
    const entry: ArchiveEntry = {
      id: 'p5_abc123',
      domain: 'p5',
      prompt: 'test prompt',
      output: 'test output',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    await archive.add(entry);

    // Create new archive instance to test persistence
    const archive2 = new QualityArchive({ path: tempArchivePath });
    await archive2.load();

    const retrieved = archive2.getById('p5_abc123');

    expect(retrieved!.prompt).toBe('test prompt');
  });

  it('add respects maxExamplesPerDomain limit', async () => {
    // Add 10 items (max is 5)
    for (let i = 0; i < 10; i++) {
      const entry: ArchiveEntry = {
        id: `p5_${i}`,
        domain: 'p5',
        prompt: `prompt ${i}`,
        output: `output ${i}`,
        qualityScore: 0.7 + i * 0.02,
        metadata: {},
        createdAt: new Date().toISOString(),
      };
      await archive.add(entry);
    }

    const all = archive.getAll('p5');
    expect(all.length).toBe(5);

    // Should keep highest quality
    const qualities = all.map(e => e.qualityScore).sort((a, b) => b - a);
    expect(qualities[0]).toBeCloseTo(0.88, 1);
  });

  it('query returns entries sorted by quality by default', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.75,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.85,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'p5',
      prompt: 'p3',
      output: 'o3',
      qualityScore: 0.80,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const results = archive.query('p5');
    expect(results[0].qualityScore).toBe(0.85);
    expect(results[1].qualityScore).toBe(0.80);
    expect(results[2].qualityScore).toBe(0.75);
  });

  it('query filters by minQuality', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.75,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.85,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'p5',
      prompt: 'p3',
      output: 'o3',
      qualityScore: 0.65,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const results = archive.query('p5', { minQuality: 0.70 });
    expect(results.length).toBe(2);
    expect(results.every(e => e.qualityScore >= 0.70)).toBe(true);
  });

  it('query filters by recency with since parameter', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.8,
      metadata: {},
      createdAt: yesterday.toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.8,
      metadata: {},
      createdAt: now.toISOString(),
    });

    const results = archive.query('p5', {
      since: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('2');
  });

  it('query sorts by recent when sortBy is recent', async () => {
    const now = new Date();
    const times = [
      now.getTime() - 3000,
      now.getTime() - 2000,
      now.getTime() - 1000,
    ];

    for (let i = 0; i < 3; i++) {
      await archive.add({
        id: `${i}`,
        domain: 'p5',
        prompt: `p${i}`,
        output: `o${i}`,
        qualityScore: 0.8,
        metadata: {},
        createdAt: new Date(times[i]).toISOString(),
      });
    }

    const results = archive.query('p5', { sortBy: 'recent' });
    expect(results[0].id).toBe('2'); // Most recent
    expect(results[1].id).toBe('1');
    expect(results[2].id).toBe('0'); // Oldest
  });

  it('query respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await archive.add({
        id: `${i}`,
        domain: 'p5',
        prompt: `p${i}`,
        output: `o${i}`,
        qualityScore: 0.8,
        metadata: {},
        createdAt: new Date().toISOString(),
      });
    }

    const results = archive.query('p5', { limit: 3 });
    expect(results.length).toBe(3);
  });

  it('search finds items by keyword in prompt or output', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'draw a cat',
      output: 'cat drawing code',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'draw a dog',
      output: 'dog drawing code',
      qualityScore: 0.85,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'music',
      prompt: 'play melody',
      output: 'melody code',
      qualityScore: 0.75,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const catResults = archive.search('cat');
    expect(catResults.length).toBe(1);
    expect(catResults[0].id).toBe('1');

    const drawResults = archive.search('draw');
    expect(drawResults.length).toBe(2);
  });

  it('search respects domain filter', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'art prompt',
      output: 'art output',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'glsl',
      prompt: 'art prompt',
      output: 'art output',
      qualityScore: 0.85,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const results = archive.search('art', 'p5');
    expect(results.length).toBe(1);
    expect(results[0].domain).toBe('p5');
  });

  it('search respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await archive.add({
        id: `${i}`,
        domain: 'p5',
        prompt: `test ${i}`,
        output: `output ${i}`,
        qualityScore: 0.8,
        metadata: {},
        createdAt: new Date().toISOString(),
      });
    }

    const results = archive.search('test', undefined, 3);
    expect(results.length).toBe(3);
  });

  it('search returns results sorted by quality', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'test',
      output: 'output1',
      qualityScore: 0.75,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'test',
      output: 'output2',
      qualityScore: 0.90,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'p5',
      prompt: 'test',
      output: 'output3',
      qualityScore: 0.80,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const results = archive.search('test');
    expect(results[0].qualityScore).toBe(0.90);
    expect(results[1].qualityScore).toBe(0.80);
    expect(results[2].qualityScore).toBe(0.75);
  });

  it('recordUsage increments usedCount', async () => {
    await archive.add({
      id: 'test-id',
      domain: 'p5',
      prompt: 'test',
      output: 'output',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    await archive.recordUsage('test-id');

    const entry = archive.getById('test-id');
    expect(entry?.usedCount).toBe(1);

    await archive.recordUsage('test-id');
    await archive.recordUsage('test-id');

    const updated = archive.getById('test-id');
    expect(updated?.usedCount).toBe(3);
  });

  it('addUserRating adds rating to entry', async () => {
    await archive.add({
      id: 'test-id',
      domain: 'p5',
      prompt: 'test',
      output: 'output',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    await archive.addUserRating('test-id', 4.5);

    const entry = archive.getById('test-id');
    expect(entry?.userRating).toBe(4.5);
  });

  it('getStats returns correct statistics', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.9,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'glsl',
      prompt: 'p3',
      output: 'o3',
      qualityScore: 0.75,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const stats = archive.getStats();

    expect(stats.totalOutputs).toBe(3);
    expect(stats.byDomain.p5).toBe(2);
    expect(stats.byDomain.glsl).toBe(1);
    expect(stats.avgQuality.p5).toBeCloseTo(0.85, 2);
    expect(stats.avgQuality.glsl).toBe(0.75);
  });

  it('exportForFinetuning returns correct format', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'prompt1',
      output: 'output1',
      qualityScore: 0.8,
      metadata: { key: 'value' },
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'prompt2',
      output: 'output2',
      qualityScore: 0.7,  // Below 0.75
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const exported = archive.exportForFinetuning();

    expect(exported.length).toBe(1);
    expect(exported[0].prompt).toBe('prompt1');
    expect(exported[0].completion).toBe('output1');
    expect(exported[0].domain).toBe('p5');
    expect(exported[0].qualityScore).toBe(0.8);
    expect(exported[0].metadata).toEqual({ key: 'value' });
  });

  it('exportForFinetuning respects domain filter', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'glsl',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const exported = archive.exportForFinetuning('p5');
    expect(exported.length).toBe(1);
    expect(exported[0].domain).toBe('p5');
  });

  it('exportForFinetuning respects minQuality parameter', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.9,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'p5',
      prompt: 'p3',
      output: 'o3',
      qualityScore: 0.7,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const exported = archive.exportForFinetuning(undefined, 0.85);
    expect(exported.length).toBe(1);
    expect(exported[0].qualityScore).toBe(0.9);
  });

  it('clear removes all entries', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'glsl',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    expect(archive.getStats().totalOutputs).toBe(2);

    await archive.clear();

    expect(archive.getStats().totalOutputs).toBe(0);
  });

  it('getAll returns all entries for a domain', async () => {
    await archive.add({
      id: '1',
      domain: 'p5',
      prompt: 'p1',
      output: 'o1',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '2',
      domain: 'p5',
      prompt: 'p2',
      output: 'o2',
      qualityScore: 0.85,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    await archive.add({
      id: '3',
      domain: 'glsl',
      prompt: 'p3',
      output: 'o3',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const p5Entries = archive.getAll('p5');
    expect(p5Entries.length).toBe(2);

    const glslEntries = archive.getAll('glsl');
    expect(glslEntries.length).toBe(1);
  });

  it('getById returns entry or undefined', async () => {
    await archive.add({
      id: 'test-id',
      domain: 'p5',
      prompt: 'test',
      output: 'output',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const found = archive.getById('test-id');

    expect(found!.id).toBe('test-id');

    const notFound = archive.getById('non-existent');
    expect(notFound).toBeUndefined();
  });

  it('handles new domains dynamically', async () => {
    await archive.add({
      id: '1',
      domain: 'newdomain',
      prompt: 'test',
      output: 'output',
      qualityScore: 0.8,
      metadata: {},
      createdAt: new Date().toISOString(),
    });

    const entries = archive.getAll('newdomain');
    expect(entries.length).toBe(1);
  });
});
