import { describe, it, expect } from 'vitest';
import { analyzeTypography } from '../../../src/aesthetic/critics/TypographyCritic.js';
import { DEFAULT_DESIGN_CONSTRAINTS } from '../../../src/aesthetic/types.js';

describe('TypographyCritic', () => {
  it('passes code with reasonable textSize', () => {
    const code = "textSize(16); text('Hello', 10, 10);";
    const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0.5);
  });

  it('warns about excessively large text', () => {
    const code = "textSize(200); text('BIG', 10, 10);";
    const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.violations.some(v => v.rule === 'max-font-size')).toBe(true);
  });

  it('warns about very small text', () => {
    const code = "textSize(4); text('tiny', 10, 10);";
    const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.violations.some(v => v.rule === 'min-font-size')).toBe(true);
  });

  it('warns about multiple fonts without loading', () => {
    const code = "textFont('Georgia'); text('a', 10, 10); textFont('Courier'); text('b', 20, 20);";
    const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.violations.some(v => v.rule === 'unloaded-font')).toBe(true);
  });

  it('neutral score when no text usage', () => {
    const code = "rect(10, 10, 100, 100); ellipse(50, 50, 30);";
    const report = analyzeTypography(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBe(0.5);
  });
});
