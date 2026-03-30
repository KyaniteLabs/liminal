// ---------------------------------------------------------------------------
// ColorExtractor – dominant color extraction from code strings
// Parses #hex, rgb(), hsl(), and named CSS colors, then analyzes harmony.
// Inspired by mcp-video's K-means color extraction approach.
// Pure TypeScript / ESM, zero external deps.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Red-Green-Blue colour value (each channel 0-255). */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Hue-Saturation-Lightness colour value (h 0-360, s 0-100, l 0-100). */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/** A single extracted colour with multiple representations and metadata. */
export interface ExtractedColor {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  frequency: number;
  name?: string;
}

/** Full result of colour extraction and harmony analysis. */
export interface ColorExtractionResult {
  colors: ExtractedColor[];
  dominant: ExtractedColor;
  palette: string[];
  harmony:
    | 'monochromatic'
    | 'analogous'
    | 'complementary'
    | 'triadic'
    | 'split-complementary'
    | 'tetradic'
    | 'unknown';
}

// ---------------------------------------------------------------------------
// Named-colour lookup (20 most common CSS colours)
// ---------------------------------------------------------------------------

const NAMED_COLORS: ReadonlyMap<string, string> = new Map([
  ['000000', 'black'],
  ['ffffff', 'white'],
  ['ff0000', 'red'],
  ['00ff00', 'green'],
  ['0000ff', 'blue'],
  ['ffff00', 'yellow'],
  ['00ffff', 'cyan'],
  ['ff00ff', 'magenta'],
  ['c0c0c0', 'silver'],
  ['808080', 'gray'],
  ['800000', 'maroon'],
  ['808000', 'olive'],
  ['008000', 'darkgreen'],
  ['800080', 'purple'],
  ['008080', 'teal'],
  ['000080', 'navy'],
  ['ffA500', 'orange'],
  ['ffc0cb', 'pink'],
  ['a52a2a', 'brown'],
  ['f5f5dc', 'beige'],
]);

const CSS_NAMED_TO_HEX: ReadonlyMap<string, string> = new Map([
  ['black', '#000000'],
  ['white', '#ffffff'],
  ['red', '#ff0000'],
  ['green', '#00ff00'],
  ['blue', '#0000ff'],
  ['yellow', '#ffff00'],
  ['cyan', '#00ffff'],
  ['magenta', '#ff00ff'],
  ['silver', '#c0c0c0'],
  ['gray', '#808080'],
  ['grey', '#808080'],
  ['maroon', '#800000'],
  ['olive', '#808000'],
  ['darkgreen', '#008000'],
  ['purple', '#800080'],
  ['teal', '#008080'],
  ['navy', '#000080'],
  ['orange', '#ffa500'],
  ['pink', '#ffc0cb'],
  ['beige', '#f5f5dc'],
  ['lime', '#00ff00'],
  ['aqua', '#00ffff'],
  ['fuchsia', '#ff00ff'],
  ['indigo', '#4b0082'],
  ['violet', '#ee82ee'],
  ['coral', '#ff7f50'],
  ['tomato', '#ff6347'],
  ['gold', '#ffd700'],
  ['khaki', '#f0e68c'],
  ['salmon', '#fa8072'],
  ['crimson', '#dc143c'],
  ['turquoise', '#40e0d0'],
  ['chocolate', '#d2691e'],
  ['sienna', '#a0522d'],
  ['peru', '#cd853f'],
  ['orchid', '#da70d6'],
  ['plum', '#dda0dd'],
  ['tan', '#d2b48c'],
  ['thistle', '#d8bfd8'],
  ['wheat', '#f5deb3'],
]);

// ---------------------------------------------------------------------------
// Colour conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert an RGB value to a hex string (e.g. `{r:255,g:0,b:0}` → `"#ff0000"`).
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convert a hex string to an RGB value.
 * Accepts `#RRGGBB` and `#RGB` shorthand.
 * Returns `null` if the hex string is malformed.
 */
export function hexToRgb(hex: string): RGB | null {
  const cleaned = hex.replace(/^#/, '');

  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }

  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }

  return null;
}

/**
 * Convert an RGB value to HSL.
 * Returns H (0-360), S (0-100), L (0-100).
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Look up a human-readable name for a hex colour from the 20 most common
 * named CSS colours. Returns `undefined` when no match is found.
 */
