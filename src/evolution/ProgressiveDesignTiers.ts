export interface DesignTier {
  level: number;
  name: 'glitch' | 'emerging' | 'functional' | 'polished' | 'perfect';
  minScore: number;
  description: string;
  mutationScale: number;
  explorationBias: number;
}

export const TIERS: readonly DesignTier[] = [
  {
    level: 0,
    name: 'glitch',
    minScore: 0,
    description: 'Raw output with visible experimental noise.',
    mutationScale: 1,
    explorationBias: 0.9,
  },
  {
    level: 1,
    name: 'emerging',
    minScore: 0.25,
    description: 'Structure is appearing, but quality is still unstable.',
    mutationScale: 0.7,
    explorationBias: 0.7,
  },
  {
    level: 2,
    name: 'functional',
    minScore: 0.5,
    description: 'The artifact works and has a clear creative direction.',
    mutationScale: 0.45,
    explorationBias: 0.45,
  },
  {
    level: 3,
    name: 'polished',
    minScore: 0.75,
    description: 'Strong artifact with only refinement-level issues left.',
    mutationScale: 0.25,
    explorationBias: 0.25,
  },
  {
    level: 4,
    name: 'perfect',
    minScore: 0.9,
    description: 'Publication-quality artifact with no material defects known.',
    mutationScale: 0.1,
    explorationBias: 0.1,
  },
];

export function classifyTier(score: number): DesignTier {
  const normalized = Math.max(0, Math.min(1, score));
  let tier = TIERS[0];
  for (const candidate of TIERS) {
    if (normalized >= candidate.minScore) tier = candidate;
  }
  return tier;
}

export function getNextTierGoal(level: number): DesignTier | null {
  return TIERS.find((tier) => tier.level === level + 1) ?? null;
}
