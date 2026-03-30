import { describe, it, expect } from 'vitest';
/**
 * Swarm personas tests
 */

import { DEFAULT_PERSONAS } from '../../src/swarm/personas.js';
import { DEFAULT_REFINEMENT_CONSTRAINTS } from '../../src/swarm/types.js';

describe('Default Personas', () => {
  it('should have exactly 5 personas', () => {
    expect(DEFAULT_PERSONAS).toHaveLength(5);
  });

  it('should have all expected persona IDs', () => {
    const ids = DEFAULT_PERSONAS.map(p => p.id);
    expect(ids).toContain('max');
    expect(ids).toContain('rex');
    expect(ids).toContain('sam');
    expect(ids).toContain('kai');
    expect(ids).toContain('nova');
  });

  it('should have unique IDs', () => {
    const ids = DEFAULT_PERSONAS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have valid voting powers', () => {
    const powers = DEFAULT_PERSONAS.map(p => p.votingPower);
    expect(powers.every(p => p >= 1 && p <= 5)).toBe(true);
  });

  it('should have balanced voting power (all equal to 2)', () => {
    const powers = DEFAULT_PERSONAS.map(p => p.votingPower);
    expect(powers.every(p => p === 2)).toBe(true);
  });

  it('should have valid temperatures (0-2)', () => {
    const temps = DEFAULT_PERSONAS.map(p => p.temperature);
    expect(temps.every(t => t >= 0 && t <= 2)).toBe(true);
  });

  it('should have required fields for each persona', () => {
    for (const persona of DEFAULT_PERSONAS) {
      expect(persona.id).toBeTruthy();
      expect(persona.name).toBeTruthy();
      expect(persona.displayName).toBeTruthy();
      expect(persona.model).toBeTruthy();
      expect(persona.systemPrompt).toBeTruthy();
      expect(persona.voice).toBeTruthy();
      expect(persona.thinkingStyle).toBeTruthy();
      expect(persona.votingBias).toBeTruthy();
      expect(persona.constraints.length).toBeGreaterThan(0);
      expect(persona.votingPower).toBeGreaterThan(0);
    }
  });

  it('should have Nova as Synthesizer', () => {
    const nova = DEFAULT_PERSONAS.find(p => p.id === 'nova');
    expect(nova).toBeDefined();
    expect(nova!.displayName).toBe('The Synthesizer');
    expect(nova!.model).toBe('gemma3:4b');
  });

  it('should have Max as Distiller with lowest temperature', () => {
    const max = DEFAULT_PERSONAS.find(p => p.id === 'max');
    expect(max).toBeDefined();
    expect(max!.displayName).toBe('The Distiller');
    expect(max!.temperature).toBeLessThanOrEqual(0.5);
  });

  it('should cover all creative dimensions without overlap', () => {
    const roles = DEFAULT_PERSONAS.map(p => p.displayName);
    expect(roles).toContain('The Architect');
    expect(roles).toContain('The Synthesizer');
    expect(roles).toContain('The Explorer');
    expect(roles).toContain('The Muse');
    expect(roles).toContain('The Distiller');
  });
});

describe('Default Refinement Constraints', () => {
  it('should have exactly 4 constraints', () => {
    expect(DEFAULT_REFINEMENT_CONSTRAINTS).toHaveLength(4);
  });

  it('should have non-empty constraints', () => {
    for (const constraint of DEFAULT_REFINEMENT_CONSTRAINTS) {
      expect(constraint.length).toBeGreaterThan(0);
    }
  });
});
