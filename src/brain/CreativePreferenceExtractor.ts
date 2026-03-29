/**
 * CreativePreferenceExtractor — extracts creative preferences from user
 * interactions and conversation history. Inspired by Print-OS's memory_service.py.
 *
 * Analyses prompt text and conversation messages for style, color, technique,
 * complexity, mood, domain, and interaction signals. Stores extracted
 * preferences with confidence scores and supports merge-deduplication.
 *
 * Pure TypeScript, ESM, zero external dependencies.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Categories of creative preference the extractor can identify. */
export type PreferenceCategory =
  | 'style'
  | 'color'
  | 'technique'
  | 'domain'
  | 'complexity'
  | 'mood'
  | 'interaction';

/** A single extracted preference with provenance metadata. */
export interface CreativePreference {
  /** Which creative axis this preference describes. */
  category: PreferenceCategory;
  /** The normalised value string (e.g. "minimalist", "warm", "particle"). */
  value: string;
  /** 0-1 confidence in this extraction. */
  confidence: number;
  /** Origin — "prompt", "conversation", or a caller-supplied label. */
  source: string;
  /** Unix epoch millis when this preference was first recorded. */
  timestamp: number;
  /** How many times this preference has been matched or referenced. */
  usageCount: number;
}

/** Aggregate result returned by {@link CreativePreferenceExtractor.extractFromConversation}. */
export interface PreferenceExtractionResult {
  /** All preferences discovered in this extraction pass. */
  preferences: CreativePreference[];
  /** The single highest-confidence style value, if any. */
  dominantStyle?: string;
  /** 0-1 measure of how complete the user's creative profile is
   *  (fraction of categories with at least one preference). */
  profileCompleteness: number;
}

/** Summary of the user's creative identity, aggregated across all stored preferences. */
export interface DominantProfile {
  style: string;
  complexity: string;
  mood: string;
  domains: string[];
}

// ---------------------------------------------------------------------------
// Keyword maps
// ---------------------------------------------------------------------------

/** Style-related keywords mapped to their canonical label. */
const STYLE_KEYWORDS: Record<string, string> = {
  minimalist: 'minimalist',
  minimal: 'minimalist',
  clean: 'minimalist',
  simple: 'minimalist',
  bare: 'minimalist',
  maximalist: 'maximalist',
  maximal: 'maximalist',
  busy: 'maximalist',
  dense: 'maximalist',
  ornate: 'maximalist',
  organic: 'organic',
  natural: 'organic',
  flowing: 'organic',
  fluid: 'organic',
  soft: 'organic',
  geometric: 'geometric',
  angular: 'geometric',
  sharp: 'geometric',
  structured: 'geometric',
  mathematical: 'geometric',
  glitch: 'glitch',
  corrupted: 'glitch',
  broken: 'glitch',
  distorted: 'glitch',
  noisy: 'glitch',
  retro: 'retro',
  vintage: 'retro',
  nostalgic: 'retro',
  '8bit': 'retro',
  pixelated: 'retro',
  futuristic: 'futuristic',
  cyber: 'futuristic',
  sci: 'futuristic',
  'sci-fi': 'futuristic',
  neon: 'futuristic',
  abstract: 'abstract',
  nonrepresentational: 'abstract',
  surreal: 'abstract',
  experimental: 'abstract',
};

/** Colour-palette keywords mapped to their canonical label. */
const COLOR_KEYWORDS: Record<string, string> = {
  warm: 'warm',
  red: 'warm',
  orange: 'warm',
  yellow: 'warm',
  amber: 'warm',
  golden: 'warm',
  cool: 'cool',
  blue: 'cool',
  cyan: 'cool',
  teal: 'cool',
  icy: 'cool',
  monochrome: 'monochrome',
  grayscale: 'monochrome',
  blackwhite: 'monochrome',
  bw: 'monochrome',
  greyscale: 'monochrome',
  vibrant: 'vibrant',
  saturated: 'vibrant',
  vivid: 'vibrant',
  bold: 'vibrant',
  rich: 'vibrant',
  pastel: 'pastel',
  light: 'pastel',
  muted: 'pastel',
  soft: 'pastel',
  delicate: 'pastel',
  neon: 'neon',
  glowing: 'neon',
  electric: 'neon',
  fluorescent: 'neon',
  luminous: 'neon',
  earthy: 'earthy',
  natural: 'earthy',
  brown: 'earthy',
  green: 'earthy',
  terracotta: 'earthy',
};