export function getNamedColor(hex: string): string | undefined {
  const cleaned = hex.replace(/^#/, '').toLowerCase();
  return NAMED_COLORS.get(cleaned);
}

// ---------------------------------------------------------------------------
// Regex patterns for colour extraction from code strings
// ---------------------------------------------------------------------------

/** Matches #RRGGBB hex colours (must not be preceded by a word char). */
const HEX6_RE = /(?<![a-zA-Z0-9])#([0-9a-fA-F]{6})\b/g;

/** Matches #RGB shorthand hex colours. */
const HEX3_RE = /(?<![a-zA-Z0-9])#([0-9a-fA-F]{3})\b/g;

/** Matches rgb() and rgba() function calls. */
const RGB_FN_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;

/** Matches hsl() function calls. */
const HSL_FN_RE = /hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%/g;

/** Matches CSS named colours (word boundaries only). */
const NAMED_RE =
  /\b(black|white|red|green|blue|yellow|cyan|magenta|silver|gray|grey|maroon|olive|darkgreen|purple|teal|navy|orange|pink|beige|lime|aqua|fuchsia|indigo|violet|coral|tomato|gold|khaki|salmon|crimson|turquoise|chocolate|sienna|peru|orchid|plum|tan|thistle|wheat)\b/gi;

// ---------------------------------------------------------------------------
// Harmony detection
// ---------------------------------------------------------------------------

/** Normalise a hue into the [0, 360) range. */
function normaliseHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/** Compute the shortest angular distance between two hues (0-180). */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(normaliseHue(a) - normaliseHue(b));
  return Math.min(diff, 360 - diff);
}

/**
 * Analyse hue relationships across a set of HSL colours and classify the
 * palette harmony. Returns `'unknown'` when there are fewer than two unique
 * hues or the colours are too achromatic to classify.
 */
