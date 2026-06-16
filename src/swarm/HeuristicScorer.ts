import type { SwarmOutput, SwarmPersona, Vote } from './types.js';

interface HeuristicScoreResult {
  scores: Map<string, number>;
  winnerId: string;
  votes: Map<string, Vote>;
  /**
   * True when the score is the historical token-overlap PROXY (no render
   * signal was available). When false, the score is grounded in a measured
   * render verdict and the result is no longer a "degraded proxy" — it is
   * the actual creative outcome.
   */
  degraded: boolean;
  /** What makes the score degraded — surfaced so it is never mistaken for a real grade. */
  degradedReason: string;
}

/** Why the heuristic score is a proxy, not a quality measure. */
const DEGRADED_REASON =
  'token-overlap proxy: constraint scored by keyword presence, not adherence quality';

/** Reason for a render-signal-grounded score (D12 honesty). */
const DEGRADED_RENDER_SIGNAL =
  'render-signals available: scored from measured render verdict';

interface DimensionScores {
  constraint: number;
  novelty: number;
  length: number;
  vocabulary: number;
  codeStructure: number;
}

/** Render-signal-grounded score, used when the output has real measurements. */
interface RenderSignalScores {
  /** 0-1 render verdict (passes render gate + luminance + render score). */
  overall: number;
  /** 0-1 weighted components. */
  components: {
    passesRenderGate: number;
    luminance: number;
    renderScore: number;
  };
}

/** Weights for the legacy heuristic dimension blend. */
const WEIGHTS = {
  constraint: 0.25,
  novelty: 0.20,
  length: 0.20,
  vocabulary: 0.20,
  codeStructure: 0.15,
};

/** Weights for the render-signal blend. The render verdict is the primary
 *  signal; the legacy heuristic dimensions become a 25% tiebreaker blend. */
const RENDER_WEIGHTS = {
  renderVerdict: 0.75,
  legacyBlend: 0.25,
};

