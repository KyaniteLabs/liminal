/**
 * ColorTheoryEngine — Harmony generation and validation using classic color theory.
 *
 * All hues are expressed in degrees (0–360). The engine supports seven standard
 * harmony modes and can classify an arbitrary set of hues into the closest rule.
 */

/** Supported harmony mode identifiers. */
export type HarmonyMode =
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'tetradic'
  | 'square';

/** All recognised harmony modes in canonical order. */
export const HARMONY_MODES: HarmonyMode[] = [
  'monochromatic',
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'tetradic',
  'square',
];

/** Offset tables (in degrees) relative to a base hue for each mode. */
const HARMONY_OFFSETS: Record<HarmonyMode, number[]> = {
  monochromatic:      [0, 15, 30, 45],
  analogous:          [0, 30, 60],
  complementary:      [0, 180],
  'split-complementary': [0, 150, 210],
  triadic:            [0, 120, 240],
  tetradic:           [0, 60, 180, 240],
  square:             [0, 90, 180, 270],
};

/** Normalise a hue to the 0–360 range. */
function normalise(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/** Smallest clockwise distance between two hues (0–180). */
function hueDistance(a: number, b: number): number {
  const d = normalise(a - b);
  return d <= 180 ? d : 360 - d;
}

/**
 * Generate a palette of hues conforming to the requested harmony mode.
 *
 * @param baseHue - The root hue in degrees (0–360).
 * @param mode    - One of the seven harmony modes.
 * @returns An array of normalised hues.
 */
export function generateHarmony(baseHue: number, mode: string): number[] {
  const offsets = HARMONY_OFFSETS[mode as HarmonyMode];
  if (!offsets) {
    throw new Error(
      `Unknown harmony mode "${mode}". Expected one of: ${HARMONY_MODES.join(', ')}`,
    );
  }
  return offsets.map((offset) => normalise(baseHue + offset));
}

/**
 * Validate an existing set of hues against known harmony rules.
 *
 * @param hues - Array of hues in degrees (0–360).
 * @returns An object describing the best-matching harmony, validity, and total deviation.
 */
export function validateHarmony(hues: number[]): {
  valid: boolean;
  harmonyType: string;
  deviation: number;
} {
  if (hues.length < 2) {
    return { valid: true, harmonyType: 'monochromatic', deviation: 0 };
  }

  const base = hues[0];
  let bestMode: HarmonyMode = 'monochromatic';
  let bestDeviation = Infinity;

  for (const mode of HARMONY_MODES) {
    const reference = generateHarmony(base, mode);

    // Only consider modes whose expected count matches the input (or is fewer).
    if (reference.length !== hues.length) continue;

    let totalDeviation = 0;
    for (let i = 0; i < hues.length; i++) {
      totalDeviation += hueDistance(hues[i], reference[i]);
    }

    if (totalDeviation < bestDeviation) {
      bestDeviation = totalDeviation;
      bestMode = mode;
    }
  }

  // A palette is considered valid when total deviation is under 30 degrees.
  const VALID_THRESHOLD = 30;
  return {
    valid: bestDeviation <= VALID_THRESHOLD,
    harmonyType: bestMode,
    deviation: Math.round(bestDeviation * 100) / 100,
  };
}