/** Technique keywords mapped to their canonical label. */
const TECHNIQUE_KEYWORDS: Record<string, string> = {
  particle: 'particle',
  particles: 'particle',
  emitter: 'particle',
  pointcloud: 'particle',
  'point-cloud': 'particle',
  flowfield: 'flow-field',
  'flow-field': 'flow-field',
  flow: 'flow-field',
  vector: 'flow-field',
  curl: 'flow-field',
  noise: 'noise',
  perlin: 'noise',
  simplex: 'noise',
  'value-noise': 'noise',
  fractal: 'fractal',
  mandelbrot: 'fractal',
  julia: 'fractal',
  'self-similar': 'fractal',
  iterated: 'fractal',
  'cellular-automata': 'cellular-automata',
  cellular: 'cellular-automata',
  conway: 'cellular-automata',
  gol: 'cellular-automata',
  'game-of-life': 'cellular-automata',
  recursion: 'recursion',
  recursive: 'recursion',
  lsystem: 'recursion',
  'l-system': 'recursion',
  subdivision: 'recursion',
};

/** Complexity-level keywords mapped to their canonical label. */
const COMPLEXITY_KEYWORDS: Record<string, string> = {
  simple: 'simple',
  clean: 'simple',
  minimal: 'simple',
  sparse: 'simple',
  basic: 'simple',
  complex: 'complex',
  dense: 'complex',
  layered: 'complex',
  intricate: 'complex',
  elaborate: 'complex',
  deep: 'complex',
  rich: 'complex',
};

/** Mood-related keywords mapped to their canonical label. */
const MOOD_KEYWORDS: Record<string, string> = {
  calm: 'calm',
  peaceful: 'calm',
  serene: 'calm',
  tranquil: 'calm',
  relaxing: 'calm',
  gentle: 'calm',
  quiet: 'calm',
  energetic: 'energetic',
  dynamic: 'energetic',
  active: 'energetic',
  lively: 'energetic',
  kinetic: 'energetic',
  intense: 'energetic',
  powerful: 'energetic',
  dark: 'dark',
  moody: 'dark',
  shadowy: 'dark',
  ominous: 'dark',
  gothic: 'dark',
  noir: 'dark',
  bright: 'bright',
  cheerful: 'bright',
  joyful: 'bright',
  optimistic: 'bright',
  sunny: 'bright',
  light: 'bright',
  mysterious: 'mysterious',
  enigmatic: 'mysterious',
  cryptic: 'mysterious',
  arcane: 'mysterious',
  esoteric: 'mysterious',
  secretive: 'mysterious',
  playful: 'playful',
  fun: 'playful',
  whimsical: 'playful',
  quirky: 'playful',
  fanciful: 'playful',
  mischievous: 'playful',
};

/** Domain keywords mapped to canonical domain names. */
const DOMAIN_KEYWORDS: Record<string, string> = {
  p5: 'p5',
  p5js: 'p5',
  'p5.js': 'p5',
  processing: 'p5',
  shader: 'shader',
  glsl: 'shader',
  fragment: 'shader',
  vertex: 'shader',
  webgl: 'shader',
  three: 'three',
  threejs: 'three',
  'three.js': 'three',
  '3d': 'three',
  webgl3d: 'three',
  hydra: 'hydra',
  synths: 'hydra',
  videosynth: 'hydra',
  strudel: 'strudel',
  music: 'music',
  audio: 'music',
  sound: 'music',
  sonic: 'music',
};

