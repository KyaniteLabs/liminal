// ---------------------------------------------------------------------------
// ColorHarmonyCritic – static analysis of colour usage in generative code
// ---------------------------------------------------------------------------

import type {
  AestheticReport,
  AestheticViolation,
  ColorConstraints,
  DesignConstraints,
} from '../types.js';
import type { LIRCodeToken } from '../../core/lir/types.js';
import type { VisualMappingParams } from '../../audio/types.js';

// ---------------------------------------------------------------------------
// Named colour → hue mapping (simplified HSL hue values)
// ---------------------------------------------------------------------------

const NAMED_COLOR_HUES: Record<string, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  lime: 90,
  green: 120,
  teal: 160,
  cyan: 180,
  blue: 240,
  indigo: 260,
  violet: 280,
  purple: 300,
  magenta: 320,
  pink: 340,
  white: -1,
  black: -1,
  gray: -1,
  grey: -1,
};

// ---------------------------------------------------------------------------
// Colour extraction helpers
// ---------------------------------------------------------------------------

/** Extract hex colours (#RGB, #RRGGBB, #RRGGBBAA) */
function extractHexColors(code: string): string[] {
  const re = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  return [...code.matchAll(re)].map(m => m[0]);
}

/** Extract rgb/rgba colours */
function extractRgbColors(code: string): string[] {
  const re = /rgba?\s*\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+/gi;
  return [...code.matchAll(re)].map(m => m[0]);
}

/** Extract hsl/hsla colours and return their hue directly */
function extractHslHues(code: string): number[] {
  const re = /hsla?\s*\(\s*([\d.]+)/gi;
  return [...code.matchAll(re)].map(m => parseFloat(m[1]));
}

/** Extract named colours (as whole words used in colour contexts) */
function extractNamedColorHues(code: string): number[] {
  const hues: number[] = [];
  const namedPattern = new RegExp(
    `\b(${Object.keys(NAMED_COLOR_HUES).join('|')})\b`,
    'gi',
  );
  // Look for named colours anywhere in the code (generous heuristic)
  for (const match of code.matchAll(namedPattern)) {
    const name = match[1].toLowerCase();
    if (NAMED_COLOR_HUES[name] !== undefined) {
      hues.push(NAMED_COLOR_HUES[name]);
    }
  }
  return hues;
}

// ---------------------------------------------------------------------------
// Colour → HSL hue conversion
// ---------------------------------------------------------------------------

/** Convert a hex colour string to an HSL hue (0-360). Returns -1 for achromatic. */
function hexToHue(hex: string): number {
  let cleaned = hex.replace('#', '');
  // Expand shorthand #RGB → #RRGGBB
  if (cleaned.length === 3 || cleaned.length === 4) {
    cleaned =
      cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
  }
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return rgbToHue(r, g, b);
}

/** Parse rgb(...) string and return hue */
function rgbStringToHue(rgb: string): number {
  const nums = rgb.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return -1;
  return rgbToHue(
    parseFloat(nums[0]) / 255,
    parseFloat(nums[1]) / 255,
    parseFloat(nums[2]) / 255,
  );
}

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return -1; // achromatic
  let h = 0;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}

// ---------------------------------------------------------------------------
// Hue comparison
// ---------------------------------------------------------------------------

/** Angular distance between two hues (0-180). */
function hueDistance(a: number, b: number): number {
  if (a < 0 || b < 0) return 999; // achromatic — treat as far apart
  const d = Math.abs(a - b);
  return d > 180 ? 360 - d : d;
}

/** Two hues are "the same colour" within tolerance */
function huesMatch(a: number, b: number, tolerance: number): boolean {
  return hueDistance(a, b) <= tolerance;
}

// ---------------------------------------------------------------------------
// Harmony analysis
// ---------------------------------------------------------------------------

