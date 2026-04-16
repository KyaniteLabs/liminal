/**
 * ChallengeGenerator — Phase 16
 *
 * Generates creative challenges to drive garden exploration.
 * Challenges target unexplored niches, weak lineages, and
 * cross-domain transfer opportunities.
 */

import type { ArchiveCell, DescriptorAxis } from '../emergence/types.js';

export interface CreativeChallenge {
  id: string;
  title: string;
  description: string;
  targetAxes: Partial<Record<DescriptorAxis, number>>;
  difficulty: number;
  origin: 'frontier' | 'weak-lineage' | 'cross-domain' | 'user-prompt' | 'stagnation-break';
}

export interface ChallengeGeneratorConfig {
  /** Maximum challenges per generation (default: 5) */
  maxPerGeneration?: number;
}

export class ChallengeGenerator {
  private readonly maxPerGeneration: number;
  private challengeCount = 0;

  constructor(config: ChallengeGeneratorConfig = {}) {
    this.maxPerGeneration = config.maxPerGeneration ?? 5;
  }

  /**
   * Generate challenges from current archive state.
   */
  generate(cells: ArchiveCell[], axes: DescriptorAxis[]): CreativeChallenge[] {
    const challenges: CreativeChallenge[] = [];

    // 1. Frontier challenges: target empty or under-explored cells
    const emptyCells = cells.filter(c => !c.elite);
    for (const cell of emptyCells.slice(0, 2)) {
      challenges.push(this.makeChallenge('frontier', cell.coordinates, axes));
    }

    // 2. Weak lineage challenges: improve low-quality occupied cells
    const weakEntries = cells
      .filter(c => c.elite && c.elite.qualityScore < 0.4)
      .map(c => c.elite!)
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 2);

    for (const entry of weakEntries) {
      challenges.push(this.makeChallenge('weak-lineage', entry.descriptor.values, axes));
    }

    // 3. Cross-domain: target extremes on each axis
    if (axes.length > 0) {
      const axis = axes[Math.floor(Math.random() * axes.length)];
      const targetAxes: Partial<Record<DescriptorAxis, number>> = {};
      targetAxes[axis] = Math.random() > 0.5 ? 0.1 : 0.9;
      challenges.push({
        id: `challenge-${++this.challengeCount}`,
        title: `Push ${axis} to extreme`,
        description: `Explore the far end of the ${axis} axis`,
        targetAxes,
        difficulty: 0.7,
        origin: 'cross-domain',
      });
    }

    return challenges.slice(0, this.maxPerGeneration);
  }

  /**
   * Generate a challenge from a specific user prompt.
   */
  fromPrompt(prompt: string, axes: DescriptorAxis[]): CreativeChallenge {
    const targetAxes: Partial<Record<DescriptorAxis, number>> = {};
    for (const axis of axes.slice(0, 2)) {
      targetAxes[axis] = 0.3 + Math.random() * 0.4;
    }

    return {
      id: `challenge-${++this.challengeCount}`,
      title: prompt.slice(0, 80),
      description: prompt,
      targetAxes,
      difficulty: 0.5,
      origin: 'user-prompt',
    };
  }

  /**
   * Generate a stagnation-breaking challenge.
   */
  stagnationBreak(axes: DescriptorAxis[]): CreativeChallenge {
    // Target the midpoint of all axes with some perturbation
    const targetAxes: Partial<Record<DescriptorAxis, number>> = {};
    for (const axis of axes) {
      targetAxes[axis] = 0.5 + (Math.random() - 0.5) * 0.6;
    }

    return {
      id: `challenge-${++this.challengeCount}`,
      title: 'Stagnation break: random perturbation',
      description: 'Wide perturbation across all axes to break out of local optima',
      targetAxes,
      difficulty: 0.9,
      origin: 'stagnation-break',
    };
  }

  getChallengeCount(): number {
    return this.challengeCount;
  }

  private makeChallenge(
    origin: CreativeChallenge['origin'],
    coords: Array<{ axis: string; value: number }>,
    _axes: DescriptorAxis[],
  ): CreativeChallenge {
    const targetAxes: Partial<Record<DescriptorAxis, number>> = {};
    for (const c of coords) {
      targetAxes[c.axis as DescriptorAxis] = c.value;
    }

    const titles: Record<string, string> = {
      frontier: 'Explore empty niche',
      'weak-lineage': 'Improve weak lineage',
    };

    return {
      id: `challenge-${++this.challengeCount}`,
      title: titles[origin] ?? 'Creative challenge',
      description: `${origin} challenge targeting ${coords.length} axes`,
      targetAxes,
      difficulty: origin === 'frontier' ? 0.8 : 0.5,
      origin,
    };
  }
}