/** Code structural patterns to detect. */
const CODE_PATTERNS = [
  /function\s+\w+/, /const\s+\w+\s*=/, /for\s*\(/,
  /if\s*\(/, /class\s+\w+/, /=>\s*[{(]/, /return\s+/,
  /let\s+\w+\s*=/, /while\s*\(/,
];

/**
 * Render-signal type alias (mirrors SwarmRenderSignals).
 * Defined locally to avoid an import cycle with ./types.
 */
type RenderSignals = {
  passesRenderGate?: boolean;
  luminance?: number;
  renderScore?: number;
  measuredAt?: string;
};

/**
 * Deterministic heuristic scorer for swarm outputs.
 * Used in non-final rounds to avoid expensive LLM voting calls.
 *
 * D12 honesty: when the calling code supplies measured render signals
 * (`output.metadata.renderSignals`), the score is grounded in those
 * measurements rather than the legacy token-overlap proxy. The legacy
 * path remains as a documented degraded fallback and is still the only
 * path when no render signals are present.
 */
export class HeuristicScorer {
  /**
   * Score all outputs and produce a VotingResult-compatible result.
   * Routes to render-signal scoring when available, falls back to the
   * legacy token-overlap proxy and flags `degraded: true` otherwise.
   */
  static score(
    outputs: Map<string, SwarmOutput>,
    personas: SwarmPersona[],
    constraint: string,
    prevWinnerOutputs: string[]
  ): HeuristicScoreResult {
    const dimensionScores = new Map<string, DimensionScores>();
    const finalScores = new Map<string, number>();
    const votes = new Map<string, Vote>();
    const perOutputDegraded = new Map<string, boolean>();

    for (const [personaId, output] of outputs) {
      const persona = personas.find(p => p.id === personaId);
      if (!persona) continue;

      const renderSignals = output.metadata?.renderSignals;
      const hasRenderSignals = this.hasUsableRenderSignals(renderSignals);

      const dims = this.scoreOutput(output.content, persona, constraint, prevWinnerOutputs);
      dimensionScores.set(personaId, dims);

      let score: number;
      if (hasRenderSignals) {
        const rs = this.scoreFromRenderSignals(renderSignals!);
        // Blend the render verdict (ground truth) with the legacy heuristic
        // blend (cheap tiebreaker). The render verdict carries 75% of the
        // weight, the heuristic dimensions 25%.
        const legacyScore =
          WEIGHTS.constraint * dims.constraint +
          WEIGHTS.novelty * dims.novelty +
          WEIGHTS.length * dims.length +
          WEIGHTS.vocabulary * dims.vocabulary +
          WEIGHTS.codeStructure * dims.codeStructure;
        score = RENDER_WEIGHTS.renderVerdict * rs.overall +
                RENDER_WEIGHTS.legacyBlend * legacyScore;
        perOutputDegraded.set(personaId, false);
      } else {
        score = WEIGHTS.constraint * dims.constraint +
                WEIGHTS.novelty * dims.novelty +
                WEIGHTS.length * dims.length +
                WEIGHTS.vocabulary * dims.vocabulary +
                WEIGHTS.codeStructure * dims.codeStructure;
        perOutputDegraded.set(personaId, true);
      }

      finalScores.set(personaId, score);

      const verdictLabel = hasRenderSignals
        ? 'render-grounded'
        : `[degraded: ${DEGRADED_REASON}]`;
      const scoreBreakdown = hasRenderSignals
        ? `gate=${renderSignals?.passesRenderGate ? 1 : 0} lum=${(renderSignals?.luminance ?? 0).toFixed(2)} rend=${(renderSignals?.renderScore ?? 0).toFixed(2)}`
        : `con=${dims.constraint.toFixed(2)} nov=${dims.novelty.toFixed(2)} len=${dims.length.toFixed(2)} voc=${dims.vocabulary.toFixed(2)} code=${dims.codeStructure.toFixed(2)}`;

      votes.set(personaId, {
        voterId: personaId,
        firstChoice: personaId,
        secondChoice: '',
        reasoning: `Heuristic ${verdictLabel}: score=${score.toFixed(2)} (${scoreBreakdown})`,
      });
    }

    // Find winner with tiebreaker logic
    const winnerId = this.breakTie(finalScores, dimensionScores, outputs);

    // Apply voting power (all = 2) to scores for consistency with LLM voting
    const weightedScores = new Map<string, number>();
    for (const [personaId, score] of finalScores) {
      const power = personas.find(p => p.id === personaId)?.votingPower ?? 2;
      weightedScores.set(personaId, score * power);
    }

    // Aggregate degraded flag: degraded iff ALL outputs lacked render signals.
    const allDegraded = perOutputDegraded.size > 0
      && [...perOutputDegraded.values()].every(v => v);
    const reason = allDegraded
      ? DEGRADED_REASON
      : (perOutputDegraded.size === 0 ? DEGRADED_REASON : DEGRADED_RENDER_SIGNAL);

    return {
      scores: weightedScores,
      winnerId,
      votes,
      degraded: allDegraded,
      degradedReason: reason,
    };
  }

  /**
   * True when the output's render signals are usable for scoring.
   * Requires `passesRenderGate` to be set; the other fields are optional
   * defaults (luminance=0.5 mid, renderScore=0 if absent).
   */
  private static hasUsableRenderSignals(
    rs: RenderSignals | undefined,
  ): rs is RenderSignals {
    return rs !== undefined && rs !== null && typeof rs.passesRenderGate === 'boolean';
  }

  /**
   * Compute a 0-1 render verdict from the measured render signals. The
   * render gate is binary; luminance is averaged with the render score
   * to give a continuous verdict.
   */
  private static scoreFromRenderSignals(rs: RenderSignals): RenderSignalScores {
    const passesRenderGate = rs.passesRenderGate ? 1 : 0;
    const luminance = this.clamp01(rs.luminance ?? 0.5);
    const renderScore = this.clamp01(rs.renderScore ?? (rs.passesRenderGate ? 0.7 : 0.3));
    // Gate carries 60% of the verdict (binary measure of creative viability);
    // continuous signals (luminance + render score) carry the remaining 40%.
    const continuous = (luminance + renderScore) / 2;
    const overall = 0.6 * passesRenderGate + 0.4 * continuous;
    return { overall, components: { passesRenderGate, luminance, renderScore } };
  }

  private static clamp01(v: number): number {
    if (Number.isNaN(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  /**
   * Score a single output across all 5 dimensions (legacy heuristic).
   */
  static scoreOutput(
    output: string,
    persona: SwarmPersona,
    constraint: string,
    prevWinnerOutputs: string[]
  ): DimensionScores {
    return {
      constraint: this.scoreConstraint(output, constraint),
      novelty: this.scoreNovelty(output, prevWinnerOutputs),
      length: this.scoreLength(output, persona.maxTokens),
      vocabulary: this.scoreVocabulary(output),
      codeStructure: this.scoreCodeStructure(output),
    };
  }

  /**
   * Constraint PROXY (not adherence): fraction of constraint keywords that
   * appear anywhere in the output. This measures keyword *presence*, not whether
   * the constraint is honored — it is a cheap deterministic ranking signal for
   * non-final rounds, deliberately flagged `degraded` on the result so it is
   * never reported as a quality score.
   */
  static scoreConstraint(output: string, constraint: string): number {
    const constraintTokens = this.tokenize(constraint).filter(t => t.length > 3);
    if (constraintTokens.length === 0) return 0.5;

    const outputTokens = new Set(this.tokenize(output));
    const hits = constraintTokens.filter(t => outputTokens.has(t)).length;
    return hits / constraintTokens.length;
  }

  /**
   * Novelty delta: Jaccard distance from all previous round winners.
   */
  static scoreNovelty(output: string, prevWinnerOutputs: string[]): number {
    if (prevWinnerOutputs.length === 0) return 0.8; // No history = assume novel

    const currentTokens = new Set(this.tokenize(output));
    const prevTokens = new Set(prevWinnerOutputs.flatMap(this.tokenize));

    if (currentTokens.size === 0 && prevTokens.size === 0) return 0.5;

    const intersection = [...currentTokens].filter(t => prevTokens.has(t));
    const union = new Set([...currentTokens, ...prevTokens]);

    return union.size > 0 ? 1 - (intersection.length / union.size) : 0.5;
  }

  /**
   * Length quality: bell curve around persona's maxTokens * 0.7.
   */
  static scoreLength(output: string, maxTokens: number): number {
    const optimal = maxTokens * 0.7;
    const ratio = output.length / optimal;

    if (ratio < 0.2) return ratio / 0.2;          // Too short: linear penalty
    if (ratio <= 1.3) return 1.0;                  // Sweet spot: full score
    return Math.max(0, 1 - (ratio - 1.3) / 0.7);  // Too long: linear penalty
  }

  /**
   * Vocabulary richness: type-token ratio (unique tokens / total tokens).
   */
  static scoreVocabulary(output: string): number {
    const tokens = this.tokenize(output);
    if (tokens.length === 0) return 0;

    const uniqueTokens = new Set(tokens);
    return uniqueTokens.size / tokens.length;
  }

  /**
   * Code structure: presence of structural programming patterns.
   */
  static scoreCodeStructure(output: string): number {
    const hits = CODE_PATTERNS.filter(p => p.test(output)).length;
    return Math.min(1, hits / 3); // 3+ patterns = full score
  }

  /**
   * Break ties: higher novelty wins, then shorter output, then random.
   */
  private static breakTie(
    scores: Map<string, number>,
    dimensionScores: Map<string, DimensionScores>,
    outputs: Map<string, SwarmOutput>
  ): string {
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return '';

    const topScore = sorted[0][1];
    const tied = sorted.filter(([, s]) => s === topScore);

    if (tied.length === 1) return tied[0][0];

    // Tiebreaker 1: higher novelty delta
    const byNovelty = [...tied].sort((a, b) => {
      const dimsA = dimensionScores.get(a[0]);
      const dimsB = dimensionScores.get(b[0]);
      return (dimsB?.novelty ?? 0) - (dimsA?.novelty ?? 0);
    });

    if (byNovelty[0][1] !== byNovelty[1][1]) return byNovelty[0][0];

    // Tiebreaker 2: shorter output
    const byLength = [...tied].sort((a, b) => {
      const outA = outputs.get(a[0])?.content.length ?? 0;
      const outB = outputs.get(b[0])?.content.length ?? 0;
      return outA - outB;
    });

    if (byLength[0][1] !== byLength[1][1]) return byLength[0][0];

    // Tiebreaker 3: random
    return tied[Math.floor(Math.random() * tied.length)][0];
  }

  /**
   * Simple whitespace tokenizer, lowercased.
   */
  private static tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  }
}
