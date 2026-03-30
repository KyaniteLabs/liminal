/**
 * CreativeConstraints — Fabrication constraints for creative output.
 *
 * Defines dimension, performance, and element budgets for different target
 * platforms, and validates generated code against those budgets.
 */

/** A complete set of fabrication constraints. */
export interface ConstraintSet {
  /** Maximum canvas width in pixels. */
  maxWidth: number;
  /** Maximum canvas height in pixels. */
  maxHeight: number;
  /** Target frames per second (0 = static / no animation loop). */
  targetFPS: number;
  /** Maximum number of visual elements allowed. */
  maxElements: number;
  /** Colour depth in bits per channel (8 = standard, 16 = high). */
  colorDepth: number;
  /** Constraint strictness mode. */
  mode: 'restrictive' | 'balanced' | 'permissive';
}

/** Predefined constraint sets for common target platforms. */
export const PRESET_CONSTRAINTS: Record<string, ConstraintSet> = {
  web: {
    maxWidth: 1920,
    maxHeight: 1080,
    targetFPS: 60,
    maxElements: 1000,
    colorDepth: 8,
    mode: 'balanced',
  },
  mobile: {
    maxWidth: 390,
    maxHeight: 844,
    targetFPS: 30,
    maxElements: 500,
    colorDepth: 8,
    mode: 'restrictive',
  },
  print: {
    maxWidth: 3000,
    maxHeight: 3000,
    targetFPS: 0,
    maxElements: 100,
    colorDepth: 16,
    mode: 'permissive',
  },
};

/**
 * Validate generated code against a constraint set.
 *
 * Performs static analysis on the code string looking for dimension literals,
 * element counts, animation loops, and colour depth indicators that may violate
 * the given constraints.
 *
 * @param code        - The generated code string to validate.
 * @param constraints - The constraint set to validate against.
 * @returns An object with a pass/fail flag and an array of violation descriptions.
 */
export function validateAgainstConstraints(
  code: string,
  constraints: ConstraintSet,
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];

  // --- Dimension checks ---
  const widthPattern = /(?:createCanvas|size|width\s*[=:]\s*)(\d{3,})/g;
  const heightPattern = /(?:createCanvas|size|height\s*[=:]\s*)(\d{3,})/g;

  let match: RegExpExecArray | null;
  while ((match = widthPattern.exec(code)) !== null) {
    const w = parseInt(match[1], 10);
    if (w > constraints.maxWidth) {
      violations.push(
        `Canvas width ${w} exceeds maximum ${constraints.maxWidth}px.`,
      );
    }
  }

  const heightPatternCopy = new RegExp(heightPattern.source, heightPattern.flags);
  while ((match = heightPatternCopy.exec(code)) !== null) {
    const h = parseInt(match[1], 10);
    if (h > constraints.maxHeight) {
      violations.push(
        `Canvas height ${h} exceeds maximum ${constraints.maxHeight}px.`,
      );
    }
  }

  // --- Element count check ---
  const elementPattern =
    /(?:ellipse|rect|circle|line|triangle|arc|quad|text|image)\s*\(/g;
  const elementCount = (code.match(elementPattern) || []).length;
  if (elementCount > constraints.maxElements) {
    violations.push(
      `Element count (${elementCount}) exceeds maximum of ${constraints.maxElements}.`,
    );
  }

  // --- Animation / FPS check ---
  if (constraints.targetFPS === 0) {
    // Static target — no animation loops allowed.
    if (/\b(draw|animate|requestAnimationFrame|setInterval)\b/.test(code)) {
      violations.push(
        'Animation loop detected but target platform is static (0 FPS).',
      );
    }
  } else {
    // Animated target — check for explicit FPS overrides that exceed the target.
    const fpsPattern = /(?:frameRate|fps)\s*[\(:=]\s*(\d+)/g;
    while ((match = fpsPattern.exec(code)) !== null) {
      const fps = parseInt(match[1], 10);
      if (fps > constraints.targetFPS) {
        violations.push(
          `Requested FPS (${fps}) exceeds target ${constraints.targetFPS}.`,
        );
      }
    }
  }

  // --- Colour depth check ---
  if (constraints.colorDepth < 16) {
    // Look for high-colour patterns that require 16-bit depth.
    if (/colorMode\s*\(\s*['"]?HSB['"]?\s*,\s*\d{4,}/.test(code)) {
      violations.push(
        'High-colour-range HSB detected but colour depth is limited to 8-bit.',
      );
    }
  }

  // --- Mode-specific checks ---
  if (constraints.mode === 'restrictive') {
    // Restrictive mode: no heavy computation patterns.
    const heavyPatterns =
      /(?:forEach|map|filter|reduce)\s*\(\s*(?:async|function)/g;
    if (heavyPatterns.test(code)) {
      violations.push(
        'Heavy async iteration detected in restrictive mode.',
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}
