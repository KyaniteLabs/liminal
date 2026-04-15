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

  it('returns a four-word phrase', () => {
    const compressor = new EntropyCompressor();
    const r = compressor.compress('test');
    expect(r.phrase).toMatch(/^(\w+ ){3}\w+$/);
    expect(r.phrase.split(' ').length).toBe(4);
  });

  it('throws for non-positive rounds (0)', () => {
    const compressor = new EntropyCompressor();
    expect(() => compressor.compress('test', 0)).toThrow('rounds must be a positive integer');
  });

  it('throws for non-positive rounds (-1)', () => {
    const compressor = new EntropyCompressor();
    expect(() => compressor.compress('test', -1)).toThrow('rounds must be a positive integer');
  });

  it('returns exactly the requested number of hashes', () => {
    const compressor = new EntropyCompressor();
    const r = compressor.compress('test', 2);
    expect(r.hashChain.length).toBe(2);
  });

  it('handles empty string input', () => {
    const compressor = new EntropyCompressor();
    expect(() => compressor.compress('')).not.toThrow();
    const r = compressor.compress('');
    expect(r.hashChain.length).toBe(4);
    expect(Number.isFinite(r.seed)).toBe(true);
  });

  it('returns a finite seed', () => {
    const compressor = new EntropyCompressor();
    const r = compressor.compress('test');
    expect(Number.isFinite(r.seed)).toBe(true);
  });
});
