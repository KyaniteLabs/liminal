import { describe, it, expect } from 'vitest';
import {
  generateHarmony,
  validateHarmony,
  HARMONY_MODES,
} from '../../../src/aesthetic/ColorTheoryEngine.js';

describe('ColorTheoryEngine', () => {
  it('generates complementary harmony from a base hue', () => {
    const hues = generateHarmony(0, 'complementary');
    expect(hues).toHaveLength(2);
    expect(hues[0]).toBe(0);
    expect(hues[1]).toBe(180);
  });

  it('generates triadic harmony with three hues', () => {
    const hues = generateHarmony(30, 'triadic');
    expect(hues).toHaveLength(3);
    expect(hues[0]).toBe(30);
  });

  it('throws for unknown harmony mode', () => {
    expect(() => generateHarmony(0, 'bogus')).toThrow(/Unknown harmony mode/);
  });

  it('exports all seven harmony modes', () => {
    expect(HARMONY_MODES).toHaveLength(7);
  });

  it('validates a perfect complementary pair', () => {
    const result = validateHarmony([0, 180]);
    expect(result.valid).toBe(true);
    expect(result.harmonyType).toBe('complementary');
  });

  it('returns monochromatic for single hue', () => {
    const result = validateHarmony([42]);
    expect(result.valid).toBe(true);
    expect(result.harmonyType).toBe('monochromatic');
  });
});
