/**
 * LineageTracker — Phase 13E
 *
 * Tracks parent refs, seed/params, remix lineage, and provenance for every
 * creative run. Persists through LiminalFS for replay and branching.
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { randomUUID } from 'node:crypto';
import { Logger } from '../utils/Logger.js';
import type { LineageRecord, Provenance } from './types.js';

export interface LineageTrackerConfig {
  /** Directory for lineage records (default: ~/.liminal/lineage/) */
  lineageDir?: string;
}

const DEFAULT_LINEAGE_DIR = `${process.env.HOME}/.liminal/lineage`;

export class LineageTracker {
  private readonly lineageDir: string;
  private cache: Map<string, LineageRecord> = new Map();
  private loaded = false;

  constructor(config: LineageTrackerConfig = {}) {
    this.lineageDir = config.lineageDir ?? DEFAULT_LINEAGE_DIR;
  }

  /**
   * Record a new lineage entry for an artifact.
   * Called by creative runs after generation/remix/branch/dream.
   */
  async record(params: {
    artifactId?: string;
    parentIds?: string[];
    provenance: Provenance;
    seed?: string;
    runParams?: Record<string, unknown>;
    runId?: string;
  }): Promise<LineageRecord> {
    await this.ensureLoaded();

    const record: LineageRecord = {
      artifactId: params.artifactId ?? randomUUID(),
      parentIds: params.parentIds ?? [],
      provenance: params.provenance,
      seed: params.seed,
      params: params.runParams,
      runId: params.runId,
      createdAt: new Date().toISOString(),
    };

    this.cache.set(record.artifactId, record);
    await this.persist(record);

    Logger.info('LineageTracker', `Recorded ${record.provenance} for ${record.artifactId} (parents: ${record.parentIds.length})`);
    return record;
  }

  /**
   * Get the lineage record for an artifact.
   */
  async get(artifactId: string): Promise<LineageRecord | undefined> {
    await this.ensureLoaded();
    return this.cache.get(artifactId);
  }

  /**
   * Get the full ancestry chain for an artifact (breadth-first traversal).
   */
  async getAncestry(artifactId: string, maxDepth = 10): Promise<LineageRecord[]> {
    await this.ensureLoaded();

    const ancestry: LineageRecord[] = [];
    const visited = new Set<string>();
    const queue: string[] = [artifactId];
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const batchSize = queue.length;
      for (let i = 0; i < batchSize; i++) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        const record = this.cache.get(id);
        if (!record) continue;

        ancestry.push(record);
        for (const parentId of record.parentIds) {
          if (!visited.has(parentId)) {
            queue.push(parentId);
          }
        }
      }
      depth++;
    }

    return ancestry;
  }

  /**
   * Get all descendants of an artifact (reverse lookup).
   */
  async getDescendants(artifactId: string): Promise<LineageRecord[]> {
    await this.ensureLoaded();

    const descendants: LineageRecord[] = [];
    for (const record of this.cache.values()) {
      if (record.parentIds.includes(artifactId)) {
        descendants.push(record);
        // Recurse into children
        const childDescendants = await this.getDescendants(record.artifactId);
        descendants.push(...childDescendants);
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return descendants.filter(d => {
      if (seen.has(d.artifactId)) return false;
      seen.add(d.artifactId);
      return true;
    });
  }

  /**
   * Get the depth of an artifact in the lineage tree (0 = root/fresh).
   */
  async getDepth(artifactId: string): Promise<number> {
    const ancestry = await this.getAncestry(artifactId);
    // Exclude the artifact itself from the count
    return Math.max(0, ancestry.length - 1);
  }

  /**
   * Export all lineage records for a session or run.
   */
  async exportForRun(runId: string): Promise<LineageRecord[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.values()).filter(r => r.runId === runId);
  }

  /**
   * Get statistics about the lineage graph.
   */
  async getStats(): Promise<{
    totalRecords: number;
    byProvenance: Record<Provenance, number>;
    maxDepth: number;
    avgParents: number;
    rootCount: number;
  }> {
    await this.ensureLoaded();

    const records = Array.from(this.cache.values());
    const byProvenance: Record<Provenance, number> = {
      'fresh-generation': 0,
      'remix': 0,
      'compost-promotion': 0,
      'dream-recombination': 0,
      'branch': 0,
      'mutation': 0,
      'perturbation-probe': 0,
    };

    let totalParents = 0;
    let rootCount = 0;

    for (const r of records) {
      byProvenance[r.provenance] = (byProvenance[r.provenance] ?? 0) + 1;
      totalParents += r.parentIds.length;
      if (r.parentIds.length === 0) rootCount++;
    }

    return {
      totalRecords: records.length,
      byProvenance,
      maxDepth: records.length > 0 ? Math.max(...await Promise.all(records.map(r => this.getDepth(r.artifactId)))) : 0,
      avgParents: records.length > 0 ? totalParents / records.length : 0,
      rootCount,
    };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const files = await fs.readdir(this.lineageDir).catch(() => [] as string[]);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(join(this.lineageDir, file), 'utf-8');
          const record: LineageRecord = JSON.parse(data);
          this.cache.set(record.artifactId, record);
        } catch {
          // Skip corrupted files
        }
      }
      Logger.info('LineageTracker', `Loaded ${this.cache.size} lineage records`);
    } catch {
      // Directory doesn't exist yet — will be created on first persist
    }
  }

  private async persist(record: LineageRecord): Promise<void> {
    const filePath = join(this.lineageDir, `${record.artifactId}.json`);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  }
}
