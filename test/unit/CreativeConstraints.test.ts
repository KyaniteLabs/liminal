import { describe, it, expect } from 'vitest';
import { validateAgainstConstraints, PRESET_CONSTRAINTS } from '../../src/core/CreativeConstraints.js';

describe('CreativeConstraints', () => {
  it('passes valid code against web preset', () => {
    const code = 'createCanvas(800, 600); ellipse(10, 10, 50);';
    const result = validateAgainstConstraints(code, PRESET_CONSTRAINTS.web);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects width exceeding constraint', () => {
    const code = 'width = 3000; height = 600;';
    const result = validateAgainstConstraints(code, PRESET_CONSTRAINTS.mobile);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('Canvas width'))).toBe(true);
  });

  it('detects animation in static target (fps=0)', () => {
    const code = 'function draw() {} createCanvas(100, 100);';
    const result = validateAgainstConstraints(code, PRESET_CONSTRAINTS.print);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.includes('Animation'))).toBe(true);
  });
});
