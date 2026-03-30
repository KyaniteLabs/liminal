// ---------------------------------------------------------------------------
// LayoutCritic – static analysis of layout / composition in generative code
// ---------------------------------------------------------------------------

import type {
  AestheticReport,
  AestheticViolation,
  DesignConstraints,
} from '../types.js';
import type { LIRCodeToken } from '../../core/lir/types.js';
import type { VisualMappingParams } from '../../audio/types.js';

// ---------------------------------------------------------------------------
// Canvas dimension extraction
// ---------------------------------------------------------------------------

interface CanvasDimensions {
  width: number;
  height: number;
}

function extractCanvasDimensions(code: string): CanvasDimensions | null {
  // Match createCanvas(w, h)
  const match = code.match(/createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Position extraction
// ---------------------------------------------------------------------------

interface Position {
  x: number;
  y: number;
  context: string;
}

function extractPositions(code: string, _dims: CanvasDimensions): Position[] {
  const positions: Position[] = [];

  // rect(x, y, ...), ellipse(x, y, ...), circle(x, y, ...)
  const shapeRe = /\b(rect|ellipse|circle|arc)\s*\(\s*([\d.]+)\s*,\s*([\d.]+)/g;
  for (const m of code.matchAll(shapeRe)) {
    positions.push({
      x: parseFloat(m[2]),
      y: parseFloat(m[3]),
      context: m[1],
    });
  }

  // translate(x, y)
  const translateRe = /\btranslate\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g;
  for (const m of code.matchAll(translateRe)) {
    positions.push({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
      context: 'translate',
    });
  }

  // text('...', x, y)
  const textRe = /\btext\s*\([^,]+,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g;
  for (const m of code.matchAll(textRe)) {
    positions.push({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
      context: 'text',
    });
  }

  // line(x1, y1, x2, y2) — check both endpoints
  const lineRe = /\bline\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g;
  for (const m of code.matchAll(lineRe)) {
    positions.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), context: 'line-start' });
    positions.push({ x: parseFloat(m[3]), y: parseFloat(m[4]), context: 'line-end' });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Alignment detection
// ---------------------------------------------------------------------------

function hasCenteredAlignment(code: string): boolean {
  return /textAlign\s*\(\s*CENTER/.test(code);
}

function hasCenteredPositioning(code: string, dims: CanvasDimensions): boolean {
  const halfW = dims.width / 2;
  const halfH = dims.height / 2;
  // Look for width/2 or height/2 usage
  return (
    /width\s*\/\s*2/.test(code) ||
    /height\s*\/\s*2/.test(code) ||
    new RegExp(`${halfW}`).test(code) ||
    new RegExp(`${halfH}`).test(code)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeLayout(
  code: string,
  constraints: DesignConstraints,
): AestheticReport {
  const violations: AestheticViolation[] = [];

  // 1. Extract canvas dimensions
  const dims = extractCanvasDimensions(code);
  if (!dims) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  let score = 0.5; // neutral baseline

  // 2. Check for out-of-bounds positions
  const positions = extractPositions(code, dims);
  const outOfBounds = positions.filter(
    p => p.x > dims.width || p.y > dims.height,
  );
  if (outOfBounds.length > 0) {
    violations.push({
      rule: 'out-of-bounds',
      severity: 'warning',
      message: `${outOfBounds.length} position(s) exceed canvas bounds (${dims.width}x${dims.height})`,
    });
    score -= 0.15 * Math.min(outOfBounds.length, 3);
  }

  // 3. Bonus for centered positioning patterns
  if (hasCenteredPositioning(code, dims)) {
    score += 0.15;
  }

  // 4. Bonus for alignment functions
  if (hasCenteredAlignment(code)) {
    score += 0.15;
  }

  // 5. Check for balance — if positions cluster near centre that's good
  if (positions.length > 1) {
    const inBounds = positions.filter(
      p => p.x <= dims.width && p.y <= dims.height,
    );
    if (inBounds.length > 0) {
      const avgX =
        inBounds.reduce((sum, p) => sum + p.x, 0) / inBounds.length;
      const avgY =
        inBounds.reduce((sum, p) => sum + p.y, 0) / inBounds.length;
      const centerX = dims.width / 2;
      const centerY = dims.height / 2;
      // How close is the average position to centre? (normalised)
      const offsetX = Math.abs(avgX - centerX) / dims.width;
      const offsetY = Math.abs(avgY - centerY) / dims.height;
      const balanceScore = 1 - (offsetX + offsetY) / 2;
      score += balanceScore * 0.1;
    }
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

// ---------------------------------------------------------------------------
// LIR-aware layout analysis
// ---------------------------------------------------------------------------

/**
 * Analyze layout using LIR tokens instead of regex.
 *
 * Finds setup/draw tokens to extract canvas dimensions and positioning calls.
 * Uses metrics.nestingDepth as layout complexity proxy.
 */
export function analyzeLayoutLIR(
  tokens: LIRCodeToken[],
  constraints: DesignConstraints,
  visualIntent?: VisualMappingParams,
): AestheticReport {
  const violations: AestheticViolation[] = [];

  // 1. Find setup token → extract canvas dimensions
  const setupToken = tokens.find(t => t.name === 'setup');
  let dims: CanvasDimensions | null = null;
  if (setupToken) {
    dims = extractCanvasDimensions(setupToken.source);
  }
  // Fallback: search all tokens for createCanvas
  if (!dims) {
    for (const token of tokens) {
      dims = extractCanvasDimensions(token.source);
      if (dims) break;
    }
  }

  if (!dims) {
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };
  }

  let score = 0.5; // neutral baseline

  // 2. Find draw token → extract positioning calls
  const drawToken = tokens.find(t => t.name === 'draw');
  const analysisSource = drawToken?.source ?? tokens.map(t => t.source).join('\n');
  const positions = extractPositions(analysisSource, dims);

  // 3. Check for out-of-bounds positions
  const outOfBounds = positions.filter(p => p.x > dims!.width || p.y > dims!.height);
  if (outOfBounds.length > 0) {
    violations.push({
      rule: 'out-of-bounds',
      severity: 'warning',
      message: `${outOfBounds.length} position(s) exceed canvas bounds (${dims!.width}x${dims!.height})`,
    });
    score -= 0.15 * Math.min(outOfBounds.length, 3);
  }

  // 4. Bonus for centered positioning patterns
  if (hasCenteredPositioning(analysisSource, dims)) {
    score += 0.15;
  }
  if (hasCenteredAlignment(analysisSource)) {
    score += 0.15;
  }

  // 5. LIR bonus: use nesting depth as layout complexity signal
  const maxNesting = Math.max(...tokens.map(t => t.metrics.nestingDepth));
  if (maxNesting >= 2 && maxNesting <= 5) {
    score += 0.05; // moderate complexity is good
  } else if (maxNesting > 8) {
    score -= 0.05; // excessive nesting
  }

  // 6. Coherence with visual intent balance
  if (visualIntent?.composition?.balance !== undefined) {
    if (positions.length > 1) {
      const inBounds = positions.filter(p => p.x <= dims!.width && p.y <= dims!.height);
      if (inBounds.length > 0) {
        const avgX = inBounds.reduce((s, p) => s + p.x, 0) / inBounds.length;
        const normalizedBalance = avgX / dims!.width;
        const balanceDiff = Math.abs(normalizedBalance - visualIntent.composition.balance);
        if (balanceDiff < 0.2) {
          score += 0.05; // good alignment with intent
        }
      }
    }
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