function assessHarmony(hues: number[]): { harmonyScore: number; isComplementary: boolean; isAnalogous: boolean } {
  if (hues.length <= 1) return { harmonyScore: 1.0, isComplementary: false, isAnalogous: true };

  const chromaticHues = hues.filter(h => h >= 0);
  if (chromaticHues.length === 0) return { harmonyScore: 1.0, isComplementary: false, isAnalogous: false };

  let complementaryPairs = 0;
  let analogousPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < chromaticHues.length; i++) {
    for (let j = i + 1; j < chromaticHues.length; j++) {
      const dist = hueDistance(chromaticHues[i], chromaticHues[j]);
      totalPairs++;
      if (dist >= 160 && dist <= 200) complementaryPairs++;
      if (dist <= 60) analogousPairs++;
    }
  }

  const isComplementary = totalPairs > 0 && complementaryPairs / totalPairs >= 0.5;
  const isAnalogous = totalPairs > 0 && analogousPairs / totalPairs >= 0.5;

  // Score based on whether colours are related
  let harmonyScore = 0.5;
  if (isAnalogous) harmonyScore = 0.8;
  if (isComplementary) harmonyScore = 0.9;
  if (chromaticHues.length === 1) harmonyScore = 1.0;

  // Penalty for large spread with no relationships
  if (!isAnalogous && !isComplementary && totalPairs > 0) {
    harmonyScore = Math.max(0.3, harmonyScore - 0.2);
  }

  return { harmonyScore, isComplementary, isAnalogous };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeColorHarmony(
  code: string,
  constraints: DesignConstraints,
): AestheticReport {
  const violations: AestheticViolation[] = [];
  const colorConstraints: ColorConstraints = constraints.color;

  // 1. Extract all colours
  const hexColors = extractHexColors(code);
  const rgbColors = extractRgbColors(code);
  const hslHues = extractHslHues(code);
  const namedHues = extractNamedColorHues(code);

  // 2. Convert to hue values
  const allHues: number[] = [
    ...hexColors.map(hexToHue),
    ...rgbColors.map(rgbStringToHue),
    ...hslHues,
    ...namedHues,
  ];

  // 3. No colours found → neutral
  if (allHues.length === 0) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  // 4. Count unique hues (within 15-degree tolerance)
  const uniqueHues: number[] = [];
  for (const hue of allHues) {
    if (hue < 0) continue; // skip achromatic
    const isDupe = uniqueHues.some(existing => huesMatch(existing, hue, 15));
    if (!isDupe) uniqueHues.push(hue);
  }

  // 5. Check max-colour constraint
  const maxColors = colorConstraints.maxColors;
  const totalColorCount = uniqueHues.length;
  if (totalColorCount > maxColors) {
    violations.push({
      rule: 'max-colors',
      severity: 'warning',
      message: `Found ${totalColorCount} distinct hues, exceeding max of ${maxColors}`,
    });
  }

  // 6. Harmony analysis
  const { harmonyScore, isComplementary: _isComplementary } = assessHarmony(allHues);

  // 7. Compute final score
  let score = harmonyScore;

  // Penalty for exceeding max colors (proportional)
  if (totalColorCount > maxColors) {
    const overRatio = (totalColorCount - maxColors) / maxColors;
    score -= overRatio * 0.2;
  }

  score = Math.max(0, Math.min(1, score));

  const passed = violations.every(v => v.severity !== 'error') && score >= constraints.general.minAestheticScore;

  return {
    score: Math.round(score * 1000) / 1000,
    violations,
    passed,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// LIR-aware color harmony analysis
// ---------------------------------------------------------------------------

/** Color-related API calls we look for in LIR token relationships */
const COLOR_APIS = ['fill', 'stroke', 'background', 'tint', 'color', 'strokeWeight'];

/**
 * Analyze color harmony using LIR tokens instead of regex.
 *
 * Walks token relationships.calls to find color API usage, then extracts
 * color literals from token source with precise location info.
 * When visualIntent is provided, compares extracted hues against the
 * intended palette for a coherence score.
 */
export function analyzeColorHarmonyLIR(
  tokens: LIRCodeToken[],
  constraints: DesignConstraints,
  visualIntent?: VisualMappingParams,
): AestheticReport {
  const violations: AestheticViolation[] = [];
  const colorConstraints: ColorConstraints = constraints.color;

  // 1. Find tokens that call color APIs
  const colorTokens = tokens.filter(t =>
    t.relationships.calls.some(c => COLOR_APIS.includes(c)),
  );

  // 2. Extract colors from token sources (reuse regex helpers on per-token source)
  const allHues: number[] = [];
  for (const token of colorTokens) {
    const hexColors = extractHexColors(token.source);
    const rgbColors = extractRgbColors(token.source);
    const hslHues = extractHslHues(token.source);
    const namedHues = extractNamedColorHues(token.source);

    allHues.push(
      ...hexColors.map(hexToHue),
      ...rgbColors.map(rgbStringToHue),
      ...hslHues,
      ...namedHues,
    );
  }

  // 3. No colors found → neutral
  if (allHues.length === 0) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  // 4. Count unique hues (within 15-degree tolerance)
  const uniqueHues: number[] = [];
  for (const hue of allHues) {
    if (hue < 0) continue;
    const isDupe = uniqueHues.some(existing => huesMatch(existing, hue, 15));
    if (!isDupe) uniqueHues.push(hue);
  }

  // 5. Check max-colour constraint
  if (uniqueHues.length > colorConstraints.maxColors) {
    violations.push({
      rule: 'max-colors',
      severity: 'warning',
      message: `Found ${uniqueHues.length} distinct hues, exceeding max of ${colorConstraints.maxColors}`,
    });
  }

  // 6. Harmony analysis (reuse existing helper)
  const { harmonyScore } = assessHarmony(allHues);

  // 7. Compute base score
  let score = harmonyScore;
  if (uniqueHues.length > colorConstraints.maxColors) {
    const overRatio = (uniqueHues.length - colorConstraints.maxColors) / colorConstraints.maxColors;
    score -= overRatio * 0.2;
  }

  // 8. Coherence bonus: compare against visual intent palette
  if (visualIntent?.palette?.hues && visualIntent.palette.hues.length > 0) {
    // Convert visual intent hues (0-1 range) to degree range (0-360)
    const intentHuesDeg = visualIntent.palette.hues.map(h => h * 360);
    let matchingHues = 0;
    for (const actualHue of uniqueHues) {
      if (intentHuesDeg.some(intent => hueDistance(actualHue, intent) < 30)) {
        matchingHues++;
      }
    }
    const coherenceRatio = uniqueHues.length > 0 ? matchingHues / uniqueHues.length : 0;
    // Small bonus for coherence (don't penalize non-matching heavily)
    score += coherenceRatio * 0.1;
  }

  score = Math.max(0, Math.min(1, score));

  const passed = violations.every(v => v.severity !== 'error') && score >= constraints.general.minAestheticScore;

  return {
    score: Math.round(score * 1000) / 1000,
    violations,
    passed,
    timestamp: Date.now(),
  };
}
