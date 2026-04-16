/**
 * PreferenceEventLogger — Phase 13E
 *
 * Captures user preference actions (pin, favorite, branch, compost,
 * more-like-this, less-like-this, pairwise) as structured data persisted
 * through LiminalFS. This is the taste-learning signal pipeline.
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { Logger } from '../utils/Logger.js';
import type { PreferenceAction, PreferenceRecord } from '../emergence/types.js';

export interface PreferenceEventLoggerConfig {
  /** Directory for preference event logs (default: ~/.liminal/preferences/) */
  prefDir?: string;
}

const DEFAULT_PREF_DIR = `${process.env.HOME}/.liminal/preferences`;

export class PreferenceEventLogger {
  private readonly prefDir: string;
  private events: PreferenceRecord[] = [];
  private loaded = false;

  constructor(config: PreferenceEventLoggerConfig = {}) {
    this.prefDir = config.prefDir ?? DEFAULT_PREF_DIR;
  }

  /**
   * Log a user preference action.
   */
  async log(params: {
    action: PreferenceAction;
    artifactId: string;
    comparedTo?: string;
    sessionId?: string;
  }): Promise<PreferenceRecord> {
    await this.ensureLoaded();

    const record: PreferenceRecord = {
      action: params.action,
      artifactId: params.artifactId,
      comparedTo: params.comparedTo,
      sessionId: params.sessionId,
      capturedAt: new Date().toISOString(),
    };

    this.events.push(record);
    await this.persist(record);

    Logger.info('PreferenceEventLogger', `${params.action} on ${params.artifactId}${params.comparedTo ? ` vs ${params.comparedTo}` : ''}`);
    return record;
  }

  /**
   * Get all preference events, optionally filtered.
   */
  async getEvents(filter?: {
    artifactId?: string;
    action?: PreferenceAction;
    sessionId?: string;
    since?: string;
  }): Promise<PreferenceRecord[]> {
    await this.ensureLoaded();

    let results = this.events;

    if (filter?.artifactId) {
      results = results.filter(e => e.artifactId === filter.artifactId);
    }
    if (filter?.action) {
      results = results.filter(e => e.action === filter.action);
    }
    if (filter?.sessionId) {
      results = results.filter(e => e.sessionId === filter.sessionId);
    }
    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      results = results.filter(e => new Date(e.capturedAt) >= sinceDate);
    }

    return results;
  }

  /**
   * Get pairwise comparison records — the strongest taste signal.
   */
  async getPairwiseComparisons(sessionId?: string): Promise<Array<{
    winner: string;
    loser: string;
    capturedAt: string;
  }>> {
    const pairwiseEvents = await this.getEvents({
      action: 'pairwise-a' as PreferenceAction,
      sessionId,
    });

    const pairedB = await this.getEvents({
      action: 'pairwise-b' as PreferenceAction,
      sessionId,
    });

    const comparisons: Array<{ winner: string; loser: string; capturedAt: string }> = [];

    // pairwise-a: artifactId won, comparedTo lost
    for (const event of pairwiseEvents) {
      if (!event.comparedTo) continue;
      comparisons.push({
        winner: event.artifactId,
        loser: event.comparedTo,
        capturedAt: event.capturedAt,
      });
    }

    // pairwise-b: comparedTo won, artifactId lost
    for (const event of pairedB) {
      if (!event.comparedTo) continue;
      comparisons.push({
        winner: event.comparedTo,
        loser: event.artifactId,
        capturedAt: event.capturedAt,
      });
    }

    return comparisons;
  }

  /**
   * Get the preference count per artifact (for ranking bias).
   */
  async getPreferenceCounts(): Promise<Map<string, { positive: number; negative: number }>> {
    await this.ensureLoaded();

    const counts = new Map<string, { positive: number; negative: number }>();

    const positiveActions: Set<PreferenceAction> = new Set(['pin', 'favorite', 'more-like-this', 'pairwise-a']);
    const negativeActions: Set<PreferenceAction> = new Set(['less-like-this', 'reject']);

    for (const event of this.events) {
      const id = event.artifactId;
      if (!counts.has(id)) {
        counts.set(id, { positive: 0, negative: 0 });
      }
      const count = counts.get(id)!;

      if (positiveActions.has(event.action)) count.positive++;
      if (negativeActions.has(event.action)) count.negative++;

      // Also count the "loser" in pairwise
      if (event.action === 'pairwise-a' && event.comparedTo) {
        if (!counts.has(event.comparedTo)) {
          counts.set(event.comparedTo, { positive: 0, negative: 0 });
        }
        counts.get(event.comparedTo)!.negative++;
      }
    }

    return counts;
  }

  /**
   * Export all events for a session (used by CLI export command).
   */
  async exportSession(sessionId: string): Promise<PreferenceRecord[]> {
    return this.getEvents({ sessionId });
  }

  /**
   * Export all events as a taste-learning dataset.
   */
  async exportDataset(): Promise<{
    pairwiseComparisons: Array<{ winner: string; loser: string }>;
    positiveFeedback: Array<{ artifactId: string; action: PreferenceAction }>;
    negativeFeedback: Array<{ artifactId: string; action: PreferenceAction }>;
    totalEvents: number;
  }> {
    await this.ensureLoaded();

    const comparisons = await this.getPairwiseComparisons();
    const positiveActions: Set<PreferenceAction> = new Set(['pin', 'favorite', 'more-like-this']);
    const negativeActions: Set<PreferenceAction> = new Set(['less-like-this', 'reject']);

    return {
      pairwiseComparisons: comparisons.map(c => ({ winner: c.winner, loser: c.loser })),
      positiveFeedback: this.events
        .filter(e => positiveActions.has(e.action))
        .map(e => ({ artifactId: e.artifactId, action: e.action })),
      negativeFeedback: this.events
        .filter(e => negativeActions.has(e.action))
        .map(e => ({ artifactId: e.artifactId, action: e.action })),
      totalEvents: this.events.length,
    };
  }

  /**
   * Get statistics.
   */
  async getStats(): Promise<{
    totalEvents: number;
    byAction: Record<PreferenceAction, number>;
    uniqueArtifacts: number;
    pairwiseCount: number;
  }> {
    await this.ensureLoaded();

    const byAction: Record<string, number> = {};
    const artifacts = new Set<string>();
    let pairwiseCount = 0;

    for (const event of this.events) {
      byAction[event.action] = (byAction[event.action] ?? 0) + 1;
      artifacts.add(event.artifactId);
      if (event.action === 'pairwise-a' || event.action === 'pairwise-b') {
        pairwiseCount++;
      }
    }

    return {
      totalEvents: this.events.length,
      byAction: byAction as Record<PreferenceAction, number>,
      uniqueArtifacts: artifacts.size,
      pairwiseCount,
    };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const files = await fs.readdir(this.prefDir).catch(() => [] as string[]);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(join(this.prefDir, file), 'utf-8');
          const record: PreferenceRecord = JSON.parse(data);
          this.events.push(record);
        } catch {
          // Skip corrupted files
        }
      }
      // Sort by timestamp
      this.events.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      Logger.info('PreferenceEventLogger', `Loaded ${this.events.length} preference events`);
    } catch {
      // Directory doesn't exist yet
    }
  }

  private async persist(record: PreferenceRecord): Promise<void> {
    const timestamp = new Date(record.capturedAt).toISOString().replace(/[:.]/g, '-');
    const filePath = join(this.prefDir, `${record.action}-${timestamp}.json`);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  }
}
