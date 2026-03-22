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
import { Logger } from '../utils/Logger.js';
import { SeedBank } from './SeedBank.js';
import { DigestGenerator } from './DigestGenerator.js';
import { CompostSoup } from './CompostSoup.js';
import type { Seed } from './types.js';
import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import type { ProjectDNA } from '../scavenger/types.js';
import { RetryManager } from '../llm/RetryManager.js';
import { eventBus, EventTypes } from '../core/EventBus.js';
import type { LLMClientLike } from './SemanticExtractor.js';

export class CompostMill {
  private config: CompostConfig;
  private heap: CompostHeap;
  private semanticExtractor: SemanticExtractor;
  private collisionEngine: CollisionEngine;
  private fragmentScorer: FragmentScorer;
  private seedBank: SeedBank;
  private digestGenerator: DigestGenerator;
  private soup: CompostSoup | null = null;
  private llm: LLMClientLike;

  constructor(
    llm: LLMClientLike,
    overrides?: Partial<CompostConfig> & { soupStatePath?: string },
  ) {
    const config = mergeConfig(overrides as Partial<CompostConfig>);
    this.config = config;
    this.llm = llm;

    this.heap = new CompostHeap(config);
    this.semanticExtractor = new SemanticExtractor(config, llm);
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

    eventBus.emit(EventTypes.PROCESS_START, 'CompostMill', { process: 'compost-digest' });

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
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'extract', message: `Extracting ${fullPaths.length} files...` });
    Logger.info('CompostMill', `Extracting ${fullPaths.length} files...`);
    const extractionResults = await this.extractAll(fullPaths);
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'extract-done', message: `Extracted ${extractionResults.length}/${fullPaths.length} files` });
    Logger.info('CompostMill', `Extracted ${extractionResults.length}/${fullPaths.length} files`);

    // Stage 3: Shred
    const allFragments = CompostShredder.shredAll(extractionResults);
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'shred', message: `Shredded into ${allFragments.length} fragments` });
    Logger.info('CompostMill', `Shredded into ${allFragments.length} fragments`);

    // Stage 4: Mix (Collisions)
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'collide', message: 'Running collisions...' });
    Logger.info('CompostMill', 'Running collisions...');
    const collisionResults = await this.collisionEngine.runAll(allFragments);
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'collide-done', message: `${collisionResults.length} collisions merged` });
    Logger.info('CompostMill', `${collisionResults.length} collisions merged`);

    // Stage 5: Mine (Score + Promote) — parallel with concurrency limit
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'score', message: `Scoring ${allFragments.length} fragments...` });
    Logger.info('CompostMill', `Scoring ${allFragments.length} fragments...`);
    const promotedSeeds: Seed[] = [];
    const scored = await RetryManager.mapSettled(
      allFragments,
      async (frag) => {
        const score = await this.fragmentScorer.score(frag);
        frag.score = score.total;
        const promote = await this.fragmentScorer.shouldPromote(frag);
        return promote ? frag : null;
      },
      5,
    );
    for (const entry of scored) {
      if (entry.status === 'fulfilled' && entry.value) {
        const frag = entry.value as CompostFragment;
        promotedSeeds.push({
          id: frag.id,
          content: frag.content,
          score: frag.score ?? 0,
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
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'promote', message: `Promoted ${promotedSeeds.length} seeds from scoring` });
    Logger.info('CompostMill', `Promoted ${promotedSeeds.length} seeds from scoring`);

    // Promote collision results too (score them first)
    const collisionFragments: CompostFragment[] = collisionResults.map(collision => ({
      id: `collision-${collision.fragmentA.id}-${collision.fragmentB.id}`,
      source: `collision:${collision.fragmentA.id}+${collision.fragmentB.id}`,
      domain: 'cross-domain',
      layer: 'semantic' as const,
      content: collision.mergedContent,
      score: 0,
      metadata: {
        fileType: 'collision',
        timestamp: new Date().toISOString(),
        hash: '',
        size: collision.mergedContent.length,
        extractedAt: new Date().toISOString(),
      },
      tags: [collision.fragmentA.domain, collision.fragmentB.domain, `collision:${collision.strategy}`],
    }));

    const scoredCollisions = await RetryManager.mapSettled(
      collisionFragments,
      async (frag) => {
        const score = await this.fragmentScorer.score(frag);
        frag.score = score.total;
        const promote = await this.fragmentScorer.shouldPromote(frag);
        return promote ? frag : null;
      },
      5,
    );
    for (const entry of scoredCollisions) {
      if (entry.status === 'fulfilled' && entry.value) {
        const frag = entry.value as CompostFragment;
        const collision = collisionResults.find(
          c => `collision-${c.fragmentA.id}-${c.fragmentB.id}` === frag.id
        );
        promotedSeeds.push({
          id: frag.id,
          content: frag.content,
          score: frag.score ?? 0,
          source: {
            fragments: collision ? [collision.fragmentA.id, collision.fragmentB.id] : [],
            collisionType: collision?.strategy ?? 'unknown',
            domains: collision ? [collision.fragmentA.domain, collision.fragmentB.domain] : ['unknown'],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        });
      }
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

    eventBus.emit(EventTypes.PROCESS_END, 'CompostMill', { process: 'compost-digest', success: true, durationMs: Date.now() - startTime, filesProcessed: stats.filesProcessed, fragmentCount: stats.fragmentCount, seedsPromoted: stats.seedsPromoted });

    return { stats, seeds: promotedSeeds, digestPath };
  }

  /** Extract all files through the three layers, throttled to avoid rate limits. */
  private async extractAll(filePaths: string[]): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    const settled = await RetryManager.mapSettled(
      filePaths,
      async (filePath) => {
        const metadata = await MetadataExtractor.extract(filePath);
        const rawBytes = await RawByteProcessor.process(filePath);
        const semantic = await this.semanticExtractor.extract(filePath);
        return { filePath, semantic, metadata, rawBytes };
      },
      5, // max 5 concurrent extractions
    );

    for (const entry of settled) {
      if (entry.status === 'fulfilled') {
        results.push(entry.value as ExtractionResult);
      }
    }
    return results;
  }

  /** Start the soup loop, feeding it seeds from the seed bank as fragments. */
  async startSoup(): Promise<void> {
    if (!this.soup) {
      this.soup = new CompostSoup(this.config, this.llm);
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
