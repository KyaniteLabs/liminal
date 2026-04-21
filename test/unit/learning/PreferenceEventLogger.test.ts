/**
 * Unit tests for PreferenceEventLogger — Phase 13E
 *
 * Tests preference event logging with filesystem persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { PreferenceEventLogger } from '../../../src/learning/PreferenceEventLogger.js';

describe('PreferenceEventLogger', () => {
  let prefDir: string;
  let logger: PreferenceEventLogger;

  beforeEach(async () => {
    prefDir = join(tmpdir(), `pref-test-${Date.now()}`);
    await mkdir(prefDir, { recursive: true });
    logger = new PreferenceEventLogger({ prefDir });
  });

  afterEach(async () => {
    await rm(prefDir, { recursive: true, force: true });
  });

  it('logs a preference event and retrieves it', async () => {
    const record = await logger.log({ action: 'pin', artifactId: 'art-1' });
    expect(record.action).toBe('pin');
    expect(record.artifactId).toBe('art-1');

    const events = await logger.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].artifactId).toBe('art-1');
  });

  it('filters events by artifactId', async () => {
    await logger.log({ action: 'pin', artifactId: 'art-1' });
    await logger.log({ action: 'pin', artifactId: 'art-2' });

    const filtered = await logger.getEvents({ artifactId: 'art-1' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].artifactId).toBe('art-1');
  });

  it('filters events by action', async () => {
    await logger.log({ action: 'pin', artifactId: 'art-1' });
    await logger.log({ action: 'favorite', artifactId: 'art-2' });

    const pinned = await logger.getEvents({ action: 'pin' });
    expect(pinned).toHaveLength(1);
    expect(pinned[0].action).toBe('pin');
  });

  it('returns pairwise comparisons', async () => {
    await logger.log({ action: 'pairwise-a', artifactId: 'winner', comparedTo: 'loser' });
    await logger.log({ action: 'pairwise-b', artifactId: 'loser', comparedTo: 'winner-b' });

    const comparisons = await logger.getPairwiseComparisons();
    expect(comparisons).toHaveLength(2);
    // pairwise-a: winner won vs loser
    expect(comparisons[0].winner).toBe('winner');
    expect(comparisons[0].loser).toBe('loser');
  });

  it('returns preference counts', async () => {
    await logger.log({ action: 'pin', artifactId: 'art-1' });
    await logger.log({ action: 'pin', artifactId: 'art-1' });
    await logger.log({ action: 'less-like-this', artifactId: 'art-2' });

    const counts = await logger.getPreferenceCounts();
    expect(counts.get('art-1')?.positive).toBe(2);
    expect(counts.get('art-2')?.negative).toBe(1);
  });

  it('exports dataset', async () => {
    await logger.log({ action: 'pin', artifactId: 'art-1' });
    await logger.log({ action: 'pairwise-a', artifactId: 'winner', comparedTo: 'loser' });

    const dataset = await logger.exportDataset();
    expect(dataset.totalEvents).toBe(2);
    expect(dataset.positiveFeedback).toHaveLength(1);
    expect(dataset.pairwiseComparisons).toHaveLength(1);
  });

  it('returns stats', async () => {
    await logger.log({ action: 'pin', artifactId: 'art-1' });
    await logger.log({ action: 'pairwise-a', artifactId: 'a', comparedTo: 'b' });

    const stats = await logger.getStats();
    expect(stats.totalEvents).toBe(2);
    expect(stats.uniqueArtifacts).toBe(2); // art-1, a (comparedTo not counted)
    expect(stats.pairwiseCount).toBe(1);
  });

  it('persists and reloads events', async () => {
    await logger.log({ action: 'pin', artifactId: 'art-1' });

    // Create new logger pointing to same dir
    const logger2 = new PreferenceEventLogger({ prefDir });
    const events = await logger2.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].artifactId).toBe('art-1');
  });
});
