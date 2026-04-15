/**
 * DreamEngine — Two-stage autonomous creative exploration.
 *
 * Stage 1 (Cheap Conceptual): Generate N candidate concepts via LLM prompt.
 *   Just ideas, no code — fast, low-cost. Uses Thompson sampling to pick
 *   promising domains/models/strategies for exploration.
 *
 * Stage 2 (Selective Execution): Pick top-K candidates, generate actual code.
 *   Score with full evaluation pipeline. Feed results back into
 *   ThompsonSampler, DomainPrototype, and IntuitionCache.
 *
 * The DreamJournal records all dream outcomes for user review — the system's
 * "dream diary" so you can see what it explored while you were away.
 *
 * @module intuition/DreamEngine
 */

import { ThompsonSampler } from './ThompsonSampler.js';
import { DomainPrototype } from './DomainPrototype.js';
import { IntuitionCache } from './IntuitionCache.js';
import { MemoryConsolidator } from './MemoryConsolidator.js';
import type { SleepDepth } from './SleepScheduler.js';
import { Logger } from '../utils/Logger.js';
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A conceptual candidate from Stage 1. */
export interface DreamConcept {
  /** Unique ID */
  id: string;
  /** Target domain (e.g., 'p5', 'glsl') */
  domain: string;
  /** Creative prompt/concept */
  prompt: string;
  /** Which model the system would use */
  model: string;
  /** Which generation strategy */
  strategy: string;
  /** Thompson-sampled expected quality (0-1) */
  expectedQuality: number;
  /** Why this concept was selected */
  reason: string;
}

/** A fully realized dream from Stage 2. */
export interface DreamOutput {
  /** Links back to concept */
  conceptId: string;
  /** Generated code */
  code: string;
  /** Quality score from evaluation */
  qualityScore: number;
  /** Intuition score */
  intuitionScore: number;
  /** Novelty score */
  noveltyScore: number;
  /** Duration in ms */
  durationMs: number;
  /** Whether this dream produced a keeper */
  isKeeper: boolean;
}

/** A dream journal entry — the user-facing record. */
export interface DreamJournalEntry {
  /** Unique ID */
  id: string;
  /** When the dream started */
  startedAt: string;
  /** When the dream ended */
  completedAt: string;
  /** Sleep depth that triggered this dream */
  depth: SleepDepth;
  /** Concepts generated (Stage 1) */
  conceptsGenerated: number;
  /** Concepts executed (Stage 2) */
  conceptsExecuted: number;
  /** Best quality achieved */
  bestQuality: number;
  /** Average quality */
  avgQuality: number;
  /** Number of keepers */
  keepers: number;
  /** Full concept + output pairs */
  results: Array<{
    concept: DreamConcept;
    output: DreamOutput | null; // null if concept was skipped in Stage 2
  }>;
  /** Total duration in ms */
  totalDurationMs: number;
}

/** DreamEngine configuration. */
export interface DreamEngineConfig {
  /** Number of concepts to generate in Stage 1. Default: 10 */
  stage1Count?: number;
  /** Number of concepts to execute in Stage 2. Default: 3 */
  stage2Count?: number;
  /** Quality threshold for "keeper" status. Default: 0.75 */
  keeperThreshold?: number;
  /** Domains to explore. Default: ['p5'] */
  domains?: string[];
  /** LLM function for generating candidates. Required for Stage 1. */
  generatePrompt?: (prompt: string) => Promise<string>;
  /** LLM function for generating code. Required for Stage 2. */
  generateCode?: (prompt: string, domain: string) => Promise<string>;
}

// ---------------------------------------------------------------------------
// DreamEngine
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<Omit<DreamEngineConfig, 'generatePrompt' | 'generateCode'>> = {
  stage1Count: 10,
  stage2Count: 3,
  keeperThreshold: 0.75,
  domains: ['p5'],
};

