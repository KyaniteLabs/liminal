/**
 * CreativeNotation — Compact notation schema for creative instructions.
 * Static registry of shorthand tokens encoding creative directives (domain,
 * style, mood, technique, avoidance) into dense strings like
 * "~d:shader ~s:organic ~m:dark" with bidirectional English conversion.
 *
 * Complements SymbolicCreativeLanguage (emergent, dynamic) by providing a
 * fixed, declarative shorthand for input instructions.
 */

/** Token category — each prefix maps to one category. */
export type NotationCategory = 'domain' | 'style' | 'mood' | 'tech' | 'avoid';

/** A single notation token definition. */
export interface NotationToken {
  /** Shorthand token including prefix, e.g. "~d:shader". */
  token: string;
  /** Semantic category of this token. */
  category: NotationCategory;
  /** Full English expansion. */
  naturalLanguage: string;
  /** One or two example usage strings. */
  examples: string[];
}

const CATEGORY_PREFIX: Record<NotationCategory, string> = {
  domain: '~d',
  style: '~s',
  mood: '~m',
  tech: '~t',
  avoid: '~x',
};

export const NOTATION_REGISTRY: ReadonlyMap<string, NotationToken> = new Map(
  [
    // -- Domains (prefix ~d) --------------------------------------------------
    { token: '~d:p5',       category: 'domain', naturalLanguage: 'p5.js / Processing creative coding',        examples: ['~d:p5 ~s:organic ~m:calm', '~d:p5 ~t:particles'] },
    { token: '~d:shader',   category: 'domain', naturalLanguage: 'GLSL / fragment shader art',                 examples: ['~d:shader ~s:fractal', '~d:shader ~t:noise ~m:ethereal'] },
    { token: '~d:three',    category: 'domain', naturalLanguage: 'Three.js / WebGL 3D scene',                  examples: ['~d:three ~s:geometric ~t:particles', '~d:three ~m:dark'] },
    { token: '~d:hydra',    category: 'domain', naturalLanguage: 'Hydra live-coding video synth',              examples: ['~d:hydra ~s:maximal ~t:noise', '~d:hydra ~t:symmetry'] },
    { token: '~d:strudel',  category: 'domain', naturalLanguage: 'Strudel live-coding audio pattern',          examples: ['~d:strudel ~m:playful', '~d:strudel ~t:audio-reactive'] },
    { token: '~d:tone',     category: 'domain', naturalLanguage: 'Tone.js / Web Audio synthesis',              examples: ['~d:tone ~s:minimal ~m:calm', '~d:tone ~t:recursion'] },

    // -- Styles (prefix ~s) ---------------------------------------------------
    { token: '~s:organic',   category: 'style', naturalLanguage: 'flowing, natural, biomorphic forms',         examples: ['~d:p5 ~s:organic', '~s:organic ~x:straight'] },
    { token: '~s:geometric', category: 'style', naturalLanguage: 'precise shapes, clean angles, grids',        examples: ['~d:three ~s:geometric', '~s:geometric ~t:symmetry'] },
    { token: '~s:minimal',   category: 'style', naturalLanguage: 'sparse, restrained, less-is-more',           examples: ['~s:minimal ~m:calm', '~s:minimal ~x:static'] },
    { token: '~s:maximal',   category: 'style', naturalLanguage: 'dense, layered, over-the-top',               examples: ['~d:hydra ~s:maximal', '~s:maximal ~t:particles ~m:energetic'] },
    { token: '~s:fractal',   category: 'style', naturalLanguage: 'self-similar, recursive, infinite detail',   examples: ['~d:shader ~s:fractal', '~s:fractal ~t:recursion'] },

    // -- Moods (prefix ~m) ----------------------------------------------------
    { token: '~m:ethereal',  category: 'mood', naturalLanguage: 'dreamy, floating, otherworldly',              examples: ['~d:shader ~m:ethereal', '~m:ethereal ~s:organic'] },
    { token: '~m:calm',      category: 'mood', naturalLanguage: 'peaceful, slow, meditative',                  examples: ['~m:calm ~s:minimal', '~d:tone ~m:calm ~t:recursion'] },
    { token: '~m:energetic', category: 'mood', naturalLanguage: 'high energy, fast, vibrant',                  examples: ['~m:energetic ~d:strudel', '~m:energetic ~t:physics'] },
    { token: '~m:dark',      category: 'mood', naturalLanguage: 'shadowy, heavy, ominous',                    examples: ['~d:three ~m:dark', '~m:dark ~s:organic'] },
    { token: '~m:playful',   category: 'mood', naturalLanguage: 'fun, whimsical, lighthearted',                examples: ['~d:strudel ~m:playful', '~m:playful ~s:geometric'] },

    // -- Techniques (prefix ~t) -----------------------------------------------
    { token: '~t:noise',          category: 'tech', naturalLanguage: 'Perlin / simplex noise field',           examples: ['~t:noise ~s:organic', '~d:shader ~t:noise'] },
    { token: '~t:particles',      category: 'tech', naturalLanguage: 'particle system / point cloud',          examples: ['~t:particles ~m:ethereal', '~d:p5 ~t:particles ~t:physics'] },
    { token: '~t:symmetry',       category: 'tech', naturalLanguage: 'mirror / kaleidoscope / rotational symmetry', examples: ['~t:symmetry ~s:geometric', '~d:hydra ~t:symmetry'] },
    { token: '~t:recursion',      category: 'tech', naturalLanguage: 'recursive subdivision or self-reference', examples: ['~t:recursion ~s:fractal', '~d:p5 ~t:recursion ~m:calm'] },
    { token: '~t:physics',        category: 'tech', naturalLanguage: 'physics simulation (gravity, springs)',   examples: ['~t:physics ~m:energetic', '~t:particles ~t:physics'] },
    { token: '~t:audio-reactive', category: 'tech', naturalLanguage: 'driven by audio analysis / FFT',         examples: ['~t:audio-reactive ~d:hydra', '~d:p5 ~t:audio-reactive ~m:dark'] },

    // -- Avoidance rules (prefix ~x) ------------------------------------------
    { token: '~x:grids',   category: 'avoid', naturalLanguage: 'avoid grid-based layouts',                    examples: ['~x:grids ~s:organic', '~x:grids ~x:straight'] },
    { token: '~x:straight', category: 'avoid', naturalLanguage: 'avoid straight lines, prefer curves',        examples: ['~x:straight ~s:organic', '~d:p5 ~x:straight ~x:static'] },
    { token: '~x:static',  category: 'avoid', naturalLanguage: 'avoid static / motionless compositions',      examples: ['~x:static ~t:particles', '~x:static ~m:energetic'] },
    { token: '~x:flat',    category: 'avoid', naturalLanguage: 'avoid flat 2D appearance, add depth',         examples: ['~x:flat ~d:three', '~x:flat ~t:noise'] },
  ].map((entry) => [entry.token, entry as NotationToken]),
);