/** Interaction-pattern keywords. */
const INTERACTION_KEYWORDS: Record<string, string> = {
  mouse: 'mouse-driven',
  click: 'mouse-driven',
  hover: 'mouse-driven',
  drag: 'mouse-driven',
  touch: 'touch-driven',
  tap: 'touch-driven',
  swipe: 'touch-driven',
  gesture: 'touch-driven',
  keyboard: 'keyboard-driven',
  key: 'keyboard-driven',
  typing: 'keyboard-driven',
  midi: 'midi-driven',
  controller: 'midi-driven',
  osc: 'midi-driven',
  microphone: 'audio-reactive',
  mic: 'audio-reactive',
  'audio-reactive': 'audio-reactive',
  'sound-reactive': 'audio-reactive',
  webcam: 'camera-driven',
  camera: 'camera-driven',
  video: 'camera-driven',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a regex that matches any of the map's keys as whole-word tokens.
 * Keys are sorted longest-first so that compound words (e.g. "cellular-automata")
 * take precedence over shorter substrings.
 */
function buildKeywordRegex(keywords: Record<string, string>): RegExp {
  const sorted = Object.keys(keywords).sort((a, b) => b.length - a.length);
  const pattern = sorted.map(escapeRegex).join('|');
  return new RegExp(`\\b(?:${pattern})\\b`, 'gi');
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Produce a stable map key from a category + canonical value. */
function preferenceKey(category: PreferenceCategory, value: string): string {
  return `${category}::${value}`;
}

// ---------------------------------------------------------------------------
// CreativePreferenceExtractor
// ---------------------------------------------------------------------------

/**
 * Extracts creative preferences from prompt text and conversation history.
 *
 * Uses keyword maps to identify style, colour, technique, complexity, mood,
 * domain, and interaction signals.  Stores extracted preferences with
 * confidence scores and supports confidence-weighted merge-deduplication.
 */
export class CreativePreferenceExtractor {
  /** Internal preference store keyed by "category::value". */
  private preferences: Map<string, CreativePreference>;

  // Pre-compiled keyword regexes (built once, reused on every extraction).
  private readonly styleRegex: RegExp;
  private readonly colorRegex: RegExp;
  private readonly techniqueRegex: RegExp;
  private readonly complexityRegex: RegExp;
  private readonly moodRegex: RegExp;
  private readonly domainRegex: RegExp;
  private readonly interactionRegex: RegExp;

  constructor() {
    this.preferences = new Map();
    this.styleRegex = buildKeywordRegex(STYLE_KEYWORDS);
    this.colorRegex = buildKeywordRegex(COLOR_KEYWORDS);
    this.techniqueRegex = buildKeywordRegex(TECHNIQUE_KEYWORDS);
    this.complexityRegex = buildKeywordRegex(COMPLEXITY_KEYWORDS);
    this.moodRegex = buildKeywordRegex(MOOD_KEYWORDS);
    this.domainRegex = buildKeywordRegex(DOMAIN_KEYWORDS);
    this.interactionRegex = buildKeywordRegex(INTERACTION_KEYWORDS);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Analyse a single prompt string for creative-preference signals.
   *
   * Scans for style, colour, technique, complexity, mood, domain, and
   * interaction keywords.  Each match is recorded as a {@link CreativePreference}
   * with a confidence score proportional to the number of distinct keyword
   * variations matched for that canonical value.
   *
   * @param prompt - The raw prompt text to analyse.
   * @returns An array of newly extracted preferences (also stored internally).
   */
  extractFromPrompt(prompt: string): CreativePreference[] {
    const extracted: CreativePreference[] = [];
    const text = prompt.toLowerCase();
    const now = Date.now();

    const matchers: Array<{
      regex: RegExp;
      map: Record<string, string>;
      category: PreferenceCategory;
      source: string;
    }> = [
      { regex: this.styleRegex, map: STYLE_KEYWORDS, category: 'style', source: 'prompt' },
      { regex: this.colorRegex, map: COLOR_KEYWORDS, category: 'color', source: 'prompt' },
      { regex: this.techniqueRegex, map: TECHNIQUE_KEYWORDS, category: 'technique', source: 'prompt' },
      { regex: this.complexityRegex, map: COMPLEXITY_KEYWORDS, category: 'complexity', source: 'prompt' },
      { regex: this.moodRegex, map: MOOD_KEYWORDS, category: 'mood', source: 'prompt' },
      { regex: this.domainRegex, map: DOMAIN_KEYWORDS, category: 'domain', source: 'prompt' },
      { regex: this.interactionRegex, map: INTERACTION_KEYWORDS, category: 'interaction', source: 'prompt' },
    ];

    for (const { regex, map, category, source } of matchers) {
      // Collect canonical values and their raw keyword hit counts.
      const hits = new Map<string, Set<string>>();

      let match: RegExpExecArray | null;
      // Reset lastIndex for global regex reuse.
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[0].toLowerCase();
        const canonical = map[raw];
        if (canonical) {
          if (!hits.has(canonical)) {
            hits.set(canonical, new Set());
          }
          hits.get(canonical)!.add(raw);
        }
      }

      for (const [canonical, rawKeywords] of hits) {
        // More distinct keyword variants => higher confidence, capped at 1.
        const confidence = Math.min(0.3 + rawKeywords.size * 0.2, 1);
        const pref: CreativePreference = {
          category,
          value: canonical,
          confidence,
          source,
          timestamp: now,
          usageCount: 1,
        };

        extracted.push(pref);
      }
    }

    // Merge everything into the persistent store.
    this.mergePreferences(extracted);

    return extracted;
  }

  /**
   * Scan an entire conversation for preference signals.
   *
   * Iterates over every message, extracting preferences from each one, then
   * produces an aggregate result with a dominant style and a profile-completeness
   * metric (fraction of the seven categories that have at least one stored
   * preference).
   *
   * @param messages - Conversation turns with role and content fields.
   * @returns A {@link PreferenceExtractionResult} summarising the extraction pass.
   */
  extractFromConversation(
    messages: Array<{ role: string; content: string }>,
  ): PreferenceExtractionResult {
    const allExtracted: CreativePreference[] = [];

    for (const message of messages) {
      // Weight user messages slightly more via a source label.
      const source = message.role === 'user' ? 'conversation:user' : 'conversation:assistant';
      const text = message.content.toLowerCase();

      const prefs = this.extractFromText(text, source);
      allExtracted.push(...prefs);
    }

    // Merge into persistent store.
    this.mergePreferences(allExtracted);

    // Determine dominant style (highest-confidence style preference).
    const stylePrefs = this.getTopPreferences('style', 1);
    const dominantStyle = stylePrefs.length > 0 ? stylePrefs[0].value : undefined;

    // Profile completeness: fraction of categories with >= 1 preference.
    const categories = new Set<PreferenceCategory>();
    for (const pref of this.preferences.values()) {
      categories.add(pref.category);
    }
    const totalCategories = 7; // style | color | technique | domain | complexity | mood | interaction
    const profileCompleteness = categories.size / totalCategories;

    return {
      preferences: allExtracted,
      dominantStyle,
      profileCompleteness,
    };
  }

  /**
   * Return all stored preferences sorted by descending confidence.
   *
   * @returns A copy of the full preference list, highest confidence first.
   */
  getPreferences(): CreativePreference[] {
    return Array.from(this.preferences.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  /**
   * Return the top-N preferences for a given category, sorted by confidence.
   *
   * @param category - The preference category to filter by.
   * @param count    - Maximum number of preferences to return (default 5).
   * @returns Filtered and sorted preferences.
   */
  getTopPreferences(
    category: PreferenceCategory,
    count: number = 5,
  ): CreativePreference[] {
    return Array.from(this.preferences.values())
      .filter((p) => p.category === category)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, count);
  }

  /**
   * Produce an aggregate creative-identity profile for the user.
   *
   * Picks the single highest-confidence preference for style, complexity, and
   * mood, and collects all domain values.
   *
   * @returns A {@link DominantProfile} summarising the user's creative identity.
   */
  getDominantProfile(): DominantProfile {
    const topStyle = this.getTopPreferences('style', 1);
    const topComplexity = this.getTopPreferences('complexity', 1);
    const topMood = this.getTopPreferences('mood', 1);
    const domainPrefs = this.getTopPreferences('domain', 10);

    return {
      style: topStyle.length > 0 ? topStyle[0].value : 'unknown',
      complexity: topComplexity.length > 0 ? topComplexity[0].value : 'unknown',
      mood: topMood.length > 0 ? topMood[0].value : 'unknown',
      domains: domainPrefs.map((p) => p.value),
    };
  }

  /**
   * Merge incoming preferences into the persistent store with
   * confidence-weighted deduplication.
   *
   * When an incoming preference matches an existing one (same category + value),
   * the confidence is updated to the weighted average and usageCount is
   * incremented.  New preferences are simply inserted.
   *
   * @param incoming - Preferences to merge in.
   */
  mergePreferences(incoming: CreativePreference[]): void {
    for (const pref of incoming) {
      const key = preferenceKey(pref.category, pref.value);
      const existing = this.preferences.get(key);

      if (existing) {
        // Weighted average — bias towards the higher confidence, with a bonus
        // for repeated observation.
        const totalUsage = existing.usageCount + pref.usageCount;
        existing.confidence = Math.min(
          (existing.confidence * existing.usageCount +
            pref.confidence * pref.usageCount) /
            totalUsage +
            0.05 * pref.usageCount,
          1,
        );
        existing.usageCount = totalUsage;
        // Keep the most recent timestamp.
        existing.timestamp = Math.max(existing.timestamp, pref.timestamp);
        // Broaden the source label if they differ.
        if (existing.source !== pref.source) {
          existing.source = `${existing.source}+${pref.source}`;
        }
      } else {
        this.preferences.set(key, { ...pref });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Low-level extraction from a single text string.
   *
   * Unlike {@link extractFromPrompt} this does NOT automatically merge into the
   * store — the caller decides when to merge.
   */
  private extractFromText(
    text: string,
    source: string,
  ): CreativePreference[] {
    const extracted: CreativePreference[] = [];
    const now = Date.now();

    const matchers: Array<{
      regex: RegExp;
      map: Record<string, string>;
      category: PreferenceCategory;
    }> = [
      { regex: this.styleRegex, map: STYLE_KEYWORDS, category: 'style' },
      { regex: this.colorRegex, map: COLOR_KEYWORDS, category: 'color' },
      { regex: this.techniqueRegex, map: TECHNIQUE_KEYWORDS, category: 'technique' },
      { regex: this.complexityRegex, map: COMPLEXITY_KEYWORDS, category: 'complexity' },
      { regex: this.moodRegex, map: MOOD_KEYWORDS, category: 'mood' },
      { regex: this.domainRegex, map: DOMAIN_KEYWORDS, category: 'domain' },
      { regex: this.interactionRegex, map: INTERACTION_KEYWORDS, category: 'interaction' },
    ];

    for (const { regex, map, category } of matchers) {
      const hits = new Map<string, Set<string>>();

      let match: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[0].toLowerCase();
        const canonical = map[raw];
        if (canonical) {
          if (!hits.has(canonical)) {
            hits.set(canonical, new Set());
          }
          hits.get(canonical)!.add(raw);
        }
      }

      for (const [canonical, rawKeywords] of hits) {
        const confidence = Math.min(0.3 + rawKeywords.size * 0.2, 1);
        extracted.push({
          category,
          value: canonical,
          confidence,
          source,
          timestamp: now,
          usageCount: 1,
        });
      }
    }

    return extracted;
  }
}
