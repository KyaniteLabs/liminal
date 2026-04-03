/**
 * SeedBank — persistent storage for promoted creative seeds.
 * All Liminal functions draw from this seed bank.
 * Now with semantic search using embeddings.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CompostConfig, Seed } from './types.js';
import { safeJsonParse, SeedSchema } from '../security/JsonSchemas.js';
import { Logger } from '../utils/Logger.js';
import {
  EmbeddingService,
  type EmbeddingResult,
} from '../embeddings/EmbeddingService.js';
import { cosineSimilarity } from '../utils/vectors.js';

/** Seed with embedded vector for semantic search */
export interface EmbeddedSeed extends Seed {
  /** Optional embedding vector for semantic search */
  embedding?: number[];
  /** Model used to generate the embedding */
  embeddingModel?: string;
  /** When the embedding was generated */
  embeddedAt?: string;
}

export class SeedBank {
  private seedDir: string;
  private retentionDays: number;
  private seedsPath: string;
  private latestDir: string;
  private seeds: EmbeddedSeed[] = [];
  private loaded = false;
  private embeddingService: EmbeddingService | null = null;
  private embeddingEnabled = false;

  constructor(
    config: CompostConfig,
    embeddingService?: EmbeddingService
  ) {
    this.seedDir = config.seedDir;
    this.retentionDays = config.nuggetRetentionDays;
    this.seedsPath = path.join(this.seedDir, 'seeds.json');
    this.latestDir = path.join(this.seedDir, 'latest');

    if (embeddingService) {
      this.embeddingService = embeddingService;
      this.embeddingEnabled = true;
    }
  }

