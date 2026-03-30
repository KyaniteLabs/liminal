/**
 * SeedBank — persistent storage for promoted creative seeds.
 * All Liminal functions draw from this seed bank.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CompostConfig, Seed } from './types.js';
import { safeJsonParse, SeedSchema } from '../security/JsonSchemas.js';

export class SeedBank {
  private seedDir: string;
  private retentionDays: number;
  private seedsPath: string;
  private latestDir: string;
  private seeds: Seed[] = [];
  private loaded = false;

  constructor(config: CompostConfig) {
    this.seedDir = config.seedDir;
    this.retentionDays = config.nuggetRetentionDays;
    this.seedsPath = path.join(this.seedDir, 'seeds.json');
    this.latestDir = path.join(this.seedDir, 'latest');
  }

  /** Ensure directories exist and load seeds from disk. */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    await fs.mkdir(this.latestDir, { recursive: true });

    try {
      const raw = await fs.readFile(this.seedsPath, 'utf-8');
      this.seeds = safeJsonParse(raw, SeedSchema.array(), 'SeedBank') ?? [];
    } catch (err) {
      console.warn('[SeedBank] failed to load seeds, starting empty:', err);
      this.seeds = [];
    }
  }

  /** Persist seeds to disk. */
  private async save(): Promise<void> {
    await fs.mkdir(this.seedDir, { recursive: true });
    await fs.writeFile(this.seedsPath, JSON.stringify(this.seeds, null, 2), 'utf-8');
  }

  /** Add a seed to the bank. */
  async add(seed: Seed): Promise<void> {
    await this.ensureLoaded();
    this.seeds.push(seed);

    // Save markdown file to latest/
    const safeName = seed.id.replace(/[^a-zA-Z0-9-_]/g, '_');
    const mdContent = `# ${seed.id}\n\n**Score:** ${seed.score}\n\n${seed.content}\n\n---\n\nSources: ${seed.source.domains.join(', ')}\nCollision: ${seed.source.collisionType}\nPromoted: ${seed.promotedAt}\n`;
    await fs.writeFile(
      path.join(this.latestDir, `${safeName}.md`),
      mdContent,
      'utf-8'
    );

    await this.save();
  }

  /** Get all seeds sorted by score descending. */
  async getAll(): Promise<Seed[]> {
    await this.ensureLoaded();
    return [...this.seeds].sort((a, b) => b.score - a.score);
  }

  /** Get top N seeds by score. */
  async getTop(n: number): Promise<Seed[]> {
    const all = await this.getAll();
    return all.slice(0, n);
  }

  /** Get seeds filtered by source domain. */
  async getByDomain(domain: string): Promise<Seed[]> {
    await this.ensureLoaded();
    return this.seeds.filter(s => s.source.domains.includes(domain));
  }

  /** Mark a seed as used by a function. */
  async markUsed(seedId: string, functionName: string): Promise<void> {
    await this.ensureLoaded();
    const seed = this.seeds.find(s => s.id === seedId);
    if (!seed) return;
    seed.useCount++;
    if (!seed.usedBy.includes(functionName)) {
      seed.usedBy.push(functionName);
    }
    await this.save();
  }

  /** Remove seeds older than retentionDays that have never been used. */
  async pruneOld(retentionDays?: number): Promise<void> {
    await this.ensureLoaded();
    const days = retentionDays ?? this.retentionDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const before = this.seeds.length;
    this.seeds = this.seeds.filter(s =>
      s.useCount > 0 || new Date(s.promotedAt) >= cutoff
    );

    if (this.seeds.length !== before) {
      await this.save();
    }
  }

  /** Return total seed count. */
  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.seeds.length;
  }

  /** Get a random full Seed object (with lir if available). */
  async getRandomSeed(): Promise<Seed | undefined> {
    await this.ensureLoaded();
    if (this.seeds.length === 0) return undefined;
    const idx = Math.floor(Math.random() * this.seeds.length);
    return this.seeds[idx];
  }

  /**
   * Get a random seed's content for swarm/prompt use.
   * @deprecated Use getRandomSeed() + formatSeedForPrompt() for LIR-aware formatting.
   */
  async getRandomContent(): Promise<string | undefined> {
    await this.ensureLoaded();
    if (this.seeds.length === 0) return undefined;
    const idx = Math.floor(Math.random() * this.seeds.length);
    return this.seeds[idx].content;
  }
}
