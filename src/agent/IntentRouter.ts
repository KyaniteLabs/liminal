/**
 * IntentRouter — Phase 11
 *
 * Classifies user input into one of four execution paths:
 *   direct     → conversational response via LLM
 *   creative   → RalphLoop generation
 *   engineering → ConveyorRunner task
 *   hybrid     → creative + engineering verification
 *
 * Uses keyword detection with confidence scoring.
 * Designed to be replaced by LLM-based classification later without changing the interface.
 */

import type {
  IntentConfidence,
  IntentClassification,
  IntentKeywords,
  IntentRouterConfig,
} from './types.js';

// ── Default Keywords ──

const DEFAULT_KEYWORDS: IntentKeywords = {
  creative: [
    'generate', 'create', 'make', 'remix', 'draw', 'paint', 'animate',
    'p5', 'shader', 'strudel', 'music', 'audio', 'visual', 'art',
    'creative', 'compose', 'sketch', 'seed', 'collage', 'palette',
    'sound', 'waveform', 'spectrum', 'aesthetic', 'beauty',
  ],
  engineering: [
    'fix', 'debug', 'test', 'coverage', 'build', 'lint', 'refactor',
    'optimize', 'improve', 'repair', 'implement', 'wire', 'integrate',
    'verify', 'batch', 'run task', 'ledger', 'conveyor', 'harness',
    'CI', 'type', 'compile', 'error', 'bug', 'fail',
  ],
  hybrid: [
    'improve the art', 'fix the generator', 'make it better', 'enhance',
    'quality', 'score', 'evaluate', 'critique and fix', 'review and improve',
    'self-improve', 'strengthen', 'upgrade',
  ],
};

const INTERNAL_ENGINEERING_SURFACES = [
  'bubble tea', 'bubbletea', 'tui', 'operator surface', 'right-column',
  'right column', 'final report panel', 'tool trace panel', 'conversation pane',
  'tui panel', 'tui viewport', 'bubble tea scroll', 'bubbletea scroll',
  'tui scroll', 'tui bridge', 'provider config', 'bridge launcher config',
];

// ── Router ──

export class IntentRouter {
  private readonly keywords: IntentKeywords;

  constructor(config?: IntentRouterConfig) {
    this.keywords = {
      creative: [...DEFAULT_KEYWORDS.creative, ...(config?.keywords?.creative ?? [])],
      engineering: [...DEFAULT_KEYWORDS.engineering, ...(config?.keywords?.engineering ?? [])],
      hybrid: [...DEFAULT_KEYWORDS.hybrid, ...(config?.keywords?.hybrid ?? [])],
    };
    // minConfidence reserved for future clarification gating
  }

  /**
   * Classify user input into an intent type.
   *
   * Algorithm:
   * 1. Check hybrid keywords first (most specific)
   * 2. Check creative keywords
   * 3. Check engineering keywords
   * 4. If no keywords match, default to 'direct'
   * 5. Confidence is 'high' if only one category matches,
   *    'medium' if two overlap, 'low' if all three match
   */
  classify(input: string): IntentClassification {
    const normalized = input.toLowerCase();

    const hybridHits = this.countHits(normalized, this.keywords.hybrid);
    const creativeHits = this.countHits(normalized, this.keywords.creative);
    const engineeringHits = this.countHits(normalized, this.keywords.engineering);
    const internalSurfaceHits = this.countHits(normalized, INTERNAL_ENGINEERING_SURFACES);

    const hitCategories = [
      hybridHits > 0,
      creativeHits > 0,
      engineeringHits > 0,
    ].filter(Boolean).length;

    const confidence = this.resolveConfidence(hitCategories);

    // Priority: hybrid > creative > engineering > direct
    if (hybridHits > 0) {
      return {
        intent: 'hybrid',
        confidence,
        topic: this.extractTopic(normalized),
        input,
      };
    }

    if (creativeHits > 0 && engineeringHits > 0) {
      if (internalSurfaceHits > 0) {
        return {
          intent: 'engineering',
          confidence: 'medium',
          topic: this.extractTopic(normalized),
          input,
        };
      }
      return {
        intent: 'hybrid',
        confidence: 'medium',
        topic: this.extractTopic(normalized),
        input,
      };
    }

    if (creativeHits > 0 && internalSurfaceHits > 0) {
      return {
        intent: 'engineering',
        confidence: 'medium',
        topic: this.extractTopic(normalized),
        input,
      };
    }

    if (creativeHits > 0) {
      return {
        intent: 'creative',
        confidence,
        topic: this.extractTopic(normalized),
        input,
      };
    }

    if (engineeringHits > 0) {
      return {
        intent: 'engineering',
        confidence,
        topic: this.extractTopic(normalized),
        input,
      };
    }

    return {
      intent: 'direct',
      confidence: 'high',
      topic: undefined,
      input,
    };
  }

  private countHits(text: string, keywords: string[]): number {
    let count = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        count++;
      }
    }
    return count;
  }

  private resolveConfidence(overlappingCategories: number): IntentConfidence {
    if (overlappingCategories <= 1) return 'high';
    if (overlappingCategories === 2) return 'medium';
    return 'low';
  }

  private extractTopic(text: string): string | undefined {
    // Extract a short topic phrase from the input
    const patterns = [
      /(?:generate|create|make|remix)\s+(?:a\s+)?(\S+)/i,
      /(?:fix|debug|improve|repair)\s+(?:the\s+)?(\S+)/i,
      /(?:p5|shader|strudel|music|audio)\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }
}
