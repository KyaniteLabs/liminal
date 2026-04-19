import type { HarmonyMode, TemperatureBalance } from './types.js';

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

export type PaletteRole = 'background' | 'primary' | 'secondary' | 'accent' | 'highlight';

export interface PaletteColor {
  role: PaletteRole;
  hex: string;
  hsl: HSLColor;
}

export interface ColorTheoryRequest {
  seed: string;
  harmonyMode?: HarmonyMode;
  temperatureBalance?: TemperatureBalance;
  count?: number;
  contrastTarget?: number;
}

export interface ColorTheoryEvaluation {
  score: number;
  contrastRatio: number;
  passedContrast: boolean;
  harmonyMode: HarmonyMode;
  temperatureBalance: TemperatureBalance;
  notes: string[];
}

export interface ColorTheoryPalette {
  seed: string;
  harmonyMode: HarmonyMode;
  temperatureBalance: TemperatureBalance;
  colors: PaletteColor[];
  evaluation: ColorTheoryEvaluation;
  guidance: string;
}

const DEFAULT_CONTRAST_TARGET = 4.5;
const ROLES: PaletteRole[] = ['background', 'primary', 'secondary', 'accent', 'highlight'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function channelToHex(value: number): string {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
}

export function rgbToHex(color: RGBColor): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`;
}

export function parseHexColor(hex: string): RGBColor {
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cleaned)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const expanded = cleaned.length === 3
    ? cleaned.split('').map(char => char + char).join('')
    : cleaned;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function rgbToHsl(color: RGBColor): HSLColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = 60 * (((g - b) / delta) % 6);
  if (max === g) h = 60 * ((b - r) / delta + 2);
  if (max === b) h = 60 * ((r - g) / delta + 4);
  return { h: normalizeHue(h), s, l };
}

export function hslToRgb(color: HSLColor): RGBColor {
  const h = normalizeHue(color.h);
  const s = clamp(color.s, 0, 1);
  const l = clamp(color.l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let channels: [number, number, number] = [0, 0, 0];

  if (h < 60) channels = [c, x, 0];
  else if (h < 120) channels = [x, c, 0];
  else if (h < 180) channels = [0, c, x];
  else if (h < 240) channels = [0, x, c];
  else if (h < 300) channels = [x, 0, c];
  else channels = [c, 0, x];

  return {
    r: (channels[0] + m) * 255,
    g: (channels[1] + m) * 255,
    b: (channels[2] + m) * 255,
  };
}

function relativeLuminance(color: RGBColor): number {
  const [r, g, b] = [color.r, color.g, color.b].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(parseHexColor(a));
  const second = relativeLuminance(parseHexColor(b));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function hueOffsets(mode: HarmonyMode): number[] {
  const offsets: Record<HarmonyMode, number[]> = {
    analogous: [0, -28, 28, -52, 52],
    complementary: [0, 180, -24, 156, 204],
    triadic: [0, 120, 240, 24, 216],
    'split-complementary': [0, 150, 210, -24, 24],
    monochromatic: [0, 0, 0, 0, 0],
    free: [0, 45, 160, 245, 310],
  };
  return offsets[mode];
}

function temperatureOffset(balance: TemperatureBalance): number {
  if (balance === 'warm') return 14;
  if (balance === 'cool') return -14;
  return 0;
}

function colorForRole(role: PaletteRole, seed: HSLColor, offset: number, index: number, balance: TemperatureBalance): PaletteColor {
  const lightness: Record<PaletteRole, number> = {
    background: 0.12,
    primary: 0.78,
    secondary: 0.6,
    accent: 0.66,
    highlight: 0.88,
  };
  const saturation: Record<PaletteRole, number> = {
    background: 0.34,
    primary: 0.72,
    secondary: 0.62,
    accent: 0.82,
    highlight: 0.7,
  };
  const hsl = {
    h: normalizeHue(seed.h + offset + temperatureOffset(balance)),
    s: clamp((seed.s + saturation[role]) / 2 + index * 0.012, 0.16, 0.9),
    l: lightness[role],
  };
  return { role, hsl, hex: rgbToHex(hslToRgb(hsl)) };
}

export function createColorTheoryPalette(request: ColorTheoryRequest): ColorTheoryPalette {
  const count = Math.round(clamp(request.count ?? 5, 3, 5));
  const harmonyMode = request.harmonyMode ?? 'split-complementary';
  const temperatureBalance = request.temperatureBalance ?? 'balanced';
  const seed = rgbToHex(parseHexColor(request.seed));
  const seedHsl = rgbToHsl(parseHexColor(seed));
  const colors = hueOffsets(harmonyMode)
    .slice(0, count)
    .map((offset, index) => colorForRole(ROLES[index], seedHsl, offset, index, temperatureBalance));
  const evaluation = evaluateColorTheoryPalette(colors, {
    harmonyMode,
    temperatureBalance,
    contrastTarget: request.contrastTarget ?? DEFAULT_CONTRAST_TARGET,
  });
  return {
    seed,
    harmonyMode,
    temperatureBalance,
    colors,
    evaluation,
    guidance: buildColorTheoryGuidance(colors, evaluation),
  };
}

export function evaluateColorTheoryPalette(
  colors: PaletteColor[],
  options: { harmonyMode: HarmonyMode; temperatureBalance: TemperatureBalance; contrastTarget?: number },
): ColorTheoryEvaluation {
  const background = colors.find(color => color.role === 'background') ?? colors[0];
  const primary = colors.find(color => color.role === 'primary') ?? colors[1] ?? colors[0];
  const ratio = contrastRatio(background.hex, primary.hex);
  const target = options.contrastTarget ?? DEFAULT_CONTRAST_TARGET;
  const hueBuckets = new Set(colors.map(color => Math.round(color.hsl.h / 15) * 15));
  const harmonyScore = options.harmonyMode === 'monochromatic'
    ? 1 - Math.min(0.35, Math.max(0, hueBuckets.size - 2) * 0.08)
    : Math.min(1, 0.58 + hueBuckets.size * 0.09);
  const contrastScore = Math.min(1, ratio / target);
  const score = Number((contrastScore * 0.6 + harmonyScore * 0.4).toFixed(3));
  const notes = [
    `${options.harmonyMode} palette with ${colors.length} colors`,
    `background/primary contrast ${ratio}:1`,
    `${options.temperatureBalance} temperature target`,
  ];
  if (ratio < target) notes.push(`contrast below ${target}:1 target`);
  return {
    score,
    contrastRatio: ratio,
    passedContrast: ratio >= target,
    harmonyMode: options.harmonyMode,
    temperatureBalance: options.temperatureBalance,
    notes,
  };
}

export function buildColorTheoryGuidance(colors: PaletteColor[], evaluation: ColorTheoryEvaluation): string {
  const palette = colors.map(color => `${color.role} ${color.hex}`).join(', ');
  return [
    `Use a ${evaluation.harmonyMode} palette: ${palette}.`,
    `Keep primary foregrounds near ${evaluation.contrastRatio}:1 contrast against the background.`,
    'Use accent and highlight colors sparingly for focal points, motion trails, state changes, or interaction feedback.',
    'Keep guidance principle-based: harmony, contrast, hierarchy, rhythm, balance, and accessibility.',
  ].join(' ');
}
