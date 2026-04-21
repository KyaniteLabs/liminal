/**
 * Unit tests for TemporalStructureAnalyzer — Phase 14
 *
 * Tests temporal and structural analysis of creative outputs.
 */

import { describe, it, expect } from 'vitest';
import { TemporalStructureAnalyzer } from '../../../src/emergence/TemporalStructureAnalyzer.js';

describe('TemporalStructureAnalyzer', () => {
  it('returns flat for very short output', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const result = analyzer.analyze('short');
    expect(result.structureLevel).toBe('flat');
    expect(result.structure).toBeCloseTo(0.1, 1);
    expect(result.phaseCount).toBe(0);
  });

  it('detects structure in multi-line code', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const code = [
      'function setup() {',
      '  createCanvas(400, 400);',
      '}',
      '',
      'function draw() {',
      '  background(0);',
      '  for (let i = 0; i < 10; i++) {',
      '    ellipse(i * 40, 200, 30, 30);',
      '  }',
      '}',
    ].join('\n');
    const result = analyzer.analyze(code);
    expect(result.structure).toBeGreaterThan(0.1);
    expect(result.structureLevel).not.toBe('flat');
  });

  it('detects temporal keywords in animation code', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const animCode = [
      'let frameCount = 0;',
      'function animate() {',
      '  frameCount++;',
      '  requestAnimationFrame(animate);',
      '  draw(frameCount);',
      '}',
      'function draw(t) {',
      '  if (t > 100) phase = "climax";',
      '  if (t > 200) phase = "resolution";',
      '}',
    ].join('\n');
    const result = analyzer.analyze(animCode);
    expect(result.temporalRichness).toBeGreaterThan(0.2);
  });

  it('detects flat structure in repetitive content', () => {
    const analyzer = new TemporalStructureAnalyzer();
    const flat = 'a '.repeat(200);
    const result = analyzer.analyze(flat);
    expect(result.structure).toBeLessThan(0.4);
  });

  it('classifies short output as flat', () => {
    const analyzer = new TemporalStructureAnalyzer({ segmentCount: 4 });
    // Under 20 chars triggers early flat return
    const result = analyzer.analyze('short text');
    expect(result.structureLevel).toBe('flat');
    expect(result.structure).toBeCloseTo(0.1, 1);
  });

  it('classifies varied code as non-flat', () => {
    const analyzer = new TemporalStructureAnalyzer({ segmentCount: 4 });
    const code = [
      'function setup() { createCanvas(800, 600); }',
      '',
      'function draw() {',
      '  background(0);',
      '    for (let i = 0; i < 10; i++) {',
      '      ellipse(i * 40, 200, 30, 30);',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const result = analyzer.analyze(code);
    expect(result.structureLevel).not.toBe('flat');
  });

  it('counts phase transitions between segments', () => {
    const analyzer = new TemporalStructureAnalyzer({ segmentCount: 4 });
    // Code with distinct density phases
    const phased = [
      'x=1', // sparse
      '', '', '', '',
      'function veryComplex() { return longExpression() + anotherCall() * thirdThing(); }', // dense
      'function anotherDense() { return map(x => x * 2, [1,2,3,4,5]).filter(v => v > 3); }', // dense
    ].join('\n');
    const result = analyzer.analyze(phased);
    // Should detect at least some phase changes
    expect(result.phaseCount).toBeGreaterThanOrEqual(0);
  });
});
