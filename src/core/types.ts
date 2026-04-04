/**
 * Core shared types for the Liminal creative coding system.
 *
 * All subsystems (compost, swarm, scavenger) produce and consume
 * CreativeFragment instances. Subsystem-specific wrappers extend this
 * base with domain-specific metadata.
 */

/** Where a fragment originated. */
export type FragmentOrigin = 'compost' | 'swarm' | 'scavenger' | 'user';

/** Normalized creative fragment — the universal currency of the system. */
export interface CreativeFragment {
  id: string;
  content: string;
  score: number;
  origin: FragmentOrigin;
  tags: string[];
  domains: string[];
  source: string;
  createdAt: string;
  /** Subsystem-specific metadata preserved through conversion. */
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Conversion helpers — subsystem boundaries
// ---------------------------------------------------------------------------

/** Create a CreativeFragment from a compost Seed. */
export function seedToFragment(seed: {
  id: string;
  content: string;
  score: number;
  source: { fragments: string[]; collisionType: string; domains: string[] };
  promotedAt: string;
}): CreativeFragment {
  return {
    id: seed.id,
    content: seed.content,
    score: seed.score,
    origin: 'compost',
    tags: [seed.source.collisionType],
    domains: seed.source.domains,
    source: seed.source.fragments.join(', '),
    createdAt: seed.promotedAt,
    metadata: {
      collisionType: seed.source.collisionType,
      sourceFragments: seed.source.fragments,
      promotedAt: seed.promotedAt,
    },
  };
}

/** Create a CreativeFragment from a compost CompostFragment. */
export function compostFragmentToFragment(fragment: {
  id: string;
  content: string;
  source: string;
  domain: string;
  tags: string[];
  score?: number;
  metadata?: Record<string, unknown>;
}): CreativeFragment {
  return {
    id: fragment.id,
    content: fragment.content,
    score: fragment.score ?? 0,
    origin: 'compost',
    tags: fragment.tags,
    domains: [fragment.domain],
    source: fragment.source,
    createdAt: new Date().toISOString(),
    metadata: fragment.metadata ?? {},
  };
}

/** Create a CreativeFragment from a swarm MinedFragment. */
export function minedFragmentToFragment(mined: {
  id: string;
  text: string;
  source: string;
  score: number;
  persona: string;
  round: number;
  tags: string[];
  extractedAt: string;
  mode?: string;
  sessionPrompt?: string;
}): CreativeFragment {
  return {
    id: mined.id,
    content: mined.text,
    score: mined.score,
    origin: 'swarm',
    tags: mined.tags,
    domains: [],
    source: mined.source,
    createdAt: mined.extractedAt,
    metadata: {
      persona: mined.persona,
      round: mined.round,
      mode: mined.mode ?? null,
      sessionPrompt: mined.sessionPrompt ?? null,
    },
  };
}

/** Create a CreativeFragment from a scavenger extraction result. */
export function scavengerToFragment(extraction: {
  id: string;
  content: string;
  domain: string;
  score?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  source?: string;
}): CreativeFragment {
  return {
    id: extraction.id,
    content: extraction.content,
    score: extraction.score ?? 0,
    origin: 'scavenger',
    tags: extraction.tags ?? [],
    domains: [extraction.domain],
    source: extraction.source ?? extraction.domain,
    createdAt: new Date().toISOString(),
    metadata: extraction.metadata ?? {},
  };
}

/** Check whether a CreativeFragment came from a specific subsystem. */
export function isFromOrigin(fragment: CreativeFragment, origin: FragmentOrigin): boolean {
  return fragment.origin === origin;
}

// ---------------------------------------------------------------------------
// Re-export composition types for convenience
// ---------------------------------------------------------------------------

export type {
  DomainType,
  BlendMode,
  Layer,
  LayerConfig,
  LayerMetadata,
  Composition,
  GlobalSettings,
  AudioSettings,
  CompositionMetadata,
  LiminalProject,
} from '../composition/types.js';

export {
  DEFAULT_LAYER_CONFIG,
  DEFAULT_GLOBAL_SETTINGS,
  createLayer,
  createLayerFromResponse,
  createComposition,
  exportProject,
} from '../composition/types.js';

// Import and re-export adapter types
export type { Export, Import } from '../composition/adapters/index.js';
