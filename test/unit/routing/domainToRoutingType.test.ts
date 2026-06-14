/**
 * domainToRoutingType maps a creative Domain (p5/hydra/strudel/…) to the coarse
 * routing bucket the smart router/bandit keys on. It replaces the old lying cast
 * `collabDomain as 'ascii'|'music'|'code'|'visual'` in the routing recorder,
 * which excluded revideo/html/webdev and force-bucketed every visual domain (B1
 * domain half + the 0.1 keyspace remainder).
 */
import { describe, it, expect } from 'vitest';
import { domainToRoutingType } from '../../../src/routing/RoutingData.js';

describe('domainToRoutingType', () => {
  it('maps visual/graphics domains to "visual"', () => {
    for (const d of ['p5', 'hydra', 'shader', 'glsl', 'webgl', 'three', 'kinetic', 'svg', 'hyperframes']) {
      expect(domainToRoutingType(d)).toBe('visual');
    }
  });

  it('maps audio domains to "music"', () => {
    expect(domainToRoutingType('tone')).toBe('music');
    expect(domainToRoutingType('strudel')).toBe('music');
    expect(domainToRoutingType('music')).toBe('music');
  });

  it('maps text-art domains to "ascii"', () => {
    expect(domainToRoutingType('ascii')).toBe('ascii');
    expect(domainToRoutingType('textgen')).toBe('ascii');
  });

  it('passes through the buckets that already match a domain name', () => {
    expect(domainToRoutingType('code')).toBe('code');
    expect(domainToRoutingType('html')).toBe('html');
    expect(domainToRoutingType('webdev')).toBe('webdev');
    expect(domainToRoutingType('revideo')).toBe('revideo');
  });

  it('is case-insensitive', () => {
    expect(domainToRoutingType('P5')).toBe('visual');
    expect(domainToRoutingType('Strudel')).toBe('music');
  });

  it('falls back to "visual" for unknown/empty/nullish domains', () => {
    expect(domainToRoutingType('unknown')).toBe('visual');
    expect(domainToRoutingType('generic')).toBe('visual');
    expect(domainToRoutingType('')).toBe('visual');
    expect(domainToRoutingType(null)).toBe('visual');
    expect(domainToRoutingType(undefined)).toBe('visual');
    expect(domainToRoutingType('totally-made-up')).toBe('visual');
  });
});
