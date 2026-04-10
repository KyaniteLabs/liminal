/**
 * ColorExtractor - Extract and analyze colors from code
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface ColorExtractionResult {
  colors: Array<{ hex: string; rgb: RgbColor }>;
  dominant: { hex: string; rgb: RgbColor };
  palette: string[];
  harmony: string;
}

const NAMED_COLORS: Record<string, string> = {
  '#ff0000': 'red',
  '#00ff00': 'green',
  '#0000ff': 'blue',
  '#ffff00': 'yellow',
  '#ff00ff': 'magenta',
  '#00ffff': 'cyan',
  '#000000': 'black',
  '#ffffff': 'white',
};

export function extractColorsFromCode(code: string): ColorExtractionResult {
  if (!code || code.trim() === '') {
    return {
      colors: [{ hex: '#000000', rgb: { r: 0, g: 0, b: 0 } }],
      dominant: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } },
      palette: ['#000000'],
      harmony: 'monochromatic',
    };
  }

  // Extract hex colors from code
  const hexMatches = code.match(/#[0-9a-fA-F]{6}/g) || [];
  const colors = hexMatches.map(hex => ({
    hex: hex.toLowerCase(),
    rgb: hexToRgb(hex.toLowerCase()) || { r: 0, g: 0, b: 0 },
  }));

  if (colors.length === 0) {
    return {
      colors: [{ hex: '#000000', rgb: { r: 0, g: 0, b: 0 } }],
      dominant: { hex: '#000000', rgb: { r: 0, g: 0, b: 0 } },
      palette: ['#000000'],
      harmony: 'monochromatic',
    };
  }

  const dominant = colors[0];
  const palette = colors.map(c => c.hex);
  const harmony = detectHarmony(colors.map(c => rgbToHsl(c.rgb)));

  return {
    colors,
    dominant,
    palette,
    harmony,
  };
}

export function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function hexToRgb(hex: string): RgbColor | null {
  const match = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;

  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function getNamedColor(hex: string): string | undefined {
  return NAMED_COLORS[hex.toLowerCase()];
}

export function detectHarmony(hslColors: HslColor[]): string {
  if (hslColors.length === 0) return 'none';
  if (hslColors.length === 1) return 'monochromatic';

  // Check if all colors have similar hue (monochromatic)
  const hues = hslColors.map(c => c.h);
  const hueVariance = Math.max(...hues) - Math.min(...hues);

  if (hueVariance < 30) return 'monochromatic';
  if (hueVariance < 60) return 'analogous';

  return 'varied';
}
