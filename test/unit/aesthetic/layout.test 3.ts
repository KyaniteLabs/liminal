import { describe, it, expect } from 'vitest';
import { analyzeLayout } from '../../../src/aesthetic/critics/LayoutCritic.js';
import { DEFAULT_DESIGN_CONSTRAINTS } from '../../../src/aesthetic/types.js';

describe('LayoutCritic', () => {
  it('passes code with centered canvas content', () => {
    const code = "createCanvas(400, 400); translate(width/2, height/2); ellipse(0, 0, 100);";
    const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0.5);
  });

  it('warns about positions outside canvas', () => {
    const code = "createCanvas(100, 100); rect(200, 200, 50, 50);";
    const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.violations.length).toBeGreaterThan(0);
  });

  it('gives neutral score when no createCanvas', () => {
    const code = "rect(10, 10, 50, 50);";
    const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBe(0.5);
  });

  it('bonus for textAlign CENTER', () => {
    const code = "createCanvas(400, 400); textAlign(CENTER, CENTER); textSize(16); text('hi', width/2, height/2);";
    const report = analyzeLayout(code, DEFAULT_DESIGN_CONSTRAINTS);
    expect(report.score).toBeGreaterThan(0.6);
  });
});
