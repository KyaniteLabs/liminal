import { describe, it, expect } from 'vitest';
import {
  extractColorsFromCode,
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  getNamedColor,
  detectHarmony,
} from '../../../src/aesthetic/ColorExtractor.js';

describe('ColorExtractor', () => {
  it('extracts hex colors from code and returns harmony', () => {
    const result = extractColorsFromCode('background(#ff0000); fill(#00ff00); stroke(#0000ff);');
    expect(result.colors.length).toBeGreaterThanOrEqual(3);
    expect(result.dominant.hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.palette.length).toBeGreaterThanOrEqual(3);
    expect(typeof result.harmony).toBe('string');
  });

  it('converts RGB to hex and back', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    const rgb = hexToRgb('#ff0000');
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('converts RGB to HSL', () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
  });

  it('looks up named colors', () => {
    expect(getNamedColor('#ff0000')).toBe('red');
    expect(getNamedColor('#123456')).toBeUndefined();
  });

  it('detects monochromatic harmony for single-hue input', () => {
    const harmony = detectHarmony([{ h: 0, s: 80, l: 50 }]);
    expect(harmony).toBe('monochromatic');
  });

  it('detects monochromatic harmony across the hue wrap boundary', () => {
    const harmony = detectHarmony([
      { h: 355, s: 80, l: 50 },
      { h: 5, s: 75, l: 52 },
    ]);
    expect(harmony).toBe('monochromatic');
  });

  it('detects analogous harmony across the hue wrap boundary', () => {
    const harmony = detectHarmony([
      { h: 330, s: 80, l: 50 },
      { h: 20, s: 75, l: 52 },
    ]);
    expect(harmony).toBe('analogous');
  });

  it('returns fallback for empty code', () => {
    const result = extractColorsFromCode('');
    expect(result.colors.length).toBe(1);
    expect(result.dominant.hex).toBe('#000000');
  });
});
