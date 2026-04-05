import { describe, it, expect } from 'vitest';
import {
  crossoverReasoning,
  combineReasoning,
  DOMAIN_MAPPINGS,
  type CreativeDomain,
} from '../../../src/evolution/CrossDomainCrossover.js';

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN_MAPPINGS structure
// ═══════════════════════════════════════════════════════════════════════════

describe('DOMAIN_MAPPINGS', () => {
  it('contains all 6 bidirectional mapping pairs', () => {
    const keys = Object.keys(DOMAIN_MAPPINGS);
    expect(keys).toContain('music→visual');
    expect(keys).toContain('visual→music');
    expect(keys).toContain('visual→code');
    expect(keys).toContain('code→visual');
    expect(keys).toContain('code→music');
    expect(keys).toContain('music→code');
    expect(keys).toHaveLength(6);
  });

  it('each mapping has source, target, techniqueMap, and decisionMap', () => {
    for (const mapping of Object.values(DOMAIN_MAPPINGS)) {
      expect(mapping.source).toBeTruthy();
      expect(mapping.target).toBeTruthy();
      expect(typeof mapping.techniqueMap).toBe('object');
      expect(typeof mapping.decisionMap).toBe('object');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// crossoverReasoning
// ═══════════════════════════════════════════════════════════════════════════

describe('crossoverReasoning', () => {
  it('transfers music technique to visual domain', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', { bpm: 120 });
    expect(result.sourceDomain).toBe('music');
    expect(result.targetDomain).toBe('visual');
    expect(result.transferredTechniques).toEqual(['animation_speed']);
    expect(result.adaptedDecisions.bpm).toBe(0.75); // 120/160 = 0.75
  });

  it('transfers music key to visual color_palette', () => {
    const result = crossoverReasoning('music', 'visual', 'key', { scale: 'major' });
    expect(result.transferredTechniques).toEqual(['color_palette']);
    expect(result.adaptedDecisions.scale).toBe('warm');
  });

  it('transfers music velocity to visual opacity', () => {
    const result = crossoverReasoning('music', 'visual', 'volume', { velocity: 100 });
    expect(result.adaptedDecisions.velocity).toBe(0.79); // 100/127 ≈ 0.79
  });

  it('transfers visual technique to music domain', () => {
    const result = crossoverReasoning('visual', 'music', 'animation_speed', { animation_speed: 0.5 });
    expect(result.transferredTechniques).toEqual(['tempo']);
    expect(result.adaptedDecisions.animation_speed).toBe(80); // 0.5 * 160
  });

  it('transfers visual palette_tone to music scale', () => {
    const result = crossoverReasoning('visual', 'music', 'color_palette', { palette_tone: 'warm' });
    expect(result.adaptedDecisions.palette_tone).toBe('major');
  });

  it('transfers visual palette_tone cool to minor', () => {
    const result = crossoverReasoning('visual', 'music', 'opacity', { palette_tone: 'cool' });
    expect(result.adaptedDecisions.palette_tone).toBe('minor');
  });

  it('transfers visual to code domain', () => {
    const result = crossoverReasoning('visual', 'code', 'color', { hue: 100 });
    expect(result.transferredTechniques).toEqual(['variable_naming']);
    expect(result.adaptedDecisions.hue).toBe('descriptive'); // < 180
  });

  it('transfers visual hue > 180 to concise naming', () => {
    const result = crossoverReasoning('visual', 'code', 'color', { hue: 200 });
    expect(result.adaptedDecisions.hue).toBe('concise');
  });

  it('transfers visual grid_density to code structure', () => {
    const result = crossoverReasoning('visual', 'code', 'layout', { grid_density: 0.8 });
    expect(result.transferredTechniques).toEqual(['code_structure']);
    expect(result.adaptedDecisions.grid_density).toBe('modular'); // > 0.5
  });

  it('transfers visual grid_density ≤ 0.5 to flat structure', () => {
    const result = crossoverReasoning('visual', 'code', 'layout', { grid_density: 0.3 });
    expect(result.adaptedDecisions.grid_density).toBe('flat');
  });

  it('transfers visual layer_count to code complexity', () => {
    const result = crossoverReasoning('visual', 'code', 'complexity', { layer_count: 3.7 });
    expect(result.adaptedDecisions.layer_count).toBe(4); // rounded
  });

  it('transfers code to visual domain', () => {
    const result = crossoverReasoning('code', 'visual', 'variable_naming', { naming_style: 'descriptive' });
    expect(result.transferredTechniques).toEqual(['color']);
    expect(result.adaptedDecisions.naming_style).toBe(30); // descriptive → 30
  });

  it('transfers code concise naming to high hue', () => {
    const result = crossoverReasoning('code', 'visual', 'variable_naming', { naming_style: 'concise' });
    expect(result.adaptedDecisions.naming_style).toBe(210);
  });

  it('transfers code modular structure to high grid density', () => {
    const result = crossoverReasoning('code', 'visual', 'code_structure', { structure_type: 'modular' });
    expect(result.adaptedDecisions.structure_type).toBe(0.8);
  });

  it('transfers code flat structure to low grid density', () => {
    const result = crossoverReasoning('code', 'visual', 'code_structure', { structure_type: 'flat' });
    expect(result.adaptedDecisions.structure_type).toBe(0.2);
  });

  it('transfers code to music domain', () => {
    const result = crossoverReasoning('code', 'music', 'function_count', { functions: 15 });
    expect(result.transferredTechniques).toEqual(['voice_count']);
    expect(result.adaptedDecisions.functions).toBe(3); // 15/5 = 3
  });

  it('clamps code→music voice count to max 8', () => {
    const result = crossoverReasoning('code', 'music', 'function_count', { functions: 50 });
    expect(result.adaptedDecisions.functions).toBe(8); // clamped
  });

  it('clamps code→music voice count to min 1', () => {
    const result = crossoverReasoning('code', 'music', 'function_count', { functions: 0 });
    expect(result.adaptedDecisions.functions).toBe(1);
  });

  it('transfers code depth to music layers', () => {
    const result = crossoverReasoning('code', 'music', 'nesting', { depth: 4.5 });
    expect(result.adaptedDecisions.depth).toBe(5); // rounded, clamped to max 6
  });

  it('transfers code lines to music duration', () => {
    const result = crossoverReasoning('code', 'music', 'loc', { lines: 100 });
    expect(result.adaptedDecisions.lines).toBe(60); // 100/200 * 120
  });

  it('transfers music to code domain', () => {
    const result = crossoverReasoning('music', 'code', 'voice_count', { voices: 3 });
    expect(result.transferredTechniques).toEqual(['function_count']);
    expect(result.adaptedDecisions.voices).toBe(15); // 3 * 5
  });

  it('transfers music seconds to code lines', () => {
    const result = crossoverReasoning('music', 'code', 'duration', { seconds: 60 });
    expect(result.adaptedDecisions.seconds).toBe(100); // 60/120 * 200
  });

  it('uses identity fallback for unmapped domain pair', () => {
    const result = crossoverReasoning('shader', 'audio', 'fragment', { intensity: 0.5 });
    expect(result.sourceDomain).toBe('shader');
    expect(result.targetDomain).toBe('audio');
    expect(result.transferredTechniques).toEqual(['fragment_as_audio']);
    expect(result.adaptedDecisions.intensity).toBe(0.5); // pass-through
  });

  it('uses fallback for unknown technique in mapped domain', () => {
    const result = crossoverReasoning('music', 'visual', 'unknown_technique', {});
    expect(result.transferredTechniques).toEqual(['unknown_technique_as_visual']);
  });

  it('passes through string values through decisionMap for non-matching type', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', { bpm: 'fast' });
    expect(result.adaptedDecisions.bpm).toBe('fast'); // string passthrough
  });

  it('computes creativity level automatically', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', { bpm: 120, scale: 'major' });
    expect(result.creativityLevel).toBeGreaterThanOrEqual(0);
    expect(result.creativityLevel).toBeLessThanOrEqual(1);
  });

  it('uses explicit creativity hint when provided', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', {}, 0.85);
    expect(result.creativityLevel).toBe(0.85);
  });

  it('clamps creativity hint above 1', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', {}, 1.5);
    expect(result.creativityLevel).toBe(1);
  });

  it('clamps creativity hint below 0', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', {}, -0.5);
    expect(result.creativityLevel).toBe(0);
  });

  it('higher creativity for unmapped pairs than mapped', () => {
    const mapped = crossoverReasoning('music', 'visual', 'tempo', {});
    const unmapped = crossoverReasoning('shader', 'audio', 'test', {});
    expect(unmapped.creativityLevel).toBeGreaterThan(mapped.creativityLevel);
  });

  it('handles empty decisions', () => {
    const result = crossoverReasoning('music', 'visual', 'tempo', {});
    expect(result.adaptedDecisions).toEqual({});
    expect(result.transferredTechniques).toEqual(['animation_speed']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// combineReasoning
// ═══════════════════════════════════════════════════════════════════════════

describe('combineReasoning', () => {
  it('returns empty for empty sources', () => {
    const result = combineReasoning([]);
    expect(result.hybridTechnique).toBe('');
    expect(result.domains).toEqual([]);
  });

  it('combines a single source', () => {
    const result = combineReasoning([{ domain: 'visual', technique: 'color', weight: 1.0 }]);
    expect(result.hybridTechnique).toBe('color');
    expect(result.domains).toEqual(['visual']);
  });

  it('sorts by weight descending', () => {
    const result = combineReasoning([
      { domain: 'visual', technique: 'color', weight: 0.3 },
      { domain: 'music', technique: 'tempo', weight: 0.8 },
      { domain: 'code', technique: 'function', weight: 0.5 },
    ]);
    expect(result.hybridTechnique).toBe('tempo-function-color');
    expect(result.domains).toEqual(['music', 'code', 'visual']);
  });

  it('combines two sources with equal weight (stable order)', () => {
    const result = combineReasoning([
      { domain: 'audio', technique: 'reverb', weight: 0.5 },
      { domain: 'visual', technique: 'blur', weight: 0.5 },
    ]);
    // Both weight 0.5 — sort is stable so original order preserved
    expect(result.hybridTechnique).toBe('reverb-blur');
    expect(result.domains).toEqual(['audio', 'visual']);
  });
});
