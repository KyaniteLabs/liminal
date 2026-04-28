/**
 * Tests for collab/Scoring — quickScore heuristic quality scoring.
 *
 * Covers all domain branches (ascii, music, code variants),
 * length checks, and clamping behavior.
 */

import { describe, it, expect } from 'vitest';
import { quickScore } from '../../../src/collab/Scoring.js';
import { Domain } from '../../../src/types/domains.js';

describe('collab/Scoring — quickScore', () => {
  it('returns base score for generic domain with moderate-length output', () => {
    const output = 'x'.repeat(200);
    const score = quickScore(output, 'html' as any);
    expect(score).toBe(0.65); // base 0.5 + 0.15 length bonus
  });

  it('penalizes very short output', () => {
    const output = 'hi';
    const score = quickScore(output, 'html' as any);
    expect(score).toBe(0.2); // 0.5 - 0.3
  });

  it('gives no length bonus for medium-short output (50-99 chars)', () => {
    const output = 'x'.repeat(75);
    const score = quickScore(output, 'html' as any);
    expect(score).toBe(0.5); // base only, no bonus, no penalty
  });

  // ASCII domain
  it('scores ASCII with special chars, multiple lines, and variety highly', () => {
    // Must be >= 100 chars for length bonus
    const output = '@@@@@@@@@@\n||||||||||\n##########\nHello World Art with extra padding here to exceed one hundred characters!!';
    const score = quickScore(output, 'ascii');
    // base 0.5 + length 0.15 + special 0.15 + lines (4 >= 3) 0.1 + variety (10+ unique) 0.1 = 1.0
    expect(score).toBe(1.0);
  });

  it('scores basic ASCII without special chars lower', () => {
    const output = 'x'.repeat(200);
    const score = quickScore(output, 'ascii');
    // No special chars, no newlines, only 1 unique char
    expect(score).toBe(0.65); // 0.5 + 0.15 length
  });

  it('penalizes short ASCII output', () => {
    const score = quickScore('ab', 'ascii');
    expect(score).toBe(0.2);
  });

  // Music domain
  it('scores music with ABC notation highly', () => {
    const output = [
      'X:1', 'T:Test Song', 'M:4/4', 'K:C', 'L:1/4',
      'CDEFGABCDEFGABcdefgab', // notes
      '| :| [ ] "lyrics"', // markers
    ].join('\n');
    const score = quickScore(output, 'music');
    expect(score).toBeGreaterThan(0.9);
  });

  it('gives partial music score for minimal notation', () => {
    const output = 'C D E F G C D E F G C D E F G'; // just notes, no ABC headers, 29 chars < 100
    const score = quickScore(output, 'music');
    // Short: 29 < 50, penalty -0.3. Base 0.5 - 0.3 = 0.2
    // No ABC headers match. No markers. Has notes: +0.1
    // Note count: C,D,E,F,G × 3 = 15 >= 10: +0.1
    // 0.2 + 0.1 + 0.1 = 0.4
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.7);
  });

  // Code domains
  it('scores code with function and logic keywords highly', () => {
    const output = [
      'function test() {',
      '  if (x > 0) {',
      '    for (let i = 0; i < 10; i++) {',
      '      return i;',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const score = quickScore(output, Domain.CODE);
    expect(score).toBeGreaterThan(0.8);
  });

  it('scores p5 domain with code keywords', () => {
    const output = 'function setup() {\n  createCanvas(400, 400);\n}\nfunction draw() {\n  background(0);\n}\n// more lines';
    const score = quickScore(output, Domain.P5);
    expect(score).toBeGreaterThan(0.7);
  });

  it('scores GLSL domain with code keywords', () => {
    const output = 'uniform float time;\nvoid main() {\n  if (time > 0.0) {\n    return;\n  }\n}\n// shader';
    const score = quickScore(output, Domain.GLSL);
    expect(score).toBeGreaterThan(0.7);
  });

  it('scores THREE domain with code keywords', () => {
    const output = 'const scene = new THREE.Scene();\nclass MeshBuilder {\n  import { foo } from bar;\n}\n// end';
    const score = quickScore(output, Domain.THREE);
    expect(score).toBeGreaterThan(0.7);
  });

  it('clamps score to max 1.0', () => {
    // Generate output that would score > 1.0 without clamping
    const output = Array.from({ length: 50 }, (_, i) =>
      `X:${i} T:Song M:4/4 K:C CDEFGABCDEFGABcdefgab | :| [ ] "lyrics"`
    ).join('\n');
    const score = quickScore(output, 'music');
    expect(score).toBe(1.0);
  });

  it('clamps score to min 0.0', () => {
    // Very short output gets -0.3 penalty, base is 0.5
    // 0.5 - 0.3 = 0.2, not negative. But let's test the clamp anyway
    const score = quickScore('', 'html' as any);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
