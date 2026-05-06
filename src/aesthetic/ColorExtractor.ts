export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface ExtractedColor extends RGBColor, HSLColor {
  hex: string;
  name?: string;
  count: number;
}

export interface ColorExtractionResult {
  colors: ExtractedColor[];
  dominant: ExtractedColor;
  palette: ExtractedColor[];
  harmony: string;
}

const NAMED_COLORS: Record<string, string> = {
  '#000000': 'black',
  '#ffffff': 'white',
  '#ff0000': 'red',
  '#00ff00': 'green',
  '#0000ff': 'blue',
  '#ffff00': 'yellow',
  '#00ffff': 'cyan',
  '#ff00ff': 'magenta',
};

export function rgbToHex(color: RGBColor): string {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function hexToRgb(hex: string): RGBColor | undefined {
  const normalized = normalizeHex(hex);
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return undefined;
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHsl(color: RGBColor): HSLColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function getNamedColor(hex: string): string | undefined {
  return NAMED_COLORS[normalizeHex(hex)];
}

export function detectHarmony(colors: HSLColor[]): string {
  if (colors.length <= 1) return 'monochromatic';
  const hues = colors.map((color) => normalizeHue(color.h)).sort((a, b) => a - b);
  const span = circularHueSpan(hues);
  if (span <= 15) return 'monochromatic';
  if (hues.some((hue) => hues.some((other) => angularDistance(hue, other) >= 170 && angularDistance(hue, other) <= 190))) {
    return 'complementary';
  }
  if (hues.length >= 3 && hasTriad(hues)) return 'triadic';
  if (span <= 60) return 'analogous';
  return 'free';
}

export function extractColorsFromCode(code: string): ColorExtractionResult {
  const counts = new Map<string, number>();
  for (const match of code.matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
    const hex = normalizeHex(match[0]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  const colors = [...counts.entries()]
    .map(([hex, count]) => toExtractedColor(hex, count))
    .filter((color): color is ExtractedColor => color !== undefined)
    .sort((a, b) => b.count - a.count);

  const palette = colors.length > 0 ? colors : [toExtractedColor('#000000', 1)!];
  const dominant = palette[0];

  return {
    colors: palette,
    dominant,
    palette,
    harmony: detectHarmony(palette.map(({ h, s, l }) => ({ h, s, l }))),
  };
}

function normalizeHex(hex: string): string {
  const raw = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return raw;
}

function toExtractedColor(hex: string, count: number): ExtractedColor | undefined {
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  return {
    hex: normalizeHex(hex),
    ...rgb,
    ...rgbToHsl(rgb),
    name: getNamedColor(hex),
    count,
  };
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function circularHueSpan(hues: number[]): number {
  if (hues.length <= 1) return 0;

  let largestGap = 0;
  for (let index = 0; index < hues.length; index++) {
    const current = hues[index];
    const next = index === hues.length - 1 ? hues[0] + 360 : hues[index + 1];
    largestGap = Math.max(largestGap, next - current);
  }

  return 360 - largestGap;
}

function hasTriad(hues: number[]): boolean {
  return hues.some((a) =>
    hues.some((b) =>
      hues.some((c) =>
        angularDistance(a, b) >= 110 &&
        angularDistance(a, b) <= 130 &&
        angularDistance(b, c) >= 110 &&
        angularDistance(b, c) <= 130
      )
    )
  );
}