  /** Enable embedding support with an embedding service. */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
    this.embeddingEnabled = true;
  }

  /** Check if embedding support is enabled. */
  isEmbeddingEnabled(): boolean {
    return this.embeddingEnabled && this.embeddingService !== null;
  }

  /** Ensure directories exist and load seeds from disk. */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    await fs.mkdir(this.latestDir, { recursive: true });

    try {
      const raw = await fs.readFile(this.seedsPath, 'utf-8');
      this.seeds =
        safeJsonParse(raw, SeedSchema.array(), 'SeedBank') ?? [];
    } catch (err) {
      Logger.warn(
        'SeedBank',
        'failed to load seeds, starting empty:',
        err
      );
      this.seeds = [];
    }
  }

  /** Persist seeds to disk. */
  private async save(): Promise<void> {
    try {
      await fs.mkdir(this.seedDir, { recursive: true });
      await fs.writeFile(
        this.seedsPath,
        JSON.stringify(this.seeds, null, 2),
        'utf-8'
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save seeds: ${message}`);
    }
  }

  /** Add a seed to the bank. */
  async add(seed: EmbeddedSeed): Promise<void> {
    await this.ensureLoaded();

    // Generate embedding if service is available
    if (this.embeddingEnabled && this.embeddingService) {
      try {
        const embedding = await this.embed(seed.content);
        // eslint-disable-next-line require-atomic-updates
        seed.embedding = embedding.vector;
        // eslint-disable-next-line require-atomic-updates
        seed.embeddingModel = embedding.model;
        // eslint-disable-next-line require-atomic-updates
        seed.embeddedAt = new Date().toISOString();
      } catch (error) {
        Logger.warn(
          'SeedBank',
          'Failed to generate embedding for seed:',
          error
        );
      }
    }

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
  async getAll(): Promise<EmbeddedSeed[]> {
    await this.ensureLoaded();
    return [...this.seeds].sort((a, b) => b.score - a.score);
  }

  /** Get top N seeds by score. */
  async getTop(n: number): Promise<EmbeddedSeed[]> {
    const all = await this.getAll();
    return all.slice(0, n);
  }

  /** Get seeds filtered by source domain. */
  async getByDomain(domain: string): Promise<EmbeddedSeed[]> {
    await this.ensureLoaded();
    return this.seeds.filter((s) => s.source.domains.includes(domain));
  }

  /** Mark a seed as used by a function. */
  async markUsed(
    seedId: string,
    functionName: string
  ): Promise<void> {
    await this.ensureLoaded();
    const seed = this.seeds.find((s) => s.id === seedId);
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
    this.seeds = this.seeds.filter(
      (s) => s.useCount > 0 || new Date(s.promotedAt) >= cutoff
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
  async getRandomSeed(): Promise<EmbeddedSeed | undefined> {
    await this.ensureLoaded();
    if (this.seeds.length === 0) return undefined;
    const idx = Math.floor(Math.random() * this.seeds.length);
    return this.seeds[idx];
  }

  /**
   * Generate embedding for text using the configured embedding service.
   * @param text - Text to embed
   * @returns Embedding result
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.embeddingService) {
      throw new Error(
        'Embedding service not configured. ' +
          'Call setEmbeddingService() first.'
      );
    }
    return this.embeddingService.embed(text);
  }

  /**
   * Retrieve seeds relevant to a prompt using semantic similarity.
   * Uses cosine similarity between embeddings when available,
   * falls back to keyword matching otherwise.
   * @param prompt - The prompt to match against
   * @param topK - Number of seeds to return
   * @returns Array of seeds sorted by relevance
   */
  async retrieveRelevantSeeds(
    prompt: string,
    topK: number
  ): Promise<EmbeddedSeed[]> {
    await this.ensureLoaded();
    if (this.seeds.length === 0) return [];

    // Use semantic search if embeddings are available
    if (this.embeddingEnabled && this.embeddingService) {
      return this.retrieveSemanticSeeds(prompt, topK);
    }

    // Fall back to keyword matching
    return this.retrieveKeywordSeeds(prompt, topK);
  }

  /**
   * Semantic seed retrieval using embeddings and cosine similarity.
   * @param prompt - The prompt to match against
   * @param topK - Number of seeds to return
   * @returns Array of seeds sorted by semantic similarity
   */
  private async retrieveSemanticSeeds(
    prompt: string,
    topK: number
  ): Promise<EmbeddedSeed[]> {
    if (!this.embeddingService) {
      throw new Error('Embedding service not available');
    }

    // Generate embedding for the prompt
    const promptEmbedding = await this.embed(prompt);

    // Calculate similarity scores for seeds with embeddings
    const scored = this.seeds.map((seed) => {
      if (seed.embedding && seed.embedding.length > 0) {
        // Use cosine similarity
        const similarity = cosineSimilarity(
          promptEmbedding.vector,
          seed.embedding
        );
        return { seed, score: similarity };
      } else {
        // Fall back to keyword matching for seeds without embeddings
        const keywordScore = this.calculateKeywordScore(
          prompt,
          seed.content
        );
        return { seed, score: keywordScore * 0.5 }; // Weight down keyword matches
      }
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.seed);
  }

  /**
   * Keyword-based seed retrieval (fallback method).
   * @param prompt - The prompt to match against
   * @param topK - Number of seeds to return
   * @returns Array of seeds sorted by keyword overlap
   */
  private async retrieveKeywordSeeds(
    prompt: string,
    topK: number
  ): Promise<EmbeddedSeed[]> {
    const promptWords = this.extractKeywords(prompt);
    if (promptWords.length === 0) {
      return this.getTop(topK);
    }

    const scored = this.seeds.map((seed) => {
      const score = this.calculateKeywordScore(prompt, seed.content);
      return { seed, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.seed);
  }

  /**
   * Calculate keyword-based relevance score.
   * @param prompt - The prompt text
   * @param content - The seed content
   * @returns Relevance score between 0 and 1
   */
  private calculateKeywordScore(
    prompt: string,
    content: string
  ): number {
    const promptWords = this.extractKeywords(prompt);
    const seedWords = this.extractKeywords(content);

    if (promptWords.length === 0 || seedWords.length === 0) {
      return 0;
    }

    // Calculate word overlap
    let overlap = 0;
    for (const word of promptWords) {
      if (seedWords.includes(word)) overlap++;
    }

    return overlap / Math.max(promptWords.length, seedWords.length);
  }

  /** Extract meaningful keywords from text (lowercase, filtered) */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'dare',
      'ought',
      'used',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'and',
      'but',
      'if',
      'or',
      'because',
      'until',
      'while',
      'this',
      'that',
      'these',
      'those',
      'i',
      'me',
      'my',
      'myself',
      'we',
      'our',
      'ours',
      'ourselves',
      'you',
      'your',
      'yours',
      'yourself',
      'yourselves',
      'he',
      'him',
      'his',
      'himself',
      'she',
      'her',
      'hers',
      'herself',
      'it',
      'its',
      'itself',
      'they',
      'them',
      'their',
      'theirs',
      'themselves',
      'what',
      'which',
      'who',
      'whom',
      'create',
      'make',
      'generate',
      'build',
      'using',
      'use',
      'using',
      'based',
      'following',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Update embeddings for all seeds without embeddings.
   * Useful for batch updating after enabling embedding support.
   * @returns Number of seeds updated
   */
  async updateMissingEmbeddings(): Promise<number> {
    if (!this.embeddingEnabled || !this.embeddingService) {
      throw new Error('Embedding service not configured');
    }

    await this.ensureLoaded();

    let updatedCount = 0;
    for (const seed of this.seeds) {
      if (!seed.embedding || seed.embedding.length === 0) {
        try {
          const embedding = await this.embed(seed.content);
          seed.embedding = embedding.vector;
          seed.embeddingModel = embedding.model;
          seed.embeddedAt = new Date().toISOString();
          updatedCount++;
        } catch (error) {
          Logger.warn(
            'SeedBank',
            `Failed to embed seed ${seed.id}:`,
            error
          );
        }
      }
    }

    if (updatedCount > 0) {
      await this.save();
    }

    return updatedCount;
  }

  /**
   * Get seeds sorted by semantic similarity to a query embedding.
   * @param queryEmbedding - Query embedding vector
   * @param topK - Number of seeds to return
   * @returns Seeds sorted by similarity
   */
  async findSimilarByEmbedding(
    queryEmbedding: number[],
    topK: number
  ): Promise<EmbeddedSeed[]> {
    await this.ensureLoaded();

    const scored = this.seeds
      .filter((s) => s.embedding && s.embedding.length > 0)
      .map((seed) => ({
        seed,
        similarity: cosineSimilarity(queryEmbedding, seed.embedding!),
      }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((s) => s.seed);
  }
}
