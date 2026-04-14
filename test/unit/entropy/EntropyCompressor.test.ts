import { describe, it, expect } from 'vitest';
import { EntropyCompressor } from '../../../src/entropy/EntropyCompressor.js';

describe('EntropyCompressor', () => {
  it('produces deterministic seed for identical input', () => {
    const compressor = new EntropyCompressor();
    const r1 = compressor.compress('hello world');
    const r2 = compressor.compress('hello world');
    expect(r1.seed).toBe(r2.seed);
    expect(r1.phrase).toBe(r2.phrase);
    expect(r1.hashChain).toEqual(r2.hashChain);
  });

  it('produces divergent seeds for different inputs', () => {
    const compressor = new EntropyCompressor();
    const r1 = compressor.compress('hello world');
    const r2 = compressor.compress('goodbye world');
    expect(r1.seed).not.toBe(r2.seed);
  });

  it('returns exactly 4 hashes in the chain with default rounds', () => {
    const compressor = new EntropyCompressor();
    const r = compressor.compress('test');
    expect(r.hashChain.length).toBe(4);
  });

  it('returns a 64-char hex string for each hash', () => {
    const compressor = new EntropyCompressor();
    const r = compressor.compress('test');
    for (const hash of r.hashChain) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('returns a non-empty phrase', () => {
    const compressor = new EntropyCompressor();
    const r = compressor.compress('test');
    expect(r.phrase.length).toBeGreaterThan(0);
    expect(r.phrase.split(' ').length).toBe(4);
  });
});
