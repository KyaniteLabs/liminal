import { describe, it, expect } from 'vitest';
import type {
  DesignConstraints, AestheticViolation, AestheticReport,
  CriticConfig, AestheticPreset
} from '../../../src/aesthetic/types.js';
import { DEFAULT_DESIGN_CONSTRAINTS, PRESET_PROFILES } from '../../../src/aesthetic/types.js';

describe('Aesthetic types', () => {
  it('DesignConstraints has all constraint categories', () => {
    const c: DesignConstraints = {
      color: { harmonyMode: 'analogous', maxColors: 5, saturationRange: [0.1, 0.9], lightnessRange: [0.2, 0.8], contrastMin: 4.5, temperatureBalance: 'balanced' },
      layout: { focalPointRequired: true, minWhitespace: 0.2, balanceThreshold: 0.6, compositionGuide: 'rule-of-thirds' },
      typography: { maxFonts: 2, sizeHierarchyRequired: true, minReadability: 4.5, fontStyle: 'any' },
      sound: { maxDissonance: 0.3, rhythmicCoherenceMin: 0.6, tonalCenterRequired: true },
      general: { complexityRange: [0.3, 0.8], forbiddenPatterns: [], minAestheticScore: 0.6 }
    };
    expect(c.color.maxColors).toBe(5);
  });

  it('AestheticViolation has required fields', () => {
    const v: AestheticViolation = { rule: 'max-colors', severity: 'error', message: 'Too many colors', location: 'line 42' };
    expect(v.severity).toBe('error');
  });

  it('AestheticReport has score, violations, passed', () => {
    const r: AestheticReport = { score: 0.8, violations: [], passed: true, timestamp: Date.now() };
    expect(r.passed).toBe(true);
  });

  it('DEFAULT_DESIGN_CONSTRAINTS has sensible values', () => {
    expect(DEFAULT_DESIGN_CONSTRAINTS.color.maxColors).toBe(7);
    expect(DEFAULT_DESIGN_CONSTRAINTS.general.minAestheticScore).toBe(0.6);
  });

  it('PRESET_PROFILES has minimalist, vibrant, cinematic, playful, free', () => {
    expect(Object.keys(PRESET_PROFILES)).toContain('minimalist');
    expect(Object.keys(PRESET_PROFILES)).toContain('vibrant');
    expect(Object.keys(PRESET_PROFILES)).toContain('cinematic');
    expect(Object.keys(PRESET_PROFILES)).toContain('playful');
    expect(Object.keys(PRESET_PROFILES)).toContain('free');
  });
});
