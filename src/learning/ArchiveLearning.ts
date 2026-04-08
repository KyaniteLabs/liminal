/**
 * ArchiveLearning - Persistent quality archive with few-shot prompting.
 *
 * Stores high-quality past outputs organized by domain and retrieves
 * relevant examples as few-shot context for new prompts.
 */

import { QualityArchive } from './QualityArchive.js';
import { createHash } from 'crypto';
import { Logger } from '../utils/Logger.js';
import type { CreativeFragment } from '../core/types.js';
import type { MinedFragment } from '../swarm/types.js';

/**
 * Configuration for ArchiveLearning.
 */
export interface ArchiveConfig {
  /** Minimum quality threshold (0-1) for storing outputs */
  minQuality?: number;
  /** Maximum number of examples to keep per domain */
  maxExamplesPerDomain?: number;
  /** Path to archive JSON file */
  archivePath?: string;
  /** Whether to use few-shot examples in generation */
  useExamples?: boolean;
  /** Number of examples to include per generation */
  examplesPerGeneration?: number;
}

/**
 * A high-quality archived output with metadata.
 */
export interface ArchivedItem {
  /** Unique identifier */
  id: string;
  /** Domain (e.g., 'p5', 'glsl', 'three', 'music') */
  domain: string;
  /** Original prompt that generated this output */
  prompt: string;
  /** The generated output (code, art, etc.) */
  output: string;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** ISO 8601 timestamp when created */
  createdAt: string;
  /** Number of times this example has been used */
  usedCount?: number;
  /** User rating if provided */
  userRating?: number;
  /** Optional mined fragment metadata from swarm sessions */
  fragment?: MinedFragment;
}

/**
 * ArchiveLearning provides recursive self-improvement through:
 * - Storing top-quality outputs per domain
 * - Providing examples for few-shot prompting
 * - Tracking usage and effectiveness
 * - Cross-session learning
 */
export class ArchiveLearning {
  private archive: QualityArchive;
  private config: Required<ArchiveConfig>;

  /** Default minimum quality threshold for archiving */
  static readonly DEFAULT_MIN_QUALITY = 0.65;

  /** Default max examples per domain */
  static readonly DEFAULT_MAX_EXAMPLES = 20;

  /**
   * Create a new ArchiveLearning instance.
   * @param config - Optional configuration
   */
  constructor(config: ArchiveConfig = {}) {
    this.config = {
      minQuality: config.minQuality ?? ArchiveLearning.DEFAULT_MIN_QUALITY,
      maxExamplesPerDomain: config.maxExamplesPerDomain ?? ArchiveLearning.DEFAULT_MAX_EXAMPLES,
      archivePath: config.archivePath ?? `${process.env.HOME}/.liminal/archive/quality_archive.json`,
      useExamples: config.useExamples ?? true,
      examplesPerGeneration: config.examplesPerGeneration ?? 3,
    };

    this.archive = new QualityArchive({
      path: this.config.archivePath,
      minQuality: this.config.minQuality,
      maxExamplesPerDomain: this.config.maxExamplesPerDomain,
    });
  }

  /**
   * Add an output to the archive if quality meets threshold.
   * @param prompt - The original prompt
   * @param output - The generated output
   * @param domain - Domain identifier
   * @param qualityScore - Quality score (0-1)
   * @param metadata - Optional additional metadata
   * @returns ArchivedItem if added, null if quality too low
   */
  addOutput(
    prompt: string,
    output: string,
    domain: string,
    qualityScore: number,
    metadata?: Record<string, unknown>
  ) {
    if (qualityScore < this.config.minQuality) {
      return null;
    }

    // Generate unique ID from domain + output hash
    const hash = createHash('md5').update(output).digest('hex').substring(0, 8);
    const id = `${domain.substring(0, 3)}_${hash}`;

    const item: ArchivedItem = {
      id,
      domain,
      prompt,
      output,
      qualityScore,
      metadata: metadata ?? {},
      createdAt: new Date().toISOString(),
      usedCount: 0,
    };

    this.archive.add(item).catch((err: unknown) => {
      Logger.warn('ArchiveLearning', `Failed to add item to archive: ${err instanceof Error ? err.message : String(err)}`);
    });
    return item;
  }

