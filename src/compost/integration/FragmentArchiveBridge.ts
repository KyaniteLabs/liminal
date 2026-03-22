/**
 * FragmentArchiveBridge — bridges compost seeds to/from FragmentArchive.
 */

import type { Seed, CompostFragment } from '../types.js';
import { SeedBank } from '../SeedBank.js';
import { formatSeedForPrompt } from '../../core/lir/LIRPromptFormatter.js';

export class FragmentArchiveBridge {
  /** Convert seeds to fragment format for FragmentArchive. */
  getSeedsAsFragments(seeds: Seed[]): CompostFragment[] {
    return seeds.map(seed => ({
      id: seed.id,
      source: `seed:${seed.id}`,
      domain: seed.source.domains[0] ?? 'unknown',
      layer: 'semantic' as const,
      content: seed.content,
      metadata: {
        fileType: 'seed',
        timestamp: seed.promotedAt,
        hash: seed.id,
        size: seed.content.length,
        extractedAt: seed.promotedAt,
      },
      tags: [...seed.source.domains, 'seed', seed.source.collisionType],
      score: seed.score,
    }));
  }

  /** Get a random seed's content for swarm/prompt use. */
  async getRandomSeedAsPromptSeed(seedBank: SeedBank): Promise<string | undefined> {
    const seed = await seedBank.getRandomSeed();
    return seed ? formatSeedForPrompt(seed, 500) : undefined;
  }

  /** Sync seeds from seed bank into a fragment archive (data only). */
  async syncSeeds(seedBank: SeedBank, fragments: CompostFragment[]): Promise<number> {
    const seeds = await seedBank.getAll();
    const seedFragments = this.getSeedsAsFragments(seeds);
    const existingIds = new Set(fragments.map(f => f.id));
    let added = 0;

    for (const frag of seedFragments) {
      if (!existingIds.has(frag.id)) {
        fragments.push(frag);
        added++;
      }
    }

    return added;
  }
}
