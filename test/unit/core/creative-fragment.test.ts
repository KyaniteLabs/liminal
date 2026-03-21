/**
 * Core types unit tests — CreativeFragment conversions and helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  type CreativeFragment,
  seedToFragment,
  compostFragmentToFragment,
  minedFragmentToFragment,
  scavengerToFragment,
  isFromOrigin,
} from '../../../src/core/types.js';

// ---------------------------------------------------------------------------
// seedToFragment
// ---------------------------------------------------------------------------
describe('seedToFragment', () => {
  it('converts a compost Seed to CreativeFragment', () => {
    const seed = {
      id: 'seed-001',
      content: 'A shimmering particle field',
      score: 0.85,
      source: {
        fragments: ['frag-a', 'frag-b'],
        collisionType: 'cross-domain',
        domains: ['visual', 'audio'],
      },
      promotedAt: '2026-03-20T12:00:00Z',
    };

    const frag = seedToFragment(seed);

    expect(frag.id).toBe('seed-001');
    expect(frag.content).toBe('A shimmering particle field');
    expect(frag.score).toBe(0.85);
    expect(frag.origin).toBe('compost');
    expect(frag.tags).toEqual(['cross-domain']);
    expect(frag.domains).toEqual(['visual', 'audio']);
    expect(frag.source).toBe('frag-a, frag-b');
    expect(frag.createdAt).toBe('2026-03-20T12:00:00Z');
    expect(frag.metadata).toEqual({
      collisionType: 'cross-domain',
      sourceFragments: ['frag-a', 'frag-b'],
      promotedAt: '2026-03-20T12:00:00Z',
    });
  });

  it('handles empty domains gracefully', () => {
    const seed = {
      id: 'seed-empty',
      content: 'test',
      score: 0.5,
      source: { fragments: [], collisionType: 'none', domains: [] },
      promotedAt: '2026-01-01T00:00:00Z',
    };

    const frag = seedToFragment(seed);
    expect(frag.domains).toEqual([]);
    expect(frag.source).toBe('');
  });
});

// ---------------------------------------------------------------------------
// compostFragmentToFragment
// ---------------------------------------------------------------------------
describe('compostFragmentToFragment', () => {
  it('converts a CompostFragment to CreativeFragment', () => {
    const fragment = {
      id: 'comp-001',
      content: 'Spectral decay patterns',
      source: '/path/to/file.txt',
      domain: 'audio',
      tags: ['spectral', 'decay'],
      score: 0.72,
      metadata: { fileType: 'txt', hash: 'abc123' },
    };

    const frag = compostFragmentToFragment(fragment);

    expect(frag.id).toBe('comp-001');
    expect(frag.content).toBe('Spectral decay patterns');
    expect(frag.score).toBe(0.72);
    expect(frag.origin).toBe('compost');
    expect(frag.tags).toEqual(['spectral', 'decay']);
    expect(frag.domains).toEqual(['audio']);
    expect(frag.source).toBe('/path/to/file.txt');
    expect(frag.metadata).toEqual({ fileType: 'txt', hash: 'abc123' });
  });

  it('defaults score to 0 when undefined', () => {
    const frag = compostFragmentToFragment({
      id: 'x', content: 'c', source: 's', domain: 'd', tags: [],
    });
    expect(frag.score).toBe(0);
  });

  it('defaults metadata to empty object', () => {
    const frag = compostFragmentToFragment({
      id: 'x', content: 'c', source: 's', domain: 'd', tags: [],
    });
    expect(frag.metadata).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// minedFragmentToFragment
// ---------------------------------------------------------------------------
describe('minedFragmentToFragment', () => {
  it('converts a MinedFragment to CreativeFragment', () => {
    const mined = {
      id: 'mined-001',
      text: 'Crystal resonance chamber',
      source: 'session-42',
      score: 9,
      persona: 'nova',
      round: 3,
      tags: ['nova', 'hybrid'],
      extractedAt: '2026-03-20T10:00:00Z',
      mode: 'hybrid',
      sessionPrompt: 'Create something luminous',
    };

    const frag = minedFragmentToFragment(mined);

    expect(frag.id).toBe('mined-001');
    expect(frag.content).toBe('Crystal resonance chamber');
    expect(frag.score).toBe(9);
    expect(frag.origin).toBe('swarm');
    expect(frag.tags).toEqual(['nova', 'hybrid']);
    expect(frag.domains).toEqual([]);
    expect(frag.createdAt).toBe('2026-03-20T10:00:00Z');
    expect(frag.metadata).toEqual({
      persona: 'nova',
      round: 3,
      mode: 'hybrid',
      sessionPrompt: 'Create something luminous',
    });
  });

  it('handles optional fields as null when missing', () => {
    const frag = minedFragmentToFragment({
      id: 'x', text: 't', source: 's', score: 5, persona: 'p',
      round: 1, tags: [], extractedAt: '2026-01-01T00:00:00Z',
    });

    expect(frag.metadata.mode).toBeNull();
    expect(frag.metadata.sessionPrompt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scavengerToFragment
// ---------------------------------------------------------------------------
describe('scavengerToFragment', () => {
  it('converts a scavenger extraction to CreativeFragment', () => {
    const extraction = {
      id: 'scav-001',
      content: 'Recursive L-system branching',
      domain: 'code',
      score: 0.68,
      metadata: { language: 'javascript' },
      tags: ['l-system', 'recursion'],
      source: '/repo/lsystem.js',
    };

    const frag = scavengerToFragment(extraction);

    expect(frag.id).toBe('scav-001');
    expect(frag.content).toBe('Recursive L-system branching');
    expect(frag.score).toBe(0.68);
    expect(frag.origin).toBe('scavenger');
    expect(frag.tags).toEqual(['l-system', 'recursion']);
    expect(frag.domains).toEqual(['code']);
    expect(frag.source).toBe('/repo/lsystem.js');
  });

  it('defaults missing fields', () => {
    const frag = scavengerToFragment({
      id: 'x', content: 'c', domain: 'd',
    });
    expect(frag.score).toBe(0);
    expect(frag.tags).toEqual([]);
    expect(frag.metadata).toEqual({});
    expect(frag.source).toBe('d');
  });
});

// ---------------------------------------------------------------------------
// isFromOrigin
// ---------------------------------------------------------------------------
describe('isFromOrigin', () => {
  const fragment: CreativeFragment = {
    id: 'test',
    content: 'test',
    score: 0.5,
    origin: 'compost',
    tags: [],
    domains: [],
    source: '',
    createdAt: '2026-01-01T00:00:00Z',
    metadata: {},
  };

  it('returns true when origin matches', () => {
    expect(isFromOrigin(fragment, 'compost')).toBe(true);
  });

  it('returns false when origin does not match', () => {
    expect(isFromOrigin(fragment, 'swarm')).toBe(false);
    expect(isFromOrigin(fragment, 'scavenger')).toBe(false);
    expect(isFromOrigin(fragment, 'user')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-subsystem consistency
// ---------------------------------------------------------------------------
describe('cross-subsystem consistency', () => {
  it('all conversions produce valid CreativeFragment shape', () => {
    const seed = seedToFragment({
      id: 's', content: 'c', score: 0.5,
      source: { fragments: [], collisionType: 'x', domains: [] },
      promotedAt: '2026-01-01T00:00:00Z',
    });

    const comp = compostFragmentToFragment({
      id: 'c', content: 'c', source: 's', domain: 'd', tags: [],
    });

    const mined = minedFragmentToFragment({
      id: 'm', text: 't', source: 's', score: 5, persona: 'p',
      round: 1, tags: [], extractedAt: '2026-01-01T00:00:00Z',
    });

    const scav = scavengerToFragment({
      id: 'v', content: 'c', domain: 'd',
    });

    const requiredKeys = ['id', 'content', 'score', 'origin', 'tags', 'domains', 'source', 'createdAt', 'metadata'];

    for (const frag of [seed, comp, mined, scav]) {
      for (const key of requiredKeys) {
        expect(frag).toHaveProperty(key);
      }
    }
  });

  it('origins are correctly assigned per subsystem', () => {
    expect(seedToFragment({
      id: 's', content: 'c', score: 0.5,
      source: { fragments: [], collisionType: 'x', domains: [] },
      promotedAt: '2026-01-01T00:00:00Z',
    }).origin).toBe('compost');

    expect(compostFragmentToFragment({
      id: 'c', content: 'c', source: 's', domain: 'd', tags: [],
    }).origin).toBe('compost');

    expect(minedFragmentToFragment({
      id: 'm', text: 't', source: 's', score: 5, persona: 'p',
      round: 1, tags: [], extractedAt: '2026-01-01T00:00:00Z',
    }).origin).toBe('swarm');

    expect(scavengerToFragment({
      id: 'v', content: 'c', domain: 'd',
    }).origin).toBe('scavenger');
  });
});
