import { describe, expect, it } from 'vitest';
import {
  CREATIVE_DOMAIN_GAUNTLET_DOMAINS,
  runCreativeDomainGauntlet,
} from '../../../src/runtime-core/CreativeDomainGauntlet.js';

describe('runCreativeDomainGauntlet', () => {
  it('covers every preserved creative domain with route, implementation, and verification metadata', () => {
    const result = runCreativeDomainGauntlet();

    expect(result.total).toBe(CREATIVE_DOMAIN_GAUNTLET_DOMAINS.length);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(result.total);
    expect(result.ready).toBe(true);
    expect(result.domains.map((domain) => domain.id)).toEqual([
      'p5',
      'glsl',
      'three',
      'svg',
      'hydra',
      'strudel',
      'tone',
      'revideo',
      'ascii',
      'kinetic',
      'textgen',
    ]);
    expect(result.domains.every((domain) => domain.checks.route && domain.checks.implementation && domain.checks.verification)).toBe(true);
  });
});
