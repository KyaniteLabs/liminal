/**
 * Progressive Design Tiers
 *
 * Defines 5 tiers of design quality from glitch to perfect.
 * Used for classifying generation quality and setting improvement goals.
 */

export interface DesignTier {
  level: number;
  name: string;
  minScore: number;
  maxScore: number;
  requiredScore: number;
  description: string;
  allowedComplexity: number;
}

export const TIERS: DesignTier[] = [
  {
    level: 0,
    name: 'glitch',
    minScore: -Infinity,
    maxScore: 0.2,
    requiredScore: 0.0,
    description: 'Non-functional or severely broken output',
    allowedComplexity: 1,
  },
  {
    level: 1,
    name: 'basic',
    minScore: 0.2,
    maxScore: 0.4,
    requiredScore: 0.2,
    description: 'Minimal functionality, rough implementation',
    allowedComplexity: 2,
  },
  {
    level: 2,
    name: 'functional',
    minScore: 0.4,
    maxScore: 0.7,
    requiredScore: 0.4,
    description: 'Works correctly but lacks polish',
    allowedComplexity: 3,
  },
  {
    level: 3,
    name: 'refined',
    minScore: 0.7,
    maxScore: 0.9,
    requiredScore: 0.7,
    description: 'Good quality with attention to detail',
    allowedComplexity: 4,
  },
  {
    level: 4,
    name: 'perfect',
    minScore: 0.9,
    maxScore: Infinity,
    requiredScore: 0.9,
    description: 'Excellent quality, production-ready',
    allowedComplexity: 5,
  },
];

/**
 * Classify a quality score into its corresponding tier.
 * @param score - Quality score between 0 and 1 (can be outside range for edge cases)
 * @returns The matching DesignTier
 */
export function classifyTier(score: number): DesignTier {
  for (const tier of TIERS) {
    if (score >= tier.minScore && score < tier.maxScore) {
      return tier;
    }
  }
  // Handle edge cases: below minimum returns glitch, above maximum returns perfect
  if (score < TIERS[0].maxScore) {
    return TIERS[0];
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Get the next tier goal for a given tier level.
 * @param currentLevel - Current tier level (0-4)
 * @returns The next DesignTier or null if at max level
 */
export function getNextTierGoal(currentLevel: number): DesignTier | null {
  const nextLevel = currentLevel + 1;
  if (nextLevel >= TIERS.length) {
    return null;
  }
  return TIERS[nextLevel];
}