export class DreamEngine {
  private readonly modelSampler: ThompsonSampler<string>;
  private readonly strategySampler: ThompsonSampler<string>;
  private readonly prototype: DomainPrototype;
  private readonly cache: IntuitionCache;
  private readonly consolidator: MemoryConsolidator;
  private readonly entropy: MetabolicEntropyEngine;
  private readonly config: Required<Omit<DreamEngineConfig, 'generatePrompt' | 'generateCode'>> & {
    generatePrompt?: DreamEngineConfig['generatePrompt'];
    generateCode?: DreamEngineConfig['generateCode'];
  };

  private journal: DreamJournalEntry[] = [];
  private dreamCounter = 0;

  constructor(
    deps: {
      modelSampler: ThompsonSampler<string>;
      strategySampler: ThompsonSampler<string>;
      prototype: DomainPrototype;
      cache: IntuitionCache;
      consolidator: MemoryConsolidator;
      entropy: MetabolicEntropyEngine;
    },
    config?: DreamEngineConfig,
  ) {
    if (!deps.entropy) {
      throw new Error('DreamEngine: entropy engine is required');
    }
    this.modelSampler = deps.modelSampler;
    this.strategySampler = deps.strategySampler;
    this.prototype = deps.prototype;
    this.cache = deps.cache;
    this.consolidator = deps.consolidator;
    this.entropy = deps.entropy;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run a full dream cycle (Stage 1 + Stage 2).
   *
   * @param depth — Sleep depth from SleepScheduler
   * @returns Dream journal entry
   */
  async dream(depth: SleepDepth = 'micro'): Promise<DreamJournalEntry> {
    const startedAt = new Date().toISOString();
    const stage1Multiplier = depth === 'deep' ? 2 : 1;
    const stage2Multiplier = depth === 'deep' ? 2 : 1;

    const stage1Count = this.config.stage1Count * stage1Multiplier;
    const stage2Count = this.config.stage2Count * stage2Multiplier;

    Logger.info('DreamEngine', `Starting ${depth} dream: ${stage1Count} concepts → ${stage2Count} executions`);

    // --- Stage 1: Generate concepts ---
    const concepts = await this.generateConcepts(stage1Count);

    // --- Stage 2: Select and execute top concepts ---
    const selected = this.selectTopConcepts(concepts, stage2Count);
    const results: DreamJournalEntry['results'] = [];

    for (const concept of concepts) {
      if (selected.includes(concept)) {
        const output = await this.executeConcept(concept);
        results.push({ concept, output });

        // Feed back into the system
        this.feedbackLoop(concept, output);
      } else {
        results.push({ concept, output: null });
      }
    }

    const completedAt = new Date().toISOString();
    const outputs = results.filter(r => r.output !== null).map(r => r.output!);
    const qualities = outputs.map(o => o.qualityScore);

    const entry: DreamJournalEntry = {
      id: `dream-${++this.dreamCounter}`,
      startedAt,
      completedAt,
      depth,
      conceptsGenerated: concepts.length,
      conceptsExecuted: outputs.length,
      bestQuality: qualities.length > 0 ? Math.max(...qualities) : 0,
      avgQuality: qualities.length > 0 ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0,
      keepers: outputs.filter(o => o.isKeeper).length,
      results,
      totalDurationMs: Date.now() - new Date(startedAt).getTime(),
    };

    this.journal.push(entry);

    Logger.info('DreamEngine',
      `Dream complete: ${entry.conceptsExecuted} executed, ${entry.keepers} keepers, ` +
      `best=${entry.bestQuality.toFixed(3)}, avg=${entry.avgQuality.toFixed(3)}`);

    return entry;
  }

  /** Get the dream journal (all past dreams). */
  getJournal(): DreamJournalEntry[] {
    return [...this.journal];
  }

  /** Get recent dreams. */
  getRecentDreams(limit: number = 10): DreamJournalEntry[] {
    return this.journal.slice(-limit);
  }

  /** Get total dream count. */
  get dreamCount(): number {
    return this.dreamCounter;
  }

  /** Get keeper count across all dreams. */
  get totalKeepers(): number {
    return this.journal.reduce((sum, e) => sum + e.keepers, 0);
  }

  /** Get the memory consolidator (for external wiring). */
  getConsolidator(): MemoryConsolidator {
    return this.consolidator;
  }

  /** Reset dream state. */
  reset(): void {
    this.journal = [];
    this.dreamCounter = 0;
  }

  // ---------------------------------------------------------------------------
  // Private: Stage 1 — Concept Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate N creative concepts using Thompson sampling for domain/model/strategy selection.
   */
  private async generateConcepts(count: number): Promise<DreamConcept[]> {
    const concepts: DreamConcept[] = [];

    for (let i = 0; i < count; i++) {
      // Thompson-sample domain, model, strategy
      const domain = this.sampleDomain();
      const model = this.modelSampler.select() ?? 'local';
      const strategy = this.strategySampler.select() ?? 'solo';

      // Generate creative prompt
      const prompt = await this.generateCreativePrompt(domain);

      // Estimate expected quality from Thompson sampler
      const modelConfidence = this.modelSampler.getConfidence(model);
      const prototypeReady = this.prototype.isReady(domain, 3);
      const expectedQuality = prototypeReady
        ? modelConfidence * 0.7 + 0.3 // Weight Thompson + base
        : 0.5; // No data — neutral estimate

      concepts.push({
        id: `concept-${i + 1}`,
        domain,
        prompt,
        model,
        strategy,
        expectedQuality,
        reason: `Thompson selected ${model} (${modelConfidence.toFixed(2)} confidence) for ${domain}, strategy: ${strategy}`,
      });
    }

    return concepts;
  }

  /**
   * Generate a creative prompt for a domain.
   * Uses the LLM if available, otherwise uses template-based generation.
   */
  private async generateCreativePrompt(domain: string): Promise<string> {
    if (this.config.generatePrompt) {
      try {
        const response = await this.config.generatePrompt(
          `Generate a creative coding prompt for a ${domain} sketch. Be imaginative and specific. One prompt only, no explanation.`,
        );
        return response.trim();
      } catch (err) {
        Logger.warn('DreamEngine', 'LLM prompt generation failed, using template:', err instanceof Error ? err.message : err);
      }
    }

    // Fallback: template-based prompt generation
    const templates: Record<string, string[]> = {
      p5: [
        'Flowing particles responding to mouse movement',
        'Abstract landscape with procedural noise',
        'Geometric patterns morphing over time',
        'Color field painting with smooth gradients',
        'Kinetic typography with wave motion',
        'Organic shapes using Perlin noise',
        'Constellation map connecting random points',
        'Fluid simulation with color mixing',
        'Recursive fractal tree with wind',
        'Audio-reactive circle packing',
      ],
      glsl: [
        'Volumetric raymarched fog',
        'Kaleidoscopic mirror effect',
        'Plasma effect with smooth color cycling',
        'Voronoi diagram with animated seeds',
        'Reaction-diffusion pattern',
      ],
      three: [
        'Low-poly terrain with dynamic lighting',
        'Particle galaxy simulation',
        'Metaball morphing animation',
        'Procedural cityscape at night',
      ],
    };

    const domainTemplates = templates[domain] ?? templates['p5'];
    return domainTemplates[this.entropy.nextInt(domainTemplates.length)];
  }

  // ---------------------------------------------------------------------------
  // Private: Stage 2 — Selective Execution
  // ---------------------------------------------------------------------------

  /**
   * Select top-K concepts for execution.
   * Uses expected quality + novelty as selection criteria.
   */
  private selectTopConcepts(concepts: DreamConcept[], k: number): DreamConcept[] {
    // Score each concept: expected quality * 0.7 + exploration bonus * 0.3
    const scored = concepts.map(c => ({
      concept: c,
      score: c.expectedQuality * 0.7 + this.entropy.nextFloat() * 0.3, // Exploration bonus (random)
    }));

    // Sort descending, take top-K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map(s => s.concept);
  }

  /**
   * Execute a concept — generate actual code and score it.
   */
  private async executeConcept(concept: DreamConcept): Promise<DreamOutput> {
    const start = Date.now();

    let code: string;
    if (this.config.generateCode) {
      try {
        code = await this.config.generateCode(concept.prompt, concept.domain);
      } catch (err) {
        Logger.warn('DreamEngine', `Code generation failed for "${concept.prompt}":`, err instanceof Error ? err.message : err);
        code = `// Generation failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else {
      // Without an LLM, we produce a stub
      code = `// Dream stub for: ${concept.prompt}\n// Domain: ${concept.domain}\n// Model: ${concept.model}\nfunction setup() {} function draw() {}`;
    }

    const durationMs = Date.now() - start;

    // Score the output
    const qualityScore = this.scoreOutput(code, concept.domain);
    const intuitionScore = concept.expectedQuality;
    const noveltyScore = this.computeNovelty(code);
    const isKeeper = qualityScore >= this.config.keeperThreshold;

    return {
      conceptId: concept.id,
      code,
      qualityScore,
      intuitionScore,
      noveltyScore,
      durationMs,
      isKeeper,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Feedback & scoring
  // ---------------------------------------------------------------------------

  /**
   * Feed dream results back into the intuition system.
   */
  private feedbackLoop(concept: DreamConcept, output: DreamOutput): void {
    // Update Thompson sampler with actual outcome
    this.modelSampler.update(concept.model, output.qualityScore);
    this.strategySampler.update(concept.strategy, output.qualityScore);

    // Cache the assessment
    this.cache.set(concept.domain, output.code, {
      score: output.intuitionScore,
      confidence: output.qualityScore,
      signals: [
        { name: 'dream_quality', value: output.qualityScore, reason: `Dream score for "${concept.prompt}"` },
        { name: 'novelty', value: output.noveltyScore, reason: `Novelty of dream output` },
      ],
      recommendation: `dream: ${concept.prompt} → quality=${output.qualityScore.toFixed(2)}`,
    });
  }

  /**
   * Score generated output using heuristic signals.
   */
  private scoreOutput(code: string, _domain: string): number {
    const lineCount = code.split('\n').length;
    const hasFunctions = /\bfunction\s+\w+/.test(code);
    const hasInteraction = /mouseX|mouseY|frameCount|keyIsPressed|millis/.test(code);
    const hasColor = /color\(|fill\(|stroke\(|background\(/.test(code);
    const hasLoop = /\bfor\s*\(|\bwhile\s*\(/.test(code);
    const isStub = code.includes('// Dream stub') || code.includes('Generation failed');

    if (isStub) return 0.1;

    const techniqueScore = [hasFunctions, hasInteraction, hasColor, hasLoop].filter(Boolean).length / 4;
    const lengthScore = Math.min(1, lineCount / 50);

    return Math.min(1, lengthScore * 0.4 + techniqueScore * 0.6);
  }

  /**
   * Compute novelty of output compared to cached entries.
   */
  private computeNovelty(code: string): number {
    const tokens = new Set(code.toLowerCase().split(/\s+/));
    const cached = this.cache.getDomainEntries('p5'); // Simplified

    if (cached.length === 0) return 1.0;

    // Compare with a sample of cached outputs
    let maxSimilarity = 0;
    for (const entry of cached.slice(-5)) {
      const cachedTokens = new Set(
        (entry.assessment.recommendation ?? '').toLowerCase().split(/\s+/)
      );
      const intersection = new Set([...tokens].filter(t => cachedTokens.has(t)));
      const union = new Set([...tokens, ...cachedTokens]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      maxSimilarity = Math.max(maxSimilarity, jaccard);
    }

    return 1 - maxSimilarity;
  }

  /**
   * Sample a domain using Thompson-inspired selection.
   * Biases toward domains with more prototype data.
   */
  private sampleDomain(): string {
    const domains = this.config.domains;

    // Weight by prototype readiness
    const weights = domains.map(d => {
      const centroid = this.prototype.getCentroid(d);
      return centroid ? centroid.exampleCount : 1; // Minimum weight
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const r = this.entropy.nextFloat() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < domains.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) return domains[i];
    }

    return domains[0];
  }
}
