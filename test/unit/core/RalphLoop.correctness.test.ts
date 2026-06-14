/**
 * Correctness tests for two RalphLoop honesty fixes:
 *
 *  - D13: the aesthetic penalty must scale with the THRESHOLD GAP. A candidate
 *    further below the threshold must receive a LARGER penalty (smaller factor).
 *    The old code multiplied by the raw aesthetic score, which did not track the
 *    gap honestly.
 *
 *  - D10: the GLSL runtime-output check must accept the GLSL ES 3.0
 *    `out vec4 <name>;` fragment output, not only the legacy gl_FragColor
 *    builtin, so a valid `#version 300 es` shader is judged runtime-valid.
 *
 * Both are tested via the pure, exported helpers so the assertions check real
 * returned values rather than internal call wiring.
 */

import { describe, it, expect } from 'vitest';
import { aestheticPenaltyFactor, glslHasRuntimeOutput } from '../../../src/core/RalphLoop.js';

describe('aestheticPenaltyFactor — honest threshold-gap penalty (D13)', () => {
  const THRESHOLD = 0.7;

  it('gives a candidate further below threshold the LARGER penalty', () => {
    // 0.3 is further below 0.7 than 0.6 is, so it must be penalized more (smaller factor).
    const worseFactor = aestheticPenaltyFactor(0.3, THRESHOLD);
    const betterFactor = aestheticPenaltyFactor(0.6, THRESHOLD);
    expect(worseFactor).toBeLessThan(betterFactor);
  });

  it('computes the exact gap-proportional factor', () => {
    // factor = 1 - (threshold - score) / threshold
    // score 0.3, threshold 0.7 -> 1 - 0.4/0.7 = 0.428571...
    expect(aestheticPenaltyFactor(0.3, 0.7)).toBeCloseTo(0.42857, 4);
    // score 0.6, threshold 0.7 -> 1 - 0.1/0.7 = 0.857142...
    expect(aestheticPenaltyFactor(0.6, 0.7)).toBeCloseTo(0.85714, 4);
  });

  it('applies the larger penalty to a base score end-to-end', () => {
    const base = 0.8;
    const penalizedWorse = base * aestheticPenaltyFactor(0.3, THRESHOLD);
    const penalizedBetter = base * aestheticPenaltyFactor(0.6, THRESHOLD);
    // The 0.3-aesthetic candidate ends up with the lower final score.
    expect(penalizedWorse).toBeLessThan(penalizedBetter);
    expect(penalizedWorse).toBeCloseTo(0.34286, 4);
    expect(penalizedBetter).toBeCloseTo(0.68571, 4);
  });

  it('applies no penalty (factor 1) at or above threshold', () => {
    expect(aestheticPenaltyFactor(0.7, 0.7)).toBe(1);
    expect(aestheticPenaltyFactor(0.95, 0.7)).toBe(1);
  });

  it('drives the factor to 0 as the score approaches 0', () => {
    expect(aestheticPenaltyFactor(0, 0.7)).toBe(0);
  });

  it('handles a non-positive threshold by not penalizing', () => {
    expect(aestheticPenaltyFactor(0.1, 0)).toBe(1);
  });
});

describe('glslHasRuntimeOutput — accepts ES 3.0 output marker (D10)', () => {
  it('judges an `out vec4 fragColor` shader runtime-valid', () => {
    const es300Shader = [
      '#version 300 es',
      'precision highp float;',
      'out vec4 fragColor;',
      'void main() {',
      '  fragColor = vec4(1.0, 0.0, 0.0, 1.0);',
      '}',
    ].join('\n');
    expect(glslHasRuntimeOutput(es300Shader)).toBe(true);
  });

  it('still accepts the legacy gl_FragColor shader', () => {
    const legacyShader = 'precision highp float;\nvoid main() { gl_FragColor = vec4(0.2, 0.4, 0.8, 1.0); }';
    expect(glslHasRuntimeOutput(legacyShader)).toBe(true);
  });

  it('rejects a shader with no main() entry point', () => {
    const noMain = 'out vec4 fragColor;\nfloat noise(vec2 p) { return fract(sin(p.x)); }';
    expect(glslHasRuntimeOutput(noMain)).toBe(false);
  });

  it('rejects a shader with main() but no fragment output marker', () => {
    const noOutput = 'void main() {\n  float x = 1.0;\n}';
    expect(glslHasRuntimeOutput(noOutput)).toBe(false);
  });

  it('accepts a precision-qualified output declaration', () => {
    const qualified = 'void main() { color = vec4(1.0); }\nout mediump vec4 color;';
    expect(glslHasRuntimeOutput(qualified)).toBe(true);
  });
});
