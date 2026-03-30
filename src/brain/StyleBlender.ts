/**
 * StyleBlender — Weighted style mixing and interpolation for creative profiles.
 *
 * A StyleProfile captures quantitative attributes of a visual style. This module
 * provides weighted blending (arithmetic mean) and linear interpolation between
 * two profiles.
 */

/** Attribute keys used in a style profile. */
export type StyleAttribute =
  | 'complexity'
  | 'colorfulness'
  | 'motion'
  | 'abstraction'
  | 'symmetry';

/** The canonical set of style attributes with sensible defaults. */
export const STYLE_ATTRIBUTES: StyleAttribute[] = [
  'complexity',
  'colorfulness',
  'motion',
  'abstraction',
  'symmetry',
];

/** A named set of weighted style attributes. */
export interface StyleProfile {
  /** Human-readable name for the profile. */
  name: string;
  /** Attribute weights (0–1). Keys are style attributes. */
  weights: Record<string, number>;
}

/**
 * Blend multiple style profiles using weighted averaging.
 *
 * Each profile contributes proportionally to its assigned weight. The resulting
 * profile's name lists all source names joined by "+".
 *
 * @param styles - Array of profiles with their blend weights. Weights are
 *                 normalised internally so they do not need to sum to 1.
 * @returns A new StyleProfile representing the weighted blend.
 */
export function blendStyles(
  styles: Array<{ profile: StyleProfile; weight: number }>,
): StyleProfile {
  if (styles.length === 0) {
    return { name: 'empty', weights: {} };
  }

  if (styles.length === 1) {
    return { ...styles[0].profile, weights: { ...styles[0].profile.weights } };
  }

  const totalWeight = styles.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) {
    return { name: 'empty', weights: {} };
  }

  const blendedWeights: Record<string, number> = {};

  // Collect all attribute keys present across all profiles.
  const allKeys = new Set<string>();
  for (const { profile } of styles) {
    for (const key of Object.keys(profile.weights)) {
      allKeys.add(key);
    }
  }

  for (const key of allKeys) {
    let value = 0;
    for (const { profile, weight } of styles) {
      const attrValue = profile.weights[key] ?? 0;
      value += attrValue * (weight / totalWeight);
    }
    blendedWeights[key] = Math.round(value * 10000) / 10000;
  }

  const name = styles.map((s) => s.profile.name).join(' + ');
  return { name, weights: blendedWeights };
}

/**
 * Linearly interpolate between two style profiles.
 *
 * At t=0 the result is identical to profile `a`; at t=1 it matches `b`.
 * Intermediate values produce a smooth blend. The result name indicates the
 * interpolation ratio.
 *
 * @param a - Start profile.
 * @param b - End profile.
 * @param t - Interpolation factor (0–1).
 * @returns A new StyleProfile representing the interpolated state.
 */
export function interpolateProfiles(
  a: StyleProfile,
  b: StyleProfile,
  t: number,
): StyleProfile {
  const clamped = Math.max(0, Math.min(1, t));
  const weights: Record<string, number> = {};

  const allKeys = new Set<string>([
    ...Object.keys(a.weights),
    ...Object.keys(b.weights),
  ]);

  for (const key of allKeys) {
    const va = a.weights[key] ?? 0;
    const vb = b.weights[key] ?? 0;
    const interpolated = va + (vb - va) * clamped;
    weights[key] = Math.round(interpolated * 10000) / 10000;
  }

  return {
    name: `${a.name}→${b.name} (${Math.round(clamped * 100)}%)`,
    weights,
  };
}