  /**
   * Get best examples for few-shot prompting.
   * @param domain - Domain to get examples for
   * @param n - Number of examples to return (default: config.examplesPerGeneration)
   * @param minScore - Minimum quality score (default: 0)
   * @returns Array of archived items
   */
  getExamples(domain: string, n?: number, minScore?: number): ArchivedItem[] {
    return this.archive.query(domain, {
      limit: n ?? this.config.examplesPerGeneration,
      minQuality: minScore ?? 0,
    });
  }

  /**
   * Generate a few-shot prompt with best examples.
   * @param domain - Domain for examples
   * @param n - Number of examples (default: config.examplesPerGeneration)
   * @returns Formatted few-shot prompt string
   */
  getFewshotPrompt(domain: string, n?: number): string {
    const examples = this.getExamples(domain, n);

    if (examples.length === 0) {
      return '';
    }

    const parts: string[] = [];
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      parts.push(
        `Example ${i + 1} (Quality: ${example.qualityScore.toFixed(2)}):\n` +
        `Prompt: ${example.prompt}\n` +
        `Output:\n${example.output}\n`
      );

      // Track usage
      this.archive.recordUsage(example.id).catch((err: unknown) => {
        Logger.warn('ArchiveLearning', `Failed to record usage: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Build an enhanced prompt with semantically matched few-shot examples.
   * Matches current prompt against archived prompts using keyword overlap,
   * injecting only the most relevant examples.
   * @param prompt - The original prompt
   * @param domain - Domain identifier
   * @returns Enhanced prompt with examples prepended
   */
  buildEnhancedPrompt(prompt: string, domain: string): string {
    if (!this.config.useExamples) {
      return prompt;
    }

    const examples = this.getExamples(domain);
    if (examples.length === 0) {
      return prompt;
    }

    // Score each example by keyword overlap with the current prompt
    const promptWords = new Set(prompt.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const scored = examples.map(ex => {
      const exWords = new Set((ex.prompt ?? '').toLowerCase().split(/\W+/).filter(w => w.length > 2));
      let overlap = 0;
      for (const w of promptWords) {
        if (exWords.has(w)) overlap++;
      }
      const score = promptWords.size > 0 ? overlap / promptWords.size : 0;
      return { example: ex, score };
    });

    // Sort by relevance (highest overlap first)
    scored.sort((a, b) => b.score - a.score);

    // Take top N examples, budget to 2000 chars total
    const maxChars = 2000;
    const n = this.config.examplesPerGeneration;
    const selected = scored.slice(0, n);
    const parts: string[] = [];
    let charBudget = maxChars;

    for (let i = 0; i < selected.length; i++) {
      const ex = selected[i].example;
      // Truncate output to key snippet (setup + draw functions, or first 50 lines)
      const lines = ex.output.split('\n');
      const truncated = lines.slice(0, 50).join('\n');
      const snippet = truncated.length > 500 ? truncated.slice(0, 500) + '\n...' : truncated;
      const entry = `Example ${i + 1} (Quality: ${ex.qualityScore.toFixed(2)}, Relevance: ${selected[i].score.toFixed(2)}):\n` +
        `Prompt: ${ex.prompt}\nOutput:\n${snippet}\n`;
      if (entry.length > charBudget) break;
      parts.push(entry);
      charBudget -= entry.length;
      this.archive.recordUsage(ex.id).catch((err: unknown) => {
        Logger.warn('ArchiveLearning', `Failed to record usage: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    if (parts.length === 0) return prompt;
    return `${parts.join('\n')}Now, create your own:\n\n${prompt}`;
  }

  /**
   * Get archive statistics.
   * @returns Statistics object with total, byDomain, and avgQuality
   */
  getStats(): {
    totalOutputs: number;
    byDomain: Record<string, number>;
    avgQuality: Record<string, number>;
  } {
    return this.archive.getStats();
  }

  /**
   * Search archive by keywords in prompt or output.
   * @param query - Search query string
   * @param domain - Optional domain filter
   * @param limit - Max results (default: 10)
   * @returns Matching archived items
   */
  search(query: string, domain?: string, limit = 10): ArchivedItem[] {
    return this.archive.search(query, domain, limit);
  }

  /**
   * Record that an archived output was used.
   * @param itemId - ID of the archived item
   */
  recordUsage(itemId: string): void {
    this.archive.recordUsage(itemId).catch((err: unknown) => {
      Logger.warn('ArchiveLearning', `Failed to record usage: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * Add a user rating to an archived output.
   * @param itemId - ID of the archived item
   * @param rating - Rating value (typically 0-1 or 1-5)
   */
  addUserRating(itemId: string, rating: number): void {
    this.archive.addUserRating(itemId, rating).catch((err: unknown) => {
      Logger.warn('ArchiveLearning', `Failed to add user rating: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * Export data formatted for fine-tuning.
   * @param domain - Optional domain filter
   * @param minQuality - Minimum quality threshold (default: 0.75)
   * @returns Array of training examples
   */
  exportForFinetuning(domain?: string, minQuality = 0.75): Array<{
    prompt: string;
    completion: string;
    domain: string;
    qualityScore: number;
    metadata: Record<string, unknown>;
  }> {
    return this.archive.exportForFinetuning(domain, minQuality);
  }

  /**
   * Get the underlying archive instance for advanced operations.
   * @returns The QualityArchive instance
   */
  getArchive(): QualityArchive {
    return this.archive;
  }

  /**
   * Add a mined fragment to the archive.
   * @param fragment - The mined fragment from a swarm session
   * @param domain - Domain identifier
   * @returns ArchivedItem if added, null if quality too low
   */
  addFragment(fragment: MinedFragment, domain: string) {
    const qualityScore = Math.min(fragment.score / 15, 1); // Normalize score to 0-1
    return this.addOutput(
      fragment.sessionPrompt || fragment.text.slice(0, 100),
      fragment.text,
      domain,
      qualityScore,
      {
        fragmentId: fragment.id,
        source: fragment.source,
        persona: fragment.persona,
        round: fragment.round,
        tags: fragment.tags,
      }
    );
  }

  /**
   * Add a CreativeFragment (from any subsystem) to the archive.
   * @param fragment - The unified creative fragment
   * @param domain - Domain identifier (falls back to first domain in fragment.domains)
   * @returns ArchivedItem if added, null if quality too low
   */
  addCreativeFragment(fragment: CreativeFragment, domain?: string) {
    const effectiveDomain = domain ?? fragment.domains[0] ?? 'unknown';
    return this.addOutput(
      fragment.content.slice(0, 100),
      fragment.content,
      effectiveDomain,
      fragment.score,
      {
        fragmentId: fragment.id,
        origin: fragment.origin,
        source: fragment.source,
        tags: fragment.tags,
        domains: fragment.domains,
      }
    );
  }

  /**
   * Query archived fragments by persona, mode, or minimum score.
   * @param options - Query filters
   * @returns Matching archived items that have fragment metadata
   */
  queryFragments(options?: { persona?: string; mode?: string; minScore?: number; domain?: string }): ArchivedItem[] {
    // Search across all domains by using the search method with broad terms
    const domains = ['p5', 'glsl', 'three', 'music', 'swarm', 'generative-art'];
    const results: ArchivedItem[] = [];

    for (const domain of options?.domain ? [options.domain] : domains) {
      const entries = this.archive.query(domain, { limit: 100, minQuality: options?.minScore ?? 0 });
      for (const entry of entries) {
        const item = entry as unknown as ArchivedItem;
        if (!item.fragment) continue;
        if (options?.persona && item.fragment.persona !== options.persona) continue;
        if (options?.mode && item.fragment.mode !== options.mode) continue;
        results.push(item);
      }
    }

    return results;
  }
}