const PREFIX_TO_CATEGORY: Record<string, NotationCategory> = {
  '~d': 'domain',
  '~s': 'style',
  '~m': 'mood',
  '~t': 'tech',
  '~x': 'avoid',
};

/**
 * Expand a compact notation string into its full English description.
 *
 * Tokens are whitespace-delimited. Unrecognised tokens are passed through
 * unchanged.
 *
 * @example
 * expandNotation('~d:shader ~s:organic ~m:dark')
 * // => 'GLSL / fragment shader art, flowing natural biomorphic forms, shadowy heavy ominous'
 */
export function expandNotation(notation: string): string {
  return notation
    .trim()
    .split(/\s+/)
    .map((raw) => {
      const entry = NOTATION_REGISTRY.get(raw);
      return entry ? entry.naturalLanguage : raw;
    })
    .join(', ');
}

/**
 * Compress a natural-language creative description into compact notation.
 *
 * Searches the description for each token's naturalLanguage text and
 * keywords. Returns a deduplicated notation string ordered by category
 * (domain, style, mood, tech, avoid).
 *
 * @example
 * compressToNotation('GLSL fragment shader art with organic flowing shapes and a dark mood')
 * // => '~d:shader ~s:organic ~m:dark'
 */
export function compressToNotation(description: string): string {
  const lower = description.toLowerCase();
  const matched: NotationToken[] = [];

  for (const entry of NOTATION_REGISTRY.values()) {
    // Check if any significant word from naturalLanguage appears in description
    const keywords = entry.naturalLanguage.toLowerCase().split(/[\s,/]+/).filter((w) => w.length > 3);
    const tokenSuffix = entry.token.split(':')[1] ?? '';
    const hit =
      lower.includes(tokenSuffix) ||
      keywords.some((kw) => lower.includes(kw));
    if (hit) {
      matched.push(entry);
    }
  }

  // Deduplicate by token (first match wins) and sort by category order
  const categoryOrder: NotationCategory[] = ['domain', 'style', 'mood', 'tech', 'avoid'];
  const seen = new Set<string>();
  const ordered = matched
    .filter((t) => {
      if (seen.has(t.token)) return false;
      seen.add(t.token);
      return true;
    })
    .sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));

  return ordered.map((t) => t.token).join(' ');
}

/** Return the notation prefix for a given category (e.g. 'domain' => '~d'). */
export function getPrefix(category: NotationCategory): string {
  return CATEGORY_PREFIX[category];
}

/** Return the category for a given prefix (e.g. '~d' => 'domain'). */
export function getCategory(prefix: string): NotationCategory | undefined {
  return PREFIX_TO_CATEGORY[prefix];
}
