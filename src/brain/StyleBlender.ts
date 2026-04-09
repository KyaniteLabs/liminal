/**
 * StyleBlender - Blend and interpolate style profiles
 */

export interface StyleWeights {
  complexity?: number;
  colorfulness?: number;
  motion?: number;
  abstraction?: number;
  symmetry?: number;
}

export interface StyleProfile {
  name: string;
  weights: StyleWeights;
}

export interface WeightedProfile {
  profile: StyleProfile;
  weight: number;
}

export const STYLE_ATTRIBUTES = [
  'complexity',
  'colorfulness',
  'motion',
  'abstraction',
  'symmetry',
] as const;

export function blendStyles(weightedProfiles: WeightedProfile[]): StyleProfile {
  if (weightedProfiles.length === 0) {
    return { name: 'empty', weights: {} };
  }

  if (weightedProfiles.length === 1) {
    const { profile } = weightedProfiles[0];
    return { name: profile.name, weights: { ...profile.weights } };
  }

  // Calculate total weight
  const totalWeight = weightedProfiles.reduce((sum, wp) => sum + wp.weight, 0);

  // Blend each attribute
  const blendedWeights: StyleWeights = {};

  for (const attr of STYLE_ATTRIBUTES) {
    let weightedSum = 0;

    for (const { profile, weight } of weightedProfiles) {
      const value = profile.weights[attr] ?? 0.5;
      weightedSum += value * weight;
    }

    blendedWeights[attr] = weightedSum / totalWeight;
  }

  const names = weightedProfiles.map(wp => wp.profile.name);
  const blendedName = names.join(' + ');

  return {
    name: blendedName,
    weights: blendedWeights,
  };
}

export function interpolateProfiles(
  profileA: StyleProfile,
  profileB: StyleProfile,
  t: number
): StyleProfile {
  const clampedT = Math.max(0, Math.min(1, t));

  const interpolatedWeights: StyleWeights = {};

  for (const attr of STYLE_ATTRIBUTES) {
    const valueA = profileA.weights[attr] ?? 0.5;
    const valueB = profileB.weights[attr] ?? 0.5;
    interpolatedWeights[attr] = valueA + (valueB - valueA) * clampedT;
  }

  return {
    name: `${profileA.name} → ${profileB.name}`,
    weights: interpolatedWeights,
  };
}
