/**
 * ColorTheoryEngine - Generate and validate color harmonies
 */

export const HARMONY_MODES = [
  'monochromatic',
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'tetradic',
  'square',
] as const;

export type HarmonyMode = typeof HARMONY_MODES[number];

export interface HarmonyValidationResult {
  valid: boolean;
  harmonyType: string;
  score?: number;
}

export function generateHarmony(baseHue: number, mode: string): number[] {
  const normalizedHue = ((baseHue % 360) + 360) % 360;

  switch (mode) {
    case 'monochromatic':
      return [normalizedHue];

    case 'analogous':
      return [
        (normalizedHue - 30 + 360) % 360,
        normalizedHue,
        (normalizedHue + 30) % 360,
      ];

    case 'complementary':
      return [normalizedHue, (normalizedHue + 180) % 360];

    case 'split-complementary':
      return [
        normalizedHue,
        (normalizedHue + 150) % 360,
        (normalizedHue + 210) % 360,
      ];

    case 'triadic':
      return [
        normalizedHue,
        (normalizedHue + 120) % 360,
        (normalizedHue + 240) % 360,
      ];

    case 'tetradic':
      return [
        normalizedHue,
        (normalizedHue + 90) % 360,
        (normalizedHue + 180) % 360,
        (normalizedHue + 270) % 360,
      ];

    case 'square':
      return [
        normalizedHue,
        (normalizedHue + 90) % 360,
        (normalizedHue + 180) % 360,
        (normalizedHue + 270) % 360,
      ];

    default:
      throw new Error(`Unknown harmony mode: ${mode}`);
  }
}

export function validateHarmony(hues: number[]): HarmonyValidationResult {
  if (hues.length === 0) {
    return { valid: false, harmonyType: 'none' };
  }

  if (hues.length === 1) {
    return { valid: true, harmonyType: 'monochromatic', score: 1.0 };
  }

  // Sort hues for analysis
  const sorted = [...hues].sort((a, b) => a - b);
  const differences: number[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const diff = (next - sorted[i] + 360) % 360;
    differences.push(diff);
  }

  // Check for complementary (roughly 180° apart)
  const hasComplementary = differences.some((d) => Math.abs(d - 180) < 15);
  if (hasComplementary && hues.length === 2) {
    return { valid: true, harmonyType: 'complementary', score: 0.95 };
  }

  // Check for triadic (roughly 120° apart)
  const isTriadic = differences.every((d) => Math.abs(d - 120) < 15);
  if (isTriadic && hues.length === 3) {
    return { valid: true, harmonyType: 'triadic', score: 0.9 };
  }

  // Check for analogous (within 30° of each other)
  const hueRange = sorted[sorted.length - 1] - sorted[0];
  if (hueRange < 60) {
    return { valid: true, harmonyType: 'analogous', score: 0.85 };
  }

  return { valid: true, harmonyType: 'varied', score: 0.5 };
}
