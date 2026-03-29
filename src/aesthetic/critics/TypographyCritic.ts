// ---------------------------------------------------------------------------
// TypographyCritic – static analysis of text/font usage in generative code
// ---------------------------------------------------------------------------

import type {
  AestheticReport,
  AestheticViolation,
  DesignConstraints,
  TypographyConstraints,
} from '../types.js';

// ---------------------------------------------------------------------------
// Reasonable bounds
// ---------------------------------------------------------------------------

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function extractTextSizes(code: string): number[] {
  const re = /\btextSize\s*\(\s*([\d.]+)\s*\)/g;
  return [...code.matchAll(re)].map(m => parseFloat(m[1]));
}

function extractFontNames(code: string): string[] {
  // textFont('Name') or textFont("Name")
  const re = /\btextFont\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...code.matchAll(re)].map(m => m[1]);
}

function extractLoadedFonts(code: string): string[] {
  // loadFont('path/to/font.ext')
  const re = /\bloadFont\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...code.matchAll(re)].map(m => m[1]);
}

function hasTextUsage(code: string): boolean {
  return /\btext\s*\(/.test(code);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeTypography(
  code: string,
  constraints: DesignConstraints,
): AestheticReport {
  const violations: AestheticViolation[] = [];
  const typoConstraints: TypographyConstraints = constraints.typography;

  // 1. No text usage at all → neutral
  if (!hasTextUsage(code)) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  let score = 0.7; // baseline for having text

  // 2. Check textSize bounds
  const sizes = extractTextSizes(code);
  for (const size of sizes) {
    if (size > MAX_FONT_SIZE) {
      violations.push({
        rule: 'max-font-size',
        severity: 'warning',
        message: `textSize(${size}) exceeds reasonable maximum of ${MAX_FONT_SIZE}`,
        location: `textSize(${size})`,
      });
    }
    if (size < MIN_FONT_SIZE) {
      violations.push({
        rule: 'min-font-size',
        severity: 'warning',
        message: `textSize(${size}) is below reasonable minimum of ${MIN_FONT_SIZE}`,
        location: `textSize(${size})`,
      });
    }
  }

  // 3. Check font loading — warn if fonts used without loadFont()
  const fontNames = extractFontNames(code);
  const uniqueFonts = [...new Set(fontNames)];
  const loadedFonts = extractLoadedFonts(code);

  // A font is considered "loaded" if loadFont was called with a path containing the font name
  const unloadedFonts = uniqueFonts.filter(
    fn =>
      !loadedFonts.some(
        lf => lf.toLowerCase().includes(fn.toLowerCase()) || fn.toLowerCase() === 'monospace' || fn.toLowerCase() === 'serif' || fn.toLowerCase() === 'sans-serif',
      ),
  );

  if (unloadedFonts.length > 0) {
    violations.push({
      rule: 'unloaded-font',
      severity: 'warning',
      message: `Font(s) used without loadFont(): ${unloadedFonts.join(', ')}`,
    });
  }

  // 4. Check font count against constraint
  if (uniqueFonts.length > typoConstraints.maxFonts) {
    violations.push({
      rule: 'max-fonts',
      severity: 'warning',
      message: `${uniqueFonts.length} fonts used, exceeding max of ${typoConstraints.maxFonts}`,
    });
  }

  // 5. Adjust score
  if (sizes.length > 0) {
    const allWithinBounds = sizes.every(s => s >= MIN_FONT_SIZE && s <= MAX_FONT_SIZE);
    if (allWithinBounds) {
      score += 0.1;
    } else {
      score -= 0.15;
    }
  }

  if (unloadedFonts.length > 0) {
    score -= 0.1;
  }

  if (uniqueFonts.length > typoConstraints.maxFonts) {
    score -= 0.1;
  }

  score = Math.max(0, Math.min(1, score));

  const passed =
    violations.every(v => v.severity !== 'error') &&
    score >= constraints.general.minAestheticScore;

  return {
    score: Math.round(score * 1000) / 1000,
    violations,
    passed,
    timestamp: Date.now(),
  };
}