export function detectHarmony(
  colors: HSL[],
): ColorExtractionResult['harmony'] {
  // Filter out achromatic colours (very low saturation)
  const chromatic = colors.filter((c) => c.s > 10);
  if (chromatic.length < 2) {
    return chromatic.length === 0 ? 'unknown' : 'monochromatic';
  }

  // Deduplicate hues (bucket into 10-degree bins)
  const hueBuckets = new Map<number, number>();
  for (const c of chromatic) {
    const bucket = Math.round(normaliseHue(c.h) / 10) * 10;
    hueBuckets.set(bucket, (hueBuckets.get(bucket) ?? 0) + 1);
  }

  const uniqueHues = Array.from(hueBuckets.keys());

  // Single hue → monochromatic
  if (uniqueHues.length === 1) return 'monochromatic';

  // Sort hues for consistent analysis
  const sorted = uniqueHues.map((h) => normaliseHue(h)).sort((a, b) => a - b);

  // Check for complementary (two hues ~180 deg apart)
  if (sorted.length === 2) {
    const dist = hueDistance(sorted[0], sorted[1]);
    if (dist >= 160 && dist <= 200) return 'complementary';
    if (dist <= 60) return 'analogous';
    // Could be split-complementary if one hue is ~150 and another ~210 from a base
    return 'unknown';
  }

  if (sorted.length === 3) {
    // Triadic: three hues ~120 deg apart
    const d01 = hueDistance(sorted[0], sorted[1]);
    const d12 = hueDistance(sorted[1], sorted[2]);
    const d02 = hueDistance(sorted[0], sorted[2]);
    const near120 = (d: number) => d >= 100 && d <= 140;
    if (near120(d01) && near120(d12) && near120(d02)) return 'triadic';

    // Split-complementary: one main hue + two hues ~150 and ~210 from it
    const base = sorted[0];
    const d1 = hueDistance(base, sorted[1]);
    const d2 = hueDistance(base, sorted[2]);
    const near150 = (d: number) => d >= 130 && d <= 170;
    if (near150(d1) && near150(d2)) return 'split-complementary';
  }

  if (sorted.length === 4) {
    // Tetradic: four hues roughly 90 deg apart
    let isTetradic = true;
    for (let i = 0; i < sorted.length - 1; i++) {
      const dist = hueDistance(sorted[i], sorted[i + 1]);
      if (dist < 70 || dist > 110) {
        isTetradic = false;
        break;
      }
    }
    if (isTetradic) return 'tetradic';
  }

  // Check if all hues are within 60 deg → analogous
  const maxSpan =
    hueDistance(sorted[0], sorted[sorted.length - 1]) +
    (sorted.length > 2 ? 0 : 0);
  if (maxSpan <= 60) return 'analogous';

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

/**
 * Parse a code string for colour values (`#hex`, `rgb()`, `hsl()`, named CSS
 * colours) and return an analysed extraction result with harmony classification.
 *
 * The function deduplicates identical hex values and counts frequency of
 * occurrence, making the most-referenced colour the dominant one.
 */
export function extractColorsFromCode(code: string): ColorExtractionResult {
  const colorMap = new Map<
    string,
    { rgb: RGB; hsl: HSL; count: number; name?: string }
  >();

  const addColor = (hex: string, rgb: RGB, hsl: HSL): void => {
    const key = hex.toLowerCase();
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, {
        rgb,
        hsl,
        count: 1,
        name: getNamedColor(hex),
      });
    }
  };

  // --- #RRGGBB ---
  let match: RegExpExecArray | null;
  HEX6_RE.lastIndex = 0;
  while ((match = HEX6_RE.exec(code)) !== null) {
    const hex = `#${match[1]}`;
    const rgb = hexToRgb(hex);
    if (rgb) {
      const hsl = rgbToHsl(rgb);
      addColor(hex.toLowerCase(), rgb, hsl);
    }
  }

  // --- #RGB shorthand (only if not already matched as 6-digit) ---
  HEX3_RE.lastIndex = 0;
  while ((match = HEX3_RE.exec(code)) !== null) {
    const shorthand = match[1];
    const expanded = `#${shorthand[0]}${shorthand[0]}${shorthand[1]}${shorthand[1]}${shorthand[2]}${shorthand[2]}`;
    const key = expanded.toLowerCase();
    if (!colorMap.has(key)) {
      const rgb = hexToRgb(expanded);
      if (rgb) {
        const hsl = rgbToHsl(rgb);
        addColor(key, rgb, hsl);
      }
    }
  }

  // --- rgb() / rgba() ---
  RGB_FN_RE.lastIndex = 0;
  while ((match = RGB_FN_RE.exec(code)) !== null) {
    const r = Math.min(255, parseInt(match[1], 10));
    const g = Math.min(255, parseInt(match[2], 10));
    const b = Math.min(255, parseInt(match[3], 10));
    const rgb: RGB = { r, g, b };
    const hex = rgbToHex(rgb);
    const hsl = rgbToHsl(rgb);
    addColor(hex.toLowerCase(), rgb, hsl);
  }

  // --- hsl() ---
  HSL_FN_RE.lastIndex = 0;
  while ((match = HSL_FN_RE.exec(code)) !== null) {
    const h = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    const l = parseInt(match[3], 10);
    // Convert HSL back to RGB for consistent storage
    const rgb = hslToRgb(h, s, l);
    const hex = rgbToHex(rgb);
    const hslObj: HSL = { h, s, l };
    addColor(hex.toLowerCase(), rgb, hslObj);
  }

  // --- Named CSS colours ---
  NAMED_RE.lastIndex = 0;
  while ((match = NAMED_RE.exec(code)) !== null) {
    const name = match[1].toLowerCase();
    const hex = CSS_NAMED_TO_HEX.get(name);
    if (hex) {
      const rgb = hexToRgb(hex);
      if (rgb) {
        const hsl = rgbToHsl(rgb);
        addColor(hex.toLowerCase(), rgb, hsl);
      }
    }
  }

  // --- Build result ---
  const entries = Array.from(colorMap.entries()).sort(
    (a, b) => b[1].count - a[1].count,
  );

  if (entries.length === 0) {
    // Default to black when no colours are found
    const fallback: ExtractedColor = {
      hex: '#000000',
      rgb: { r: 0, g: 0, b: 0 },
      hsl: { h: 0, s: 0, l: 0 },
      frequency: 1,
      name: 'black',
    };
    return {
      colors: [fallback],
      dominant: fallback,
      palette: ['#000000'],
      harmony: 'monochromatic',
    };
  }

  const colors: ExtractedColor[] = entries.map(([hex, data]) => ({
    hex,
    rgb: data.rgb,
    hsl: data.hsl,
    frequency: data.count,
    name: data.name,
  }));

  const dominant = colors[0];
  const palette = colors.map((c) => c.hex);
  const harmony = detectHarmony(colors.map((c) => c.hsl));

  return { colors, dominant, palette, harmony };
}

// ---------------------------------------------------------------------------
// Internal: HSL → RGB conversion
// ---------------------------------------------------------------------------

/**
 * Convert HSL (h 0-360, s 0-100, l 0-100) to RGB (0-255 each).
 */
function hslToRgb(h: number, s: number, l: number): RGB {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const hNorm = normaliseHue(h) / 360;

  if (sNorm === 0) {
    const v = Math.round(lNorm * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q =
    lNorm < 0.5
      ? lNorm * (1 + sNorm)
      : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}
