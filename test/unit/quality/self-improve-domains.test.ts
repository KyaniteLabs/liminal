import { describe, expect, it } from 'vitest';

// The self-improvement cycle's domain-targeting helpers (pure module, no side effects).
import {
  DOMAIN_TEMPLATES,
  TARGET_DOMAINS,
  MAX_PER_DOMAIN,
  pickUnderfilledDomains,
  buildDomainPrompt,
  // @ts-expect-error — .mjs helper has no type declarations; imported for behavior only.
} from '../../../scripts/quality/self-improve-domains.mjs';

describe('pickUnderfilledDomains', () => {
  it('picks the emptiest domains first and excludes ones already at the cap', () => {
    const counts = { strudel: 20, p5: 5, glsl: 0, three: 0, svg: 1 };
    const picks = pickUnderfilledDomains(counts, ['p5', 'glsl', 'three', 'svg', 'strudel'], 20, 3);

    expect(picks).toEqual(['glsl', 'three', 'svg']); // 3 emptiest under cap; strudel (full) skipped
  });

  it('never targets a capped domain while another has room', () => {
    const counts = { strudel: 20, p5: 5 };
    const picks = pickUnderfilledDomains(counts, ['strudel', 'p5', 'glsl'], 20, 2);

    expect(picks).toEqual(['glsl', 'p5']); // glsl(0) then p5(5); strudel(20) excluded
    expect(picks).not.toContain('strudel');
  });

  it('treats a missing domain as count 0 (emptiest)', () => {
    const picks = pickUnderfilledDomains({ p5: 3 }, ['p5', 'glsl'], 20, 1);

    expect(picks).toEqual(['glsl']); // glsl absent => 0 < p5 => 3
  });

  it('round-robins over all domains only when every domain is at the cap', () => {
    const picks = pickUnderfilledDomains({ a: 20, b: 20 }, ['a', 'b'], 20, 3);

    expect(picks).toEqual(['a', 'b', 'a']);
  });

  it('breaks ties deterministically by the domains-list order', () => {
    const picks = pickUnderfilledDomains({}, ['three', 'glsl', 'svg'], 20, 3);

    expect(picks).toEqual(['three', 'glsl', 'svg']); // all 0 => preserve input order
  });
});

describe('buildDomainPrompt', () => {
  it('wraps the theme in the domain-routing phrase for each domain', () => {
    expect(buildDomainPrompt('glsl', 'frost')).toBe('a GLSL fragment shader of frost');
    expect(buildDomainPrompt('three', 'frost')).toBe('a Three.js 3D scene of frost');
    expect(buildDomainPrompt('strudel', 'frost')).toBe('a Strudel live-coding music pattern of frost');
    expect(buildDomainPrompt('textgen', 'frost')).toBe('concrete poetry about frost');
  });

  it('falls back to the raw theme for an unknown domain', () => {
    expect(buildDomainPrompt('bogus', 'frost')).toBe('frost');
  });
});

describe('domain template coverage', () => {
  it('defines a routing template for every target domain', () => {
    expect(TARGET_DOMAINS.length).toBe(10);
    for (const domain of TARGET_DOMAINS) {
      expect(typeof DOMAIN_TEMPLATES[domain]).toBe('function');
    }
  });

  it('mirrors the QualityArchive per-domain cap', () => {
    expect(MAX_PER_DOMAIN).toBe(20);
  });
});
