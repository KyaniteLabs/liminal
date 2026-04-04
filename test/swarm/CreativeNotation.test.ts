import { describe, it, expect } from 'vitest';
import {
  NOTATION_REGISTRY,
  expandNotation,
  compressToNotation,
  getPrefix,
  getCategory,
  type NotationCategory,
} from '../../src/swarm/CreativeNotation.js';

describe('CreativeNotation', () => {
  // 1. expandNotation maps known tokens to their naturalLanguage
  it('expands ~d:shader and ~s:organic to include "GLSL" and "flowing"', () => {
    const result = expandNotation('~d:shader ~s:organic');
    expect(result).toContain('GLSL');
    expect(result).toContain('flowing');
  });

  // 2. compressToNotation recognises domain/style words
  it('compresses "GLSL fragment shader art with organic flowing shapes" to ~d:shader ~s:organic', () => {
    const result = compressToNotation('GLSL fragment shader art with organic flowing shapes');
    expect(result).toContain('~d:shader');
    expect(result).toContain('~s:organic');
  });

  // 3. Round-trip: expand(compress(text)) is semantically similar
  it('round-trips: expand(compress(original)) contains key words from original', () => {
    const original = 'GLSL fragment shader art with organic flowing shapes';
    const compressed = compressToNotation(original);
    const expanded = expandNotation(compressed);
    // "GLSL" and "flowing" should survive the round-trip
    expect(expanded).toContain('GLSL');
    expect(expanded).toContain('flowing');
  });

  // 4. Unknown words return empty or partial notation
  it('returns empty or partial result for text with no known tokens', () => {
    const result = compressToNotation('random xyzzy frobnicator');
    // Should be empty or very short — no known tokens matched
    const tokens = result.trim().split(/\s+/).filter(Boolean);
    expect(tokens.length).toBeLessThanOrEqual(1);
  });

  // 5. Unknown tokens pass through expandNotation unchanged
  it('passes unknown tokens through in expandNotation', () => {
    const result = expandNotation('~z:wombat ~d:shader');
    expect(result).toContain('~z:wombat');
    expect(result).toContain('GLSL');
  });

  // 6. NOTATION_REGISTRY has 26+ entries
  it('has at least 26 entries in NOTATION_REGISTRY', () => {
    expect(NOTATION_REGISTRY.size).toBeGreaterThanOrEqual(26);
  });

  // 7. Each category has at least one token
  it('has at least one token per category', () => {
    const categories: NotationCategory[] = ['domain', 'style', 'mood', 'tech', 'avoid'];
    for (const cat of categories) {
      const hasToken = [...NOTATION_REGISTRY.values()].some(
        (entry) => entry.category === cat,
      );
      expect(hasToken).toBe(true);
    }
  });

  // 8. getPrefix('domain') === '~d'
  it('maps domain category to ~d prefix', () => {
    expect(getPrefix('domain')).toBe('~d');
  });

  // 9. getCategory('~d') === 'domain'
  it('maps ~d prefix to domain category', () => {
    expect(getCategory('~d')).toBe('domain');
  });

  // 10. All tokens follow the ~X:word pattern
  it('has all tokens matching the ~X:word pattern', () => {
    const pattern = /^~[dsmxt]:[\w-]+$/;
    for (const entry of NOTATION_REGISTRY.values()) {
      expect(
        pattern.test(entry.token),
        `Token "${entry.token}" does not match ~X:word pattern`,
      ).toBe(true);
    }
  });
});
