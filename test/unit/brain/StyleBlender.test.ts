import { describe, it, expect } from 'vitest';
import {
  blendStyles,
  interpolateProfiles,
  STYLE_ATTRIBUTES,
} from '../../../src/brain/StyleBlender.js';
import type { StyleProfile } from '../../../src/brain/StyleBlender.js';

describe('StyleBlender', () => {
  const profileA: StyleProfile = {
    name: 'Minimalist',
    weights: { complexity: 0.2, colorfulness: 0.4, motion: 0.1, abstraction: 0.3, symmetry: 0.8 },
  };
  const profileB: StyleProfile = {
    name: 'Expressionist',
    weights: { complexity: 0.9, colorfulness: 0.8, motion: 0.7, abstraction: 0.6 },
  };

  it('blends two profiles with weighted averaging', () => {
    const result = blendStyles([
      { profile: profileA, weight: 1 },
      { profile: profileB, weight: 1 },
    ]);
    expect(result.name).toContain('+');
    expect(result.weights.complexity).toBeCloseTo(0.55, 3);
  });

  it('returns empty profile for zero styles', () => {
    const result = blendStyles([]);
    expect(result.name).toBe('empty');
  });

  it('returns copy for single style', () => {
    const result = blendStyles([{ profile: profileA, weight: 1 }]);
    expect(result.name).toBe('Minimalist');
    expect(result.weights).toEqual(profileA.weights);
  });

  it('interpolates between two profiles at t=0 and t=1', () => {
    const at0 = interpolateProfiles(profileA, profileB, 0);
    expect(at0.weights.complexity).toBe(0.2);
    const at1 = interpolateProfiles(profileA, profileB, 1);
    expect(at1.weights.complexity).toBe(0.9);
  });

  it('exports canonical style attributes', () => {
    expect(STYLE_ATTRIBUTES).toHaveLength(5);
  });
});
