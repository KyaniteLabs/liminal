/**
 * ProgressiveDesignTiers — Defines five progressive quality tiers for generative output.
 *
 * Tiers range from glitch (0) to perfect (4). Each tier specifies a minimum score
 * threshold, a human-readable name, and an allowed complexity budget.
 */

/** Describes a single quality tier in the progressive design system. */
export interface DesignTier {
  /** Tier level (0–4, higher is better). */
  level: number;
  /** Human-readable tier name. */
  name: string;
  /** Minimum aesthetic score (0–1) required to reach this tier. */
  requiredScore: number;
  /** Description of what this tier represents. */
  description: string;
  /** Maximum allowed element complexity count. */
  allowedComplexity: number;
}

/** The five predefined design tiers, ordered from lowest to highest. */
export const TIERS: DesignTier[] = [
  {
    level: 0,
    name: 'glitch',
    requiredScore: 0,
    description: 'Raw, unfiltered output. May contain visual artifacts and broken patterns.',
    allowedComplexity: 50,
  },
  {
    level: 1,
    name: 'basic',
    requiredScore: 0.2,
    description: 'Coherent shapes and colours present but minimal refinement.',
    allowedComplexity: 150,
  },
  {
    level: 2,
    name: 'functional',
    requiredScore: 0.45,
    description: 'Purposeful composition with readable structure and harmonious palette.',
    allowedComplexity: 350,
  },
  {
    level: 3,
    name: 'refined',
    requiredScore: 0.7,
    description: 'Polished output with strong aesthetic coherence and visual hierarchy.',
    allowedComplexity: 700,
  },
  {
    level: 4,
    name: 'perfect',
    requiredScore: 0.9,
    description: 'Exceptional quality — master-level composition, colour, and execution.',
    allowedComplexity: 1000,
  },
];

/**
 * Classify a score into its corresponding design tier.
 *
 * @param score - A numeric score between 0 and 1.
 * @returns The highest tier whose required score is less than or equal to the given score.
 */
export function classifyTier(score: number): DesignTier {
  const clamped = Math.max(0, Math.min(1, score));
  let match = TIERS[0];
  for (const tier of TIERS) {
    if (clamped >= tier.requiredScore) {
      match = tier;
    }
  }
  return match;
}

/**
 * Get the next tier above the current level, or null if already at the top.
 *
 * @param current - The current tier level (0–4).
 * @returns The next DesignTier, or null if there is no higher tier.
 */
export function getNextTierGoal(current: number): DesignTier | null {
  const nextLevel = current + 1;
  if (nextLevel >= TIERS.length) return null;
  return TIERS[nextLevel];
}
