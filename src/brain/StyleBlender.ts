export const STYLE_ATTRIBUTES = ['complexity', 'colorfulness', 'motion', 'abstraction', 'symmetry'] as const;

export type StyleAttribute = typeof STYLE_ATTRIBUTES[number];

export interface StyleProfile {
  name: string;
  weights: Partial<Record<StyleAttribute, number>>;
}

export interface WeightedStyle {
  profile: StyleProfile;
  weight: number;
}

function normalizeWeight(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

export function blendStyles(styles: WeightedStyle[]): StyleProfile {
  if (styles.length === 0) {
    return { name: 'empty', weights: {} };
  }

  if (styles.length === 1) {
    return { name: styles[0].profile.name, weights: { ...styles[0].profile.weights } };
  }

  const totalWeight = styles.reduce((sum, style) => sum + Math.max(0, style.weight), 0);
  if (totalWeight === 0) {
    return { name: 'empty', weights: {} };
  }

  const weights: Partial<Record<StyleAttribute, number>> = {};
  for (const attribute of STYLE_ATTRIBUTES) {
    let weightedTotal = 0;
    let seenWeight = 0;
    for (const style of styles) {
      const normalizedWeight = Math.max(0, style.weight);
      const value = style.profile.weights[attribute];
      if (value !== undefined) {
        weightedTotal += value * normalizedWeight;
        seenWeight += normalizedWeight;
      }
    }
    if (seenWeight > 0) weights[attribute] = normalizeWeight(weightedTotal / seenWeight);
  }

  return {
    name: styles.map((style) => style.profile.name).join(' + '),
    weights,
  };
}

export function interpolateProfiles(a: StyleProfile, b: StyleProfile, t: number): StyleProfile {
  const amount = Math.max(0, Math.min(1, t));
  const weights: Partial<Record<StyleAttribute, number>> = {};
  for (const attribute of STYLE_ATTRIBUTES) {
    const start = a.weights[attribute] ?? 0;
    const end = b.weights[attribute] ?? start;
    weights[attribute] = normalizeWeight(start + (end - start) * amount);
  }
  return {
    name: `${a.name} -> ${b.name}`,
    weights,
  };
}
