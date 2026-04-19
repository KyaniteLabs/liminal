import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  createColorTheoryPalette,
  hslToRgb,
  parseHexColor,
  rgbToHex,
  rgbToHsl,
} from '../../../src/aesthetic/ColorTheoryEngine.js';

describe('ColorTheoryEngine', () => {
  it('roundtrips basic hex, RGB, and HSL conversions', () => {
    expect(parseHexColor('#0af')).toEqual({ r: 0, g: 170, b: 255 });
    expect(rgbToHex({ r: 0, g: 170, b: 255 })).toBe('#00aaff');

    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(Math.round(hsl.h)).toBe(0);
    expect(rgbToHex(hslToRgb(hsl))).toBe('#ff0000');
  });

  it('computes accessibility contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#111827', '#e5e7eb')).toBeGreaterThan(12);
  });

  it('creates a launch-scope split-complementary palette with semantic roles and guidance', () => {
    const palette = createColorTheoryPalette({
      seed: '#2563eb',
      harmonyMode: 'split-complementary',
      temperatureBalance: 'cool',
    });

    expect(palette.colors).toHaveLength(5);
    expect(palette.colors.map(color => color.role)).toEqual([
      'background',
      'primary',
      'secondary',
      'accent',
      'highlight',
    ]);
    expect(palette.evaluation.passedContrast).toBe(true);
    expect(palette.guidance).toContain('split-complementary palette');
    expect(palette.guidance).toContain('principle-based');
  });

  it('supports monochromatic palettes without collapsing every role to the same color', () => {
    const palette = createColorTheoryPalette({
      seed: '#14b8a6',
      harmonyMode: 'monochromatic',
      count: 4,
    });

    expect(new Set(palette.colors.map(color => color.hex)).size).toBeGreaterThan(2);
    expect(palette.evaluation.score).toBeGreaterThan(0.7);
  });

  it('rejects invalid hex input instead of guessing', () => {
    expect(() => createColorTheoryPalette({ seed: 'not-a-color' })).toThrow(/Invalid hex color/);
  });
});
