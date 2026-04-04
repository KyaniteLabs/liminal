import { describe, it, expect } from 'vitest';
import { SymbolicCreativeLanguage } from '../../src/brain/SymbolicCreativeLanguage.js';

describe('NotationEvolution', () => {
  it('winners boost token EMA', () => {
    const lang = new SymbolicCreativeLanguage();

    // "GLSL fragment shader art" contains keywords matching ~d:shader
    lang.evolveNotation(['GLSL fragment shader art with organic flowing shapes'], []);

    const stats = lang.getNotationStats();

    // Should have boosted at least one token
    expect(stats.size).toBeGreaterThanOrEqual(1);

    // All boosted tokens should be above the default of 0.5
    for (const score of stats.values()) {
      expect(score).toBeGreaterThan(0.5);
    }
  });

  it('losers decay token EMA', () => {
    const lang = new SymbolicCreativeLanguage();

    // Losing seed that contains organic keywords matching ~s:organic
    lang.evolveNotation([], ['flowing natural biomorphic organic shapes']);

    const stats = lang.getNotationStats();

    expect(stats.size).toBeGreaterThanOrEqual(1);

    // All decayed tokens should be below the default of 0.5
    for (const score of stats.values()) {
      expect(score).toBeLessThan(0.5);
    }
  });

  it('multiple rounds accumulate', () => {
    const lang = new SymbolicCreativeLanguage();

    // Round 1: boost shader
    lang.evolveNotation(['GLSL fragment shader art'], []);
    const after1 = lang.getNotationStats();
    const shaderScore1 = after1.get('~d:shader') ?? 0;

    // Round 2: boost shader again
    lang.evolveNotation(['GLSL fragment shader art'], []);
    const after2 = lang.getNotationStats();
    const shaderScore2 = after2.get('~d:shader') ?? 0;

    // Second boost should push the score higher than the first
    expect(shaderScore2).toBeGreaterThan(shaderScore1);
  });

  it('getNotationStats returns all tracked tokens', () => {
    const lang = new SymbolicCreativeLanguage();

    lang.evolveNotation(
      ['GLSL fragment shader art with organic flowing shapes'],
      ['dark shadowy ominous compositions with straight lines'],
    );

    const stats = lang.getNotationStats();

    // Should have at least a domain/style token from winners and a mood/avoid token from losers
    const tokens = [...stats.keys()];
    expect(tokens.length).toBeGreaterThanOrEqual(2);

    // Every value should be a number between 0 and 1
    for (const [token, score] of stats) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(token).toBeTruthy();
    }
  });

  it('unknown seeds with no matching tokens do not crash', () => {
    const lang = new SymbolicCreativeLanguage();

    // These strings contain no keywords that match any NOTATION_REGISTRY entry
    expect(() => {
      lang.evolveNotation(['xyzzy frobnicator quux'], ['random gibberish baz']);
    }).not.toThrow();

    const stats = lang.getNotationStats();
    // May be empty or may have spurious matches — the key contract is no crash
    expect(stats).toBeInstanceOf(Map);
  });
});
