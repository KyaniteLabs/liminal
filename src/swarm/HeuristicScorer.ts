import type { SwarmPersona, SwarmOutput, Vote } from './types.js';

interface HeuristicScoreResult {
  scores: Map<string, number>;
  winnerId: string;
  votes: Map<string, Vote>;
  /**
   * True because this scorer is a deterministic PROXY, not a quality judge. Its
   * constraint dimension is naive token-overlap (presence of constraint keywords
   * in the output), which says nothing about whether the constraint is *honored*
   * well — only that the words appear. Consumers must treat these scores as a
   * cheap ranking heuristic for non-final rounds, never as a quality measure.
   */
  degraded: true;
  /** What makes the score degraded — surfaced so it is never mistaken for a real grade. */
  degradedReason: string;
}

/** Why the heuristic score is a proxy, not a quality measure. */
const DEGRADED_REASON =
  'token-overlap proxy: constraint scored by keyword presence, not adherence quality';

interface DimensionScores {
  constraint: number;
  novelty: number;
  length: number;
  vocabulary: number;
  codeStructure: number;
}

/** Weights for each heuristic dimension. */
const WEIGHTS = {
  constraint: 0.25,
  novelty: 0.20,
  length: 0.20,
  vocabulary: 0.20,
  codeStructure: 0.15,
};

/** Code structural patterns to detect. */
const CODE_PATTERNS = [
  /function\s+\w+/, /const\s+\w+\s*=/, /for\s*\(/,
  /if\s*\(/, /class\s+\w+/, /=>\s*[{(]/, /return\s+/,
  /let\s+\w+\s*=/, /while\s*\(/,
];

/**
 * Deterministic heuristic scorer for swarm outputs.
 * Used in non-final rounds to avoid expensive LLM voting calls.
 */
export class HeuristicScorer {
  /**
   * Score a single output across all 5 dimensions.
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
   * Score all outputs and produce a VotingResult-compatible result.
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

    for (const [personaId, output] of outputs) {
      const persona = personas.find(p => p.id === personaId);
      if (!persona) continue;

      const dims = this.scoreOutput(output.content, persona, constraint, prevWinnerOutputs);
      dimensionScores.set(personaId, dims);

      const score = WEIGHTS.constraint * dims.constraint
        + WEIGHTS.novelty * dims.novelty
        + WEIGHTS.length * dims.length
        + WEIGHTS.vocabulary * dims.vocabulary
        + WEIGHTS.codeStructure * dims.codeStructure;

      finalScores.set(personaId, score);

      votes.set(personaId, {
        voterId: personaId,
        firstChoice: personaId,
        secondChoice: '',
        // Marked [degraded] so the reasoning never reads as a quality verdict —
        // the constraint dimension is token-overlap, a presence proxy only.
        reasoning: `Heuristic [degraded: ${DEGRADED_REASON}]: score=${score.toFixed(2)} (con=${dims.constraint.toFixed(2)} nov=${dims.novelty.toFixed(2)} len=${dims.length.toFixed(2)} voc=${dims.vocabulary.toFixed(2)} code=${dims.codeStructure.toFixed(2)})`,
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

    return { scores: weightedScores, winnerId, votes, degraded: true, degradedReason: DEGRADED_REASON };
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
