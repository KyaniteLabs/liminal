import { describe, it, expect } from 'vitest';
import { NotationTranslator } from '../../src/swarm/NotationTranslator.js';

describe('NotationTranslator', () => {
  it('encode compresses natural language to notation', () => {
    const t = new NotationTranslator();
    const result = t.encode('p5.js creative coding with organic flowing forms');
    expect(result).toContain('~d:p5');
    expect(result).toContain('~s:organic');
  });

  it('decode expands notation to natural language', () => {
    const t = new NotationTranslator();
    const result = t.decode('~d:shader ~m:dark');
    expect(result).toContain('GLSL');
    expect(result).toContain('shadowy');
  });

  it('encodePrompt/decodePrompt roundtrip for known patterns', () => {
    const t = new NotationTranslator();
    const prompt = 'Less is more: every element must earn its place';
    const encoded = t.encodePrompt(prompt);
    expect(encoded).toContain('~less-more');
    const decoded = t.decodePrompt(encoded);
    expect(decoded).toContain('Less is more');
  });

  it('exposes registry and promptPatterns', () => {
    const t = new NotationTranslator();
    expect(t.registry.size).toBeGreaterThan(0);
    expect(t.promptPatterns.size).toBeGreaterThan(0);
  });
});
