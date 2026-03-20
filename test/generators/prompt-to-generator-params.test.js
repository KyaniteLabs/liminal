/**
 * prompt-to-generator-params.test.js
 * TDD: when run with "calm blue particles", params or generated code include something derived from "blue" or "calm".
 */
import { promptToGeneratorParams } from '../../src/utils/promptToGeneratorParams.js';
import { ParticleSystem } from '../../src/generators/p5/ParticleSystem.js';

describe('promptToGeneratorParams', () => {
  it('returns an object with at least one key that ParticleSystem accepts', () => {
    const params = promptToGeneratorParams('anything');
    expect(typeof params).toBe('object');
    expect(params).not.toBeNull();
    // ParticleSystem accepts: palette, speed, particleCount, etc.
    const allowedKeys = ['palette', 'speed', 'particleCount', 'timeStep', 'decay', 'attraction'];
    const hasAny = Object.keys(params).some(k => allowedKeys.includes(k));
    expect(hasAny).toBe(true);
  });

  it('derives palette or speed from "calm blue particles"', () => {
    const params = promptToGeneratorParams('calm blue particles');
    // "blue" -> palette 'cool' (ParticleSystem uses cool = blue/cyan/purple)
    const hasBlueDerived = params.palette === 'cool' || (params.palette && String(params.palette).toLowerCase().includes('blue'));
    // "calm" -> lower speed
    const hasCalmDerived = typeof params.speed === 'number' && params.speed < 2;
    expect(hasBlueDerived || hasCalmDerived).toBe(true);
  });

  it('when passed to ParticleSystem.generate(), output includes something derived from blue or calm', () => {
    const params = promptToGeneratorParams('calm blue particles');
    const code = ParticleSystem.generate(params);
    // ParticleSystem with palette 'cool' emits comment "cool colors - blue, cyan, purple" or similar
    const hasBlueInCode = /blue|cool|cyan|purple/i.test(code);
    // Calm -> lower speed in code (e.g. random(-0.8, 0.8) or similar)
    const hasCalmInCode = /random\s*\(\s*-\s*[0-1]\.?\d*\s*,\s*[0-1]\.?\d*\s*\)/.test(code) || /speed.*[0-1]\.?\d+/.test(code);
    expect(hasBlueInCode || hasCalmInCode).toBe(true);
  });
});
