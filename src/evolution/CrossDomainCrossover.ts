/**
 * CrossDomainCrossover — cross-domain technique transfer for creative evolution.
 *
 * Enables creative techniques learned in one domain (e.g. music) to be
 * transferred and adapted to another domain (e.g. visual art).  Ported from
 * hydra-creative-agent's crossover.py.
 *
 * The module provides:
 * - Bidirectional domain mappings (music↔visual, visual↔code, code↔music)
 * - `crossoverReasoning` — transfer a single technique from source to target
 * - `combineReasoning` — fuse techniques from multiple weighted sources
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Creative domains supported by the crossover system. */
export type CreativeDomain = 'visual' | 'audio' | 'code' | 'music' | 'shader' | '3d';

/**
 * A mapping between two creative domains.
 *
 * @property source     - The domain techniques originate from.
 * @property target     - The domain techniques are being transferred to.
 * @property techniqueMap - Maps a source-domain technique name to its
 *                          target-domain equivalent.
 * @property decisionMap - Adapts a concrete decision value from the source
 *                          domain into an appropriate target-domain value.
 *                          Keys match source-domain decision names; values are
 *                          pure transform functions.
 */
export interface CrossoverMapping {
  source: CreativeDomain;
  target: CreativeDomain;
  techniqueMap: Record<string, string>;
  decisionMap: Record<string, (value: number | string) => string | number>;
}

/**
 * Result of a single cross-domain crossover operation.
 *
 * @property sourceDomain          - Domain the technique came from.
 * @property targetDomain          - Domain the technique was adapted to.
 * @property transferredTechniques - Technique names after adaptation.
 * @property adaptedDecisions      - Decision values translated to the target domain.
 * @property creativityLevel       - 0–1 score reflecting how "far" the transfer
 *                                   stretched the creative space.
 */
export interface CrossoverResult {
  sourceDomain: CreativeDomain;
  targetDomain: CreativeDomain;
  transferredTechniques: string[];
  adaptedDecisions: Record<string, string | number>;
  creativityLevel: number;
}

// ---------------------------------------------------------------------------
// Domain mappings
// ---------------------------------------------------------------------------

/**
 * Bidirectional mappings between creative domains.
 *
 * Each key is a composite string `"source→target"` so that lookup is O(1).
 * The mapping set is intentionally small but covers the most useful cross-
 * pollination paths: music→visual, visual→code, and code→music.
 */
