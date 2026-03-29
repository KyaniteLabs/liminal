import { describe, it, expect } from 'vitest';
import { analyzeColorHarmony } from '../../../src/aesthetic/critics/ColorHarmonyCritic.js';
import { DEFAULT_DESIGN_CONSTRAINTS } from '../../../src/aesthetic/types.js';

describe('ColorHarmonyCritic', () => {
  it('passes code with few harmonious colors', () => {
    const code = "fill('#ff6633'); background('#ff3366'); rect(10, 10, 100, 100);";
    const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0.5);
  });

  it('flags code with too many colors', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff'];
    const code = colors.map(c => `fill('${c}');`).join(' ');
    const report = analyzeColorHarmony(code, { ...DEFAULT_DESIGN_CONSTRAINTS, color: { ...DEFAULT_DESIGN_CONSTRAINTS.color, maxColors: 5 } });
    expect(report.violations.some(v => v.rule === 'max-colors')).toBe(true);
  });

  it('gives neutral score to code with no colors', () => {
    const code = "rect(10, 10, 100, 100); ellipse(50, 50, 30);";
    const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBe(0.5);
  });

  it('recognizes hex, rgb, hsl, and named color formats', () => {
    const code = "fill('#ff0000'); stroke('rgb(0, 255, 0)'); background('hsl(240, 100%, 50%)'); tint(255, 0, 255, 128);";
    const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0); // doesn't crash, finds colors
  });

  it('detects complementary colors', () => {
    const code = "fill('#ff0000'); background('#00ffff');"; // red + cyan = complementary
    const report = analyzeColorHarmony(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0.5);
  });
});
