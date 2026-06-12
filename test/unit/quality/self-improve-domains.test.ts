import { describe, expect, it } from 'vitest';

// The self-improvement cycle's domain-targeting helpers (pure module, no side effects).
import {
  DOMAIN_TEMPLATES,
  TARGET_DOMAINS,
  MAX_PER_DOMAIN,
  pickUnderfilledDomains,
  buildDomainPrompt,
  dreamThemeFromTask,
  diffArchiveAdmissions,
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

describe('pickUnderfilledDomains quality-aware targeting (all-domains-at-A)', () => {
  it('keeps a capped domain targetable while its top quality is below the A-bar', () => {
    const counts = { ascii: 20, p5: 20, textgen: 12 };
    const quality = { ascii: 0.85, p5: 0.95, textgen: 0.95 };
    const picks = pickUnderfilledDomains(counts, ['ascii', 'p5', 'textgen'], 20, 2, 0, quality);
    expect(picks).toEqual(['textgen', 'ascii']); // under-cap first, then capped-below-bar; capped A-grade p5 excluded
  });

  it('orders capped below-bar domains by ascending quality (weakest top first)', () => {
    const counts = { ascii: 20, kinetic: 20, three: 20 };
    const quality = { ascii: 0.85, kinetic: 0.85, three: 0.8 };
    const picks = pickUnderfilledDomains(counts, ['ascii', 'kinetic', 'three'], 20, 3, 0, quality);
    expect(picks).toEqual(['three', 'ascii', 'kinetic']); // 0.80 before the 0.85 pair (tie keeps input order)
  });

  it('falls back to the existing round-robin when everything is capped AND at the bar', () => {
    const counts = { a: 20, b: 20 };
    const quality = { a: 0.95, b: 0.92 };
    expect(pickUnderfilledDomains(counts, ['a', 'b'], 20, 3, 0, quality)).toEqual(['a', 'b', 'a']);
  });

  it('behaves exactly as before when no quality map is given (back-compat)', () => {
    const counts = { strudel: 20, p5: 5 };
    expect(pickUnderfilledDomains(counts, ['strudel', 'p5', 'glsl'], 20, 2)).toEqual(['glsl', 'p5']);
  });
});

describe('pickUnderfilledDomains seed rotation (anti-fixation)', () => {
  const counts = { a: 0, b: 0, c: 0, d: 5, e: 8 };
  const doms = ['a', 'b', 'c', 'd', 'e'];

  it('seed=0 preserves deterministic emptiest-first order', () => {
    expect(pickUnderfilledDomains(counts, doms, 20, 2, 0)).toEqual(['a', 'b']);
  });

  it('a non-zero seed rotates to target with-room domains that are not the strict emptiest', () => {
    // Without rotation the loop only ever picks a,b,c (the zeros). Rotation lets it reach
    // d,e (have room) so archivable domains actually fill instead of stalling at Δ0.
    expect(pickUnderfilledDomains(counts, doms, 20, 2, 3)).toEqual(['d', 'e']);
  });

  it('spreads coverage across ALL under-cap domains over successive seeds', () => {
    const seen = new Set<string>();
    for (let s = 0; s < doms.length; s++) {
      for (const d of pickUnderfilledDomains(counts, doms, 20, 2, s)) seen.add(d);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('wraps the seed modulo the pool size', () => {
    expect(pickUnderfilledDomains(counts, doms, 20, 2, doms.length)).toEqual(['a', 'b']); // seed 5 ≡ 0
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

describe('dreamThemeFromTask', () => {
  it('names the decisive poles from averaged source descriptors', () => {
    // axes: order-chaos, sparse-dense, symmetry-asymmetry, smooth-bursty, static-evolving, harmonic-dissonant
    const task = {
      sources: [
        { id: 'a', descriptor: [0.9, 0.8, 0.5, 0.2, 0.9, 0.5], quality: 0.9 },
        { id: 'b', descriptor: [0.9, 0.8, 0.5, 0.2, 0.9, 0.5], quality: 0.8 },
      ],
    };
    expect(dreamThemeFromTask(task)).toBe(
      'chaotic, dense, smooth, ever-evolving forms recombined from its own archive lineage',
    );
  });

  it('crosses divergent parents instead of averaging their poles to mush (FAB-022)', () => {
    const task = {
      sources: [
        { id: 'a', descriptor: [1.0, 0.5], quality: 0.9 },
        { id: 'b', descriptor: [0.0, 0.5], quality: 0.7 },
      ],
    };
    // Averaging produced 0.5 → 'balanced' mush; the tension IS the dream.
    expect(dreamThemeFromTask(task)).toBe('chaotic crossed with orderly — one work fusing both lineage parents');
  });

  it('builds a unique cross from real opposite-pole parents (live queue sample, capped at 3 words per parent)', () => {
    // Actual elite-x-compost pair from ~/.sinter/dreams/queue.json 2026-06-11:
    // averaging rendered EVERY such dream as the same "chaotic, sparse,
    // asymmetric…" theme (41/50 queued dreams were this strategy).
    const task = {
      sources: [
        { id: 'a', descriptor: [1, 0.9868, 0.3441, 0.0505, 1, 0.7], quality: 0.9 },
        { id: 'b', descriptor: [0, 0.4733, 0.5878, 1, 0, 0.0999], quality: 0.85 },
      ],
    };
    expect(dreamThemeFromTask(task)).toBe(
      'chaotic, dense, symmetric crossed with orderly, bursty, still — one work fusing both lineage parents',
    );
  });

  it('keeps mid-everything parents on the balanced lineage phrasing', () => {
    const task = {
      sources: [
        { id: 'a', descriptor: [0.5, 0.5], quality: 0.9 },
        { id: 'b', descriptor: [0.45, 0.55], quality: 0.7 },
      ],
    };
    expect(dreamThemeFromTask(task)).toBe('balanced forms recombined from its own archive lineage');
  });

  it('routes a dream theme through every domain template via detectable keywords', () => {
    const theme = 'chaotic, dense forms recombined from its own archive lineage';
    expect(buildDomainPrompt('glsl', theme)).toBe(`a GLSL fragment shader of ${theme}`);
    expect(buildDomainPrompt('strudel', theme)).toBe(`a Strudel live-coding music pattern of ${theme}`);
  });

  it('returns null for tasks without usable descriptors', () => {
    expect(dreamThemeFromTask({ sources: [] })).toBeNull();
    expect(dreamThemeFromTask({ sources: [{ id: 'a', descriptor: [], quality: 0.5 }] })).toBeNull();
    expect(dreamThemeFromTask(undefined)).toBeNull();
    expect(dreamThemeFromTask({})).toBeNull();
  });
});

describe('diffArchiveAdmissions', () => {
  const entry = (id: string, score: number) => ({ id, qualityScore: score });

  it('counts a single admitted entry when one id is replaced in a domain', () => {
    const before = { p5: [entry('a', 0.85), entry('b', 0.8)] };
    const after = { p5: [entry('a', 0.85), entry('c', 0.82)] };

    expect(diffArchiveAdmissions(before, after)).toEqual({
      admitted: 1,
      admittedIds: ['c'],
      floors: { p5: 0.82 },
      tops: { p5: 0.85 },
    });
  });

  it('reports zero admissions for identical before and after archives', () => {
    const arch = { p5: [entry('a', 0.85), entry('b', 0.8)] };

    expect(diffArchiveAdmissions(arch, arch)).toEqual({
      admitted: 0,
      admittedIds: [],
      floors: { p5: 0.8 },
      tops: { p5: 0.85 },
    });
  });

  it('handles empty and missing domains without throwing', () => {
    expect(diffArchiveAdmissions({}, { p5: [] })).toEqual({
      admitted: 0,
      admittedIds: [],
      floors: {},
      tops: {},
    });
    expect(diffArchiveAdmissions(null as unknown as object, undefined as unknown as object)).toEqual({
      admitted: 0,
      admittedIds: [],
      floors: {},
      tops: {},
    });
  });

  it('accepts full QualityArchive file objects with an archives wrapper', () => {
    const before = { archives: { glsl: [entry('x', 0.9)] } };
    const after = { archives: { glsl: [entry('x', 0.9), entry('y', 0.88)] } };

    expect(diffArchiveAdmissions(before, after)).toEqual({
      admitted: 1,
      admittedIds: ['y'],
      floors: { glsl: 0.88 },
      tops: { glsl: 0.9 },
    });
  });

  it('computes per-domain floors and tops rounded to three decimals', () => {
    const before = { a: [entry('a1', 0.1234)], b: [entry('b1', 0.9999)] };
    const after = {
      a: [entry('a1', 0.1234), entry('a2', 0.1235)],
      b: [entry('b1', 0.9999)],
    };

    expect(diffArchiveAdmissions(before, after)).toEqual({
      admitted: 1,
      admittedIds: ['a2'],
      floors: { a: 0.123, b: 1 },
      tops: { a: 0.124, b: 1 },
    });
  });
});