export const DOMAIN_MAPPINGS: Record<string, CrossoverMapping> = {
  // -- music → visual -------------------------------------------------------
  'music→visual': {
    source: 'music',
    target: 'visual',
    techniqueMap: {
      tempo: 'animation_speed',
      key: 'color_palette',
      volume: 'opacity',
      rhythm: 'pattern_repeat',
    },
    decisionMap: {
      bpm: (v: number | string) =>
        typeof v === 'number'
          ? Math.round((v / 160) * 100) / 100 // normalise to 0–1 animation speed
          : v,
      scale: (v: number | string) =>
        typeof v === 'string'
          ? v.replace('major', 'warm').replace('minor', 'cool')
          : v,
      velocity: (v: number | string) =>
        typeof v === 'number'
          ? Math.round(Math.max(0, Math.min(1, v / 127)) * 100) / 100
          : v,
    },
  },

  // -- visual → music -------------------------------------------------------
  'visual→music': {
    source: 'visual',
    target: 'music',
    techniqueMap: {
      animation_speed: 'tempo',
      color_palette: 'key',
      opacity: 'volume',
      pattern_repeat: 'rhythm',
    },
    decisionMap: {
      animation_speed: (v: number | string) =>
        typeof v === 'number'
          ? Math.round(v * 160) // reverse normalise to approximate BPM
          : v,
      palette_tone: (v: number | string) =>
        typeof v === 'string'
          ? v.replace('warm', 'major').replace('cool', 'minor')
          : v,
    },
  },

  // -- visual → code --------------------------------------------------------
  'visual→code': {
    source: 'visual',
    target: 'code',
    techniqueMap: {
      color: 'variable_naming',
      layout: 'code_structure',
      complexity: 'cyclomatic_complexity',
    },
    decisionMap: {
      hue: (v: number | string) =>
        typeof v === 'number'
          ? v < 180 ? 'descriptive' : 'concise'
          : v,
      grid_density: (v: number | string) =>
        typeof v === 'number'
          ? v > 0.5 ? 'modular' : 'flat'
          : v,
      layer_count: (v: number | string) =>
        typeof v === 'number'
          ? Math.max(1, Math.round(v))
          : v,
    },
  },

  // -- code → visual --------------------------------------------------------
  'code→visual': {
    source: 'code',
    target: 'visual',
    techniqueMap: {
      variable_naming: 'color',
      code_structure: 'layout',
      cyclomatic_complexity: 'complexity',
    },
    decisionMap: {
      naming_style: (v: number | string) =>
        typeof v === 'string'
          ? v === 'descriptive' ? 30 : 210 // hue value
          : v,
      structure_type: (v: number | string) =>
        typeof v === 'string'
          ? v === 'modular' ? 0.8 : 0.2 // grid density
          : v,
    },
  },

  // -- code → music ---------------------------------------------------------
  'code→music': {
    source: 'code',
    target: 'music',
    techniqueMap: {
      function_count: 'voice_count',
      nesting: 'harmony_layers',
      loc: 'duration',
    },
    decisionMap: {
      functions: (v: number | string) =>
        typeof v === 'number'
          ? Math.max(1, Math.min(8, Math.round(v / 5)))
          : v,
      depth: (v: number | string) =>
        typeof v === 'number'
          ? Math.max(1, Math.min(6, Math.round(v)))
          : v,
      lines: (v: number | string) =>
        typeof v === 'number'
          ? Math.round((v / 200) * 120) // scale to seconds
          : v,
    },
  },

  // -- music → code ---------------------------------------------------------
  'music→code': {
    source: 'music',
    target: 'code',
    techniqueMap: {
      voice_count: 'function_count',
      harmony_layers: 'nesting',
      duration: 'loc',
    },
    decisionMap: {
      voices: (v: number | string) =>
        typeof v === 'number'
          ? v * 5
          : v,
      layers: (v: number | string) =>
        typeof v === 'number'
          ? Math.max(1, Math.round(v))
          : v,
      seconds: (v: number | string) =>
        typeof v === 'number'
          ? Math.round((v / 120) * 200)
          : v,
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the composite key used by `DOMAIN_MAPPINGS`.
 * Falls back to identity mapping when no explicit mapping exists.
 */
function mappingKey(source: CreativeDomain, target: CreativeDomain): string {
  return `${source}→${target}`;
}

/**
 * Compute a creativity level (0–1) for a transfer.
 * Higher when the mapping is "distant" (fewer shared axes) or when more
 * decisions are adapted.
 */
function computeCreativity(
  mapping: CrossoverMapping | undefined,
  decisionCount: number,
  creativityHint?: number,
): number {
  if (creativityHint !== undefined) {
    return Math.max(0, Math.min(1, creativityHint));
  }
  // Base creativity from how many decisions were transformed.
  const decisionScore = Math.min(decisionCount / 4, 1);
  // Mapping distance bonus — unmapped (fallback) pairs are "more creative".
  const distanceBonus = mapping ? 0 : 0.3;
  return Math.round(Math.min(1, 0.4 + decisionScore * 0.4 + distanceBonus) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transfer a technique from one creative domain to another.
 *
 * Looks up the appropriate `CrossoverMapping`.  If a direct mapping exists the
 * technique name and each decision value are translated via the mapping's
 * `techniqueMap` and `decisionMap`.  When no mapping is found the technique
 * and decisions pass through unchanged (identity transfer) with an elevated
 * creativity score to reflect the exploratory nature of the unknown pairing.
 *
 * @param source     - Origin domain.
 * @param target     - Destination domain.
 * @param technique  - Name of the technique in the source domain.
 * @param decisions  - Key-value decisions to adapt.
 * @param creativity - Optional 0–1 hint; when omitted it is derived
 *                     automatically.
 * @returns A `CrossoverResult` describing the transferred output.
 */
export function crossoverReasoning(
  source: CreativeDomain,
  target: CreativeDomain,
  technique: string,
  decisions: Record<string, string | number>,
  creativity?: number,
): CrossoverResult {
  const key = mappingKey(source, target);
  const mapping = DOMAIN_MAPPINGS[key];

  // --- technique transfer ---------------------------------------------------
  let transferredTechniques: string[];

  if (mapping) {
    transferredTechniques = [mapping.techniqueMap[technique] ?? `${technique}_as_${target}`];
  } else {
    // Identity fallback — no explicit mapping.
    transferredTechniques = [`${technique}_as_${target}`];
  }

  // --- decision adaptation --------------------------------------------------
  const adaptedDecisions: Record<string, string | number> = {};

  for (const [dKey, dValue] of Object.entries(decisions)) {
    if (mapping?.decisionMap[dKey]) {
      adaptedDecisions[dKey] = mapping.decisionMap[dKey](dValue);
    } else {
      adaptedDecisions[dKey] = dValue;
    }
  }

  return {
    sourceDomain: source,
    targetDomain: target,
    transferredTechniques,
    adaptedDecisions,
    creativityLevel: computeCreativity(mapping, Object.keys(adaptedDecisions).length, creativity),
  };
}

/**
 * Fuse techniques from multiple weighted source domains into a single hybrid.
 *
 * Each source contributes a technique weighted by `weight` (higher = more
 * influence).  The resulting `hybridTechnique` is a hyphenated composite of
 * all techniques, ordered by weight descending.
 *
 * @param sources - Array of domain/technique/weight triples.
 * @returns An object with the `hybridTechnique` string and the list of
 *          contributing `domains`.
 */
export function combineReasoning(
  sources: Array<{ domain: CreativeDomain; technique: string; weight: number }>,
): { hybridTechnique: string; domains: CreativeDomain[] } {
  if (sources.length === 0) {
    return { hybridTechnique: '', domains: [] };
  }

  // Sort by weight descending so the highest-weighted domain leads the name.
  const sorted = [...sources].sort((a, b) => b.weight - a.weight);

  const hybridTechnique = sorted.map((s) => s.technique).join('-');
  const domains = sorted.map((s) => s.domain);

  return { hybridTechnique, domains };
}
