/**
 * CompostMill — main orchestrator for the compost digestion pipeline.
 * Wires together: CompostHeap → Extractors → CompostShredder → CollisionEngine → FragmentScorer → SeedBank → DigestGenerator
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CompostConfig, CompostFragment, DigestResult, DigestStats, ExtractionResult, MillStatus } from './types.js';
import { mergeConfig } from './defaults.js';
import { CompostHeap } from './CompostHeap.js';
import { MetadataExtractor } from './MetadataExtractor.js';
import { RawByteProcessor } from './RawByteProcessor.js';
import { SemanticExtractor } from './SemanticExtractor.js';
import { CompostShredder } from './CompostShredder.js';
import { CollisionEngine } from './CollisionEngine.js';
import { FragmentScorer } from './FragmentScorer.js';
import { SeedBank } from './SeedBank.js';
import { DigestGenerator } from './DigestGenerator.js';
import { CompostSoup } from './CompostSoup.js';
import type { Seed } from './types.js';
import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import type { ProjectDNA } from '../scavenger/types.js';

export class CompostMill {
  private config: CompostConfig;
  private heap: CompostHeap;
  private semanticExtractor: SemanticExtractor;
  private collisionEngine: CollisionEngine;
  private fragmentScorer: FragmentScorer;
  private seedBank: SeedBank;
  private digestGenerator: DigestGenerator;
  private soup: CompostSoup | null = null;

  constructor(
    overrides?: Partial<CompostConfig> & { soupStatePath?: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    llm?: any,
  ) {
    const config = mergeConfig(overrides as Partial<CompostConfig>);
    this.config = config;

    this.heap = new CompostHeap(config);
    this.semanticExtractor = new SemanticExtractor(config, llm ?? { generate: async () => ({ success: true, code: '' }) });
    this.collisionEngine = new CollisionEngine(config, llm);
    this.fragmentScorer = new FragmentScorer(config, llm);
    this.seedBank = new SeedBank(config);
    this.digestGenerator = new DigestGenerator(config, llm);

    if (config.soupEnabled) {
      this.soup = new CompostSoup(config, llm);
    }
  }

  /** Add files or directories to the heap. */
  async add(inputPaths: string[]): Promise<void> {
    for (const inputPath of inputPaths) {
      const stat = await fs.stat(inputPath).catch(() => null);
      if (!stat) continue;

      if (stat.isDirectory()) {
        await this.heap.addDirectory(inputPath);
      } else {
        await this.heap.addFile(inputPath);
      }
    }
  }

  /** Run the full digestion pipeline. */
  async digest(): Promise<DigestResult> {
    const startTime = Date.now();

    // Get all heap files
    const heapFiles = await this.heap.listFiles();
    if (heapFiles.length === 0) {
      const emptyStats: DigestStats = {
        filesProcessed: 0,
        totalBytes: 0,
        domains: [],
        fragmentCount: 0,
        collisionCount: 0,
        seedsPromoted: 0,
        soupCycles: 0,
        durationMs: 0,
      };
      return { stats: emptyStats, seeds: [], digestPath: '' };
    }

    // Stage 2: Extract
    const fullPaths = heapFiles.map(f => path.join(this.config.heapDir, f));
    const extractionResults = await this.extractAll(fullPaths);

    // Stage 3: Shred
    const allFragments = CompostShredder.shredAll(extractionResults);

    // Stage 4: Mix (Collisions)
    const collisionResults = await this.collisionEngine.runAll(allFragments);

    // Stage 5: Mine (Score + Promote)
    const promotedSeeds: Seed[] = [];
    for (const frag of allFragments) {
      const score = await this.fragmentScorer.score(frag);
      frag.score = score.total;

      if (await this.fragmentScorer.shouldPromote(frag)) {
        promotedSeeds.push({
          id: frag.id,
          content: frag.content,
          score: score.total,
          source: {
            fragments: [frag.id],
            collisionType: 'heuristic',
            domains: [frag.domain],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        });
      }
    }

    // Promote collision results too
    for (const collision of collisionResults) {
      promotedSeeds.push({
        id: `collision-${collision.fragmentA.id}-${collision.fragmentB.id}`,
        content: collision.mergedContent,
        score: 7, // Default score for collision results
        source: {
          fragments: [collision.fragmentA.id, collision.fragmentB.id],
          collisionType: collision.strategy,
          domains: [collision.fragmentA.domain, collision.fragmentB.domain],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
      });
    }

    // Save promoted seeds
    for (const seed of promotedSeeds) {
      await this.seedBank.add(seed);
    }

    // Feed seed domains into GeneratorRegistry as DNA for improved routing
    for (const seed of promotedSeeds) {
      if (seed.source.domains.length > 0 && !generatorRegistry.getDNA(seed.source.domains[0])) {
        const dna: ProjectDNA = {
          name: `compost-seed-${seed.id}`,
          domain: seed.source.domains[0],
          coreLogic: seed.content.slice(0, 500),
          constraints: [],
          patterns: seed.source.domains,
          prompts: [seed.content.slice(0, 200)],
          extractedAt: seed.promotedAt,
          sourcePath: 'compost',
        };
        generatorRegistry.registerDNA(dna);
      }
    }

    // Collect stats
    const domains = [...new Set(allFragments.map(f => f.domain))];
    const stats: DigestStats = {
      filesProcessed: fullPaths.length,
      totalBytes: extractionResults.reduce((sum, r) => sum + r.rawBytes.size, 0),
      domains,
      fragmentCount: allFragments.length,
      collisionCount: collisionResults.length,
      seedsPromoted: promotedSeeds.length,
      soupCycles: 0,
      durationMs: Date.now() - startTime,
    };

    // Stage 6: Digest
    const soupHighlights = collisionResults
      .slice(0, 5)
      .map(c => `[${c.strategy}] ${c.fragmentA.domain} + ${c.fragmentB.domain}: ${c.mergedContent.slice(0, 80)}...`);

    const digestPath = await this.digestGenerator.save(stats, promotedSeeds, soupHighlights);

    // Stage 7: Prune (clear heap)
    await this.heap.purge();
    await this.seedBank.pruneOld();

    return { stats, seeds: promotedSeeds, digestPath };
  }

  /** Extract all files through the three layers. */
  private async extractAll(filePaths: string[]): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    const settled = await Promise.allSettled(
      filePaths.map(async (filePath) => {
        const metadata = await MetadataExtractor.extract(filePath);
        const rawBytes = await RawByteProcessor.process(filePath);
        const semantic = await this.semanticExtractor.extract(filePath);
        return { filePath, semantic, metadata, rawBytes };
      })
    );

    for (const entry of settled) {
      if (entry.status === 'fulfilled') {
        results.push(entry.value);
      }
    }
    return results;
  }

  /** Start the soup loop, feeding it seeds from the seed bank as fragments. */
  async startSoup(): Promise<void> {
    if (!this.soup) {
      this.soup = new CompostSoup(this.config);
    }
    // Load seeds from the seed bank and convert to fragments for the soup
    const seeds = await this.seedBank.getAll();
    const fragments: CompostFragment[] = seeds.map(seed => ({
      id: seed.id,
      source: `seed:${seed.id}`,
      domain: seed.source.domains[0] ?? 'unknown',
      layer: 'semantic' as const,
      content: seed.content,
      score: seed.score,
      metadata: {
        fileType: 'seed',
        timestamp: seed.promotedAt,
        hash: '',
        size: seed.content.length,
        extractedAt: seed.promotedAt,
      },
      tags: [...seed.source.domains, 'seed'],
    }));
    this.soup.run(fragments);
  }

  /** Stop the soup loop. */
  stopSoup(): void {
    this.soup?.stop();
  }

  /** Get current heap file paths. */
  async getHeapFiles(): Promise<string[]> {
    return this.heap.listFiles();
  }

  /** List all seeds sorted by score. */
  async listSeeds(): Promise<Seed[]> {
    return this.seedBank.getAll();
  }

  /** Get top N seeds by score. */
  async getTopSeeds(n: number): Promise<Seed[]> {
    return this.seedBank.getTop(n);
  }

  /** Get seed count. */
  async getSeedCount(): Promise<number> {
    return this.seedBank.count();
  }

  /** Get current mill status. */
  async statusAsync(): Promise<MillStatus> {
    const [heapSize, heapFiles, seedCount] = await Promise.all([
      this.heap.getHeapSize(),
      this.heap.listFiles().then(f => f.length),
      this.seedBank.count(),
    ]);
    return {
      heapSize,
      heapFileCount: heapFiles,
      seedCount,
      soupRunning: this.soup?.isRunning() ?? false,
      soupGeneration: 0,
      lastDigestAt: null,
    };
  }

  /** Check if auto-digestion should trigger. */
  async shouldAutoDigest(): Promise<boolean> {
    return this.heap.isOverCapacity();
  }
}
