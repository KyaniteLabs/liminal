/**
 * FragmentScorer — multi-dimensional fragment scoring.
 * Combines heuristic scoring with optional LLM-assisted scoring.
 */

import type { CompostConfig, CompostFragment, FragmentScore } from './types.js';
import type { LLMClientLike } from './SemanticExtractor.js';
import { Logger } from '../utils/Logger.js';

/** Weights for each scoring dimension. */
const WEIGHTS = {
  novelty: 0.25,
  density: 0.20,
  crossDomain: 0.20,
  metadataRarity: 0.15,
  connectionStrength: 0.20,
};

export class FragmentScorer {
  private config: CompostConfig;
  private llm: LLMClientLike;

  constructor(config: CompostConfig, llm: LLMClientLike) {
    this.config = config;
    this.llm = llm;
  }

  /** Score a fragment using heuristic computation only (no LLM). */
  scoreHeuristic(fragment: CompostFragment): FragmentScore {
    const novelty = this.scoreNovelty(fragment);
    const density = this.scoreDensity(fragment);
    const crossDomain = this.scoreCrossDomain(fragment);
    const metadataRarity = this.scoreMetadataRarity(fragment);
    const connectionStrength = this.scoreConnectionStrength(fragment);

    const total = (
      WEIGHTS.novelty * novelty +
      WEIGHTS.density * density +
      WEIGHTS.crossDomain * crossDomain +
      WEIGHTS.metadataRarity * metadataRarity +
      WEIGHTS.connectionStrength * connectionStrength
    ) * 10; // Scale to 0-10

    return { total, novelty, density, crossDomain, metadataRarity, connectionStrength };
  }

  /** Score a fragment using LLM for semantic quality. */
  async scoreLLM(fragment: CompostFragment): Promise<number> {
    if (!this.llm) return 5; // neutral score if no LLM

    try {
      const result = await this.llm.generate(
        'You are a creative quality evaluator. Rate this fragment 0-10 based on novelty, creative potential, and cross-domain value. Respond with JSON: {"score": N}',
        `Domain: ${fragment.domain}\nLayer: ${fragment.layer}\nTags: ${fragment.tags.join(', ')}\n\nContent:\n${fragment.content.slice(0, 2000)}`
      );

      if (result.success) {
        const match = result.code.match(/"score"\s*:\s*(\d+\.?\d*)/);
        if (match) return Math.min(10, Math.max(0, parseFloat(match[1])));
      }
      return 5;
    } catch (err) {
      Logger.warn('FragmentScorer', 'LLM scoring failed, using neutral score:', err);
      return 5;
    }
  }

  /** Aggregate score combining heuristic and optional LLM. */
  async score(fragment: CompostFragment): Promise<FragmentScore> {
    const heuristic = this.scoreHeuristic(fragment);
    if (!this.llm) return heuristic;

    const llmScore = await this.scoreLLM(fragment);
    // Blend: 60% heuristic + 40% LLM
    heuristic.total = heuristic.total * 0.6 + llmScore * 0.4;
    return heuristic;
  }

  /** Check if a fragment should be promoted to seed bank. */
  async shouldPromote(fragment: CompostFragment): Promise<boolean> {
    const score = await this.score(fragment);
    return score.total >= this.config.seedPromotionThreshold * 10;
  }

  /** Novelty: unique words ratio. */
  private scoreNovelty(fragment: CompostFragment): number {
    const words = fragment.content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 0;
    const unique = new Set(words).size;
    return unique / words.length;
  }

  /** Density: ideas per character (word count / char count). */
  private scoreDensity(fragment: CompostFragment): number {
    if (fragment.content.length === 0) return 0;
    const words = fragment.content.split(/\s+/).filter(w => w.length > 0).length;
    return Math.min(1, words / (fragment.content.length / 5));
  }

  /** Cross-domain: count distinct source domains in tags, with partial credit for single-domain. */
  private scoreCrossDomain(fragment: CompostFragment): number {
    const domainTags = fragment.tags.filter(t => !['semantic', 'structured', 'raw'].includes(t));
    if (domainTags.length >= 2) return Math.min(1, domainTags.length / 5);
    // Single domain: give partial credit for rich tags or non-semantic layers
    if (domainTags.length === 1 && fragment.tags.length > 3) return 0.3;
    if (fragment.layer === 'structured' || fragment.layer === 'raw') return 0.2;
    return 0;
  }

  /** Metadata rarity: unusual metadata values score higher. */
  private scoreMetadataRarity(fragment: CompostFragment): number {
    const meta = fragment.metadata;
    let rarity = 0;
    if (meta.language) rarity += 0.3;
    if (meta.dimensions) rarity += 0.2;
    if (meta.gps) rarity += 0.3;
    if (meta.bpm) rarity += 0.2;
    if (meta.sampleRate) rarity += 0.2;
    if (meta.loc && meta.loc > 100) rarity += 0.3;
    return Math.min(1, rarity);
  }

  /** Connection strength: cross-domain links score higher; partial credit for rich non-standard tags. */
  private scoreConnectionStrength(fragment: CompostFragment): number {
    const nonStandardTags = fragment.tags.filter(t =>
      !['semantic', 'structured', 'raw', 'metadata', 'code', 'text', 'image', 'audio', 'video', 'unknown'].includes(t)
    );
    if (nonStandardTags.length >= 2) return 1;
    if (nonStandardTags.length === 1) return 0.5;
    // Partial credit for any fragment with multiple tags from different categories
    if (fragment.tags.length >= 4) return 0.3;
    return 0;
  }
}
