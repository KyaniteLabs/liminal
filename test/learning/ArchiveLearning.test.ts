import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * ArchiveLearning tests
 */

import { ArchiveLearning } from '../../src/learning/ArchiveLearning.js';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ArchiveLearning', () => {
  let tempArchivePath: string;
  let archive: ArchiveLearning;

  beforeEach(async () => {
    // Create a temporary file for each test
    const tempDir = tmpdir();
    const uniqueId = Math.random().toString(36).substring(7);
    tempArchivePath = join(tempDir, `archive-test-${uniqueId}.json`);

    archive = new ArchiveLearning({
      archivePath: tempArchivePath,
      minQuality: 0.7,
      maxExamplesPerDomain: 5,
      useExamples: true,
      examplesPerGeneration: 3,
    });

    // Initialize the archive
    await archive.getArchive().load();
  });

  afterEach(async () => {
    // Clean up temp file
    try {
      await fs.unlink(tempArchivePath);
    } catch {
      // File might not exist
    }
  });

  it('constructor uses defaults when no config provided', () => {
    const defaultArchive = new ArchiveLearning();
    expect(defaultArchive).toBeInstanceOf(ArchiveLearning);
  });

  it('addOutput returns null for low quality outputs', () => {
    const result = archive.addOutput(
      'test prompt',
      'test output',
      'p5',
      0.5  // Below threshold of 0.7
    );
    expect(result).toBeNull();
  });

  it('addOutput returns ArchivedItem for high quality outputs', () => {
    const result = archive.addOutput(
      'test prompt',
      'test output',
      'p5',
      0.8  // Above threshold of 0.7
    );
    expect(result).not.toBeNull();
    expect(result!.domain).toBe('p5');
    expect(result!.qualityScore).toBe(0.8);
    expect(result!.prompt).toBe('test prompt');
    expect(result!.output).toBe('test output');
  });

  it('addOutput generates unique IDs based on domain and content hash', () => {
    const item1 = archive.addOutput('prompt1', 'output1', 'p5', 0.8);
    const item2 = archive.addOutput('prompt1', 'output1', 'p5', 0.8);
    const item3 = archive.addOutput('prompt1', 'output2', 'p5', 0.8);

    // Same content = same ID
    expect(item1!.id).toBe(item2!.id);
    // Different content = different ID
    expect(item1!.id).not.toBe(item3!.id);
    // ID starts with domain prefix
    expect(item1!.id).toMatch(/^p5_/);
  });

  it('addOutput respects maxExamplesPerDomain limit', () => {
    // Add 10 items (max is 5)
    for (let i = 0; i < 10; i++) {
      archive.addOutput(`prompt ${i}`, `output ${i}`, 'p5', 0.7 + i * 0.02);
    }

    const examples = archive.getExamples('p5', 10);
    expect(examples.length).toBe(5);

    // Should keep the highest quality ones
    const qualities = examples.map(e => e.qualityScore).sort((a, b) => b - a);
    expect(qualities[0]).toBeCloseTo(0.88, 1); // Highest
    expect(qualities[4]).toBeCloseTo(0.80, 1); // 5th highest
  });

  it('getExamples returns items sorted by quality', () => {
    archive.addOutput('prompt1', 'output1', 'p5', 0.75);
    archive.addOutput('prompt2', 'output2', 'p5', 0.85);
    archive.addOutput('prompt3', 'output3', 'p5', 0.80);

    const examples = archive.getExamples('p5', 3);
    expect(examples[0].qualityScore).toBe(0.85);
    expect(examples[1].qualityScore).toBe(0.80);
    expect(examples[2].qualityScore).toBe(0.75);
  });

  it('getExamples respects minScore parameter', () => {
    archive.addOutput('prompt1', 'output1', 'p5', 0.75);
    archive.addOutput('prompt2', 'output2', 'p5', 0.85);
    archive.addOutput('prompt3', 'output3', 'p5', 0.65);

    const examples = archive.getExamples('p5', 10, 0.70);
    expect(examples.length).toBe(2);
    expect(examples.every(e => e.qualityScore >= 0.70)).toBe(true);
  });

  it('getExamples respects n parameter', () => {
    for (let i = 0; i < 10; i++) {
      archive.addOutput(`prompt ${i}`, `output ${i}`, 'p5', 0.8);
    }

    const examples = archive.getExamples('p5', 3);
    expect(examples.length).toBe(3);
  });

  it('getFewshotPrompt returns formatted string with examples', () => {
    archive.addOutput('draw a circle', 'circle code', 'p5', 0.8);
    archive.addOutput('draw a square', 'square code', 'p5', 0.85);

    const fewshot = archive.getFewshotPrompt('p5', 2);

    expect(fewshot).toContain('Example 1 (Quality: 0.85)');
    expect(fewshot).toContain('Prompt: draw a square');
    expect(fewshot).toContain('Output:\nsquare code');
    expect(fewshot).toContain('Example 2 (Quality: 0.80)');
    expect(fewshot).toContain('Prompt: draw a circle');
  });

  it('getFewshotPrompt returns empty string when no examples', () => {
    const fewshot = archive.getFewshotPrompt('glsl');
    expect(fewshot).toBe('');
  });

  it('buildEnhancedPrompt prepends fewshot examples', () => {
    archive.addOutput('example prompt', 'example output', 'p5', 0.8);

    const enhanced = archive.buildEnhancedPrompt('new prompt', 'p5');

    expect(enhanced).toContain('Example 1');
    expect(enhanced).toContain('example prompt');
    expect(enhanced).toContain('example output');
    expect(enhanced).toContain('Now, create your own:');
    expect(enhanced).toContain('new prompt');
  });

  it('buildEnhancedPrompt returns original prompt when useExamples is false', () => {
    const noExamplesArchive = new ArchiveLearning({
      archivePath: tempArchivePath,
      useExamples: false,
    });

    archive.addOutput('example prompt', 'example output', 'p5', 0.8);
    const enhanced = noExamplesArchive.buildEnhancedPrompt('new prompt', 'p5');

    expect(enhanced).toBe('new prompt');
  });

  it('getStats returns archive statistics', () => {
    archive.addOutput('prompt1', 'output1', 'p5', 0.8);
    archive.addOutput('prompt2', 'output2', 'p5', 0.85);
    archive.addOutput('prompt3', 'output3', 'glsl', 0.75);

    const stats = archive.getStats();

    expect(stats.totalOutputs).toBe(3);
    expect(stats.byDomain.p5).toBe(2);
    expect(stats.byDomain.glsl).toBe(1);
    expect(stats.avgQuality.p5).toBeCloseTo(0.825, 2);
    expect(stats.avgQuality.glsl).toBeCloseTo(0.75, 2);
  });

  it('search finds items by keyword in prompt or output', () => {
    archive.addOutput('draw a cat', 'cat code here', 'p5', 0.8);
    archive.addOutput('draw a dog', 'dog code here', 'p5', 0.85);
    archive.addOutput('music melody', 'melody code', 'music', 0.75);

    const catResults = archive.search('cat');
    expect(catResults.length).toBe(1);
    expect(catResults[0].prompt).toContain('cat');

    const drawResults = archive.search('draw');
    expect(drawResults.length).toBe(2);
  });

  it('search respects domain filter', () => {
    archive.addOutput('draw art', 'art code', 'p5', 0.8);
    archive.addOutput('draw art', 'art code', 'glsl', 0.85);

    const p5Results = archive.search('art', 'p5');
    expect(p5Results.length).toBe(1);
    expect(p5Results[0].domain).toBe('p5');
  });

  it('search respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      archive.addOutput(`test ${i}`, `output ${i}`, 'p5', 0.8);
    }

    const results = archive.search('test', undefined, 3);
    expect(results.length).toBe(3);
  });

  it('recordUsage increments usedCount', async () => {
    const item = archive.addOutput('prompt', 'output', 'p5', 0.8);
    expect(item!.usedCount).toBe(0);

    archive.recordUsage(item!.id);
    // Need to reload to see the change from underlying archive
    await archive.getArchive().load();
    const updated = archive.getArchive().getById(item!.id);
    expect(updated?.usedCount).toBe(1);
  });

  it('addUserRating adds rating to item', async () => {
    const item = archive.addOutput('prompt', 'output', 'p5', 0.8);
    expect(item!.userRating).toBeUndefined();

    archive.addUserRating(item!.id, 4.5);
    await archive.getArchive().load();
    const updated = archive.getArchive().getById(item!.id);
    expect(updated?.userRating).toBe(4.5);
  });

  it('exportForFinetuning returns training data format', () => {
    archive.addOutput('prompt1', 'output1', 'p5', 0.8);
    archive.addOutput('prompt2', 'output2', 'p5', 0.9);
    archive.addOutput('prompt3', 'output3', 'glsl', 0.7);  // Below default 0.75

    const exported = archive.exportForFinetuning();

    expect(exported.length).toBe(2);  // Only p5 items above 0.75
    expect(exported[0]).toHaveProperty('prompt');
    expect(exported[0]).toHaveProperty('completion');
    expect(exported[0]).toHaveProperty('domain');
    expect(exported[0]).toHaveProperty('qualityScore');
    expect(exported[0]).toHaveProperty('metadata');
  });

  it('exportForFinetuning respects domain filter', () => {
    archive.addOutput('prompt1', 'output1', 'p5', 0.8);
    archive.addOutput('prompt2', 'output2', 'glsl', 0.8);

    const exported = archive.exportForFinetuning('p5');
    expect(exported.length).toBe(1);
    expect(exported[0].domain).toBe('p5');
  });

  it('exportForFinetuning respects minQuality parameter', () => {
    archive.addOutput('prompt1', 'output1', 'p5', 0.7);
    archive.addOutput('prompt2', 'output2', 'p5', 0.8);
    archive.addOutput('prompt3', 'output3', 'p5', 0.9);

    const exported = archive.exportForFinetuning(undefined, 0.85);
    expect(exported.length).toBe(1);
    expect(exported[0].qualityScore).toBe(0.9);
  });

  it('getArchive returns underlying QualityArchive instance', () => {
    const underlying = archive.getArchive();
    expect(underlying).not.toBeNull();
    expect(underlying).toHaveProperty('query');
    expect(underlying).toHaveProperty('add');
  });

  it('handles multiple domains independently', () => {
    archive.addOutput('p5 prompt', 'p5 output', 'p5', 0.8);
    archive.addOutput('glsl prompt', 'glsl output', 'glsl', 0.85);
    archive.addOutput('music prompt', 'music output', 'music', 0.75);

    const p5Examples = archive.getExamples('p5');
    const glslExamples = archive.getExamples('glsl');
    const musicExamples = archive.getExamples('music');

    expect(p5Examples.length).toBe(1);
    expect(glslExamples.length).toBe(1);
    expect(musicExamples.length).toBe(1);

    expect(p5Examples[0].domain).toBe('p5');
    expect(glslExamples[0].domain).toBe('glsl');
    expect(musicExamples[0].domain).toBe('music');
  });
});
