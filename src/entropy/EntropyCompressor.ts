import { createHash } from 'node:crypto';
import type { EntropyResult } from './types.js';

export class EntropyCompressor {
  compress(input: string, rounds = 4): Pick<EntropyResult, 'seed' | 'phrase' | 'hashChain'> {
    if (typeof rounds !== 'number' || rounds <= 0 || !Number.isInteger(rounds)) {
      throw new Error('rounds must be a positive integer');
    }
    let current = input;
    const hashChain: string[] = [];

    for (let round = 0; round < rounds; round++) {
      // Round 1: aggressive truncation (spatial decimation)
      const stride = (current.length % 5) + 2;
      const truncated = current.split('').filter((_, i) => i % stride === 0).join('');

      // Round 2: alphabet quantization (symbolic reduction)
      const reduced = truncated.split('').map(ch => {
        const code = ch.charCodeAt(0) & 0x0f;
        return code.toString(16);
      }).join('');

      // Round 3: entropic hashing (information collapse)
      const hash = createHash('sha256').update(reduced).digest('hex');
      hashChain.push(hash);

      // Round 4: recursive re-entrance
      current = hash;
    }

    const finalHash = hashChain[hashChain.length - 1];
    const seed = parseInt(finalHash.slice(0, 16), 16);
    const phrase = this.hashToPhrase(finalHash);

    return { seed, phrase, hashChain };
  }

  private hashToPhrase(hash: string): string {
    const words = [
      'null', 'void', 'ash', 'ember', 'spark', 'flare', 'nova', 'nebula',
      'dust', 'grain', 'seed', 'root', 'branch', 'canopy', 'forest', 'world',
    ];
    const chunks: string[] = [];
    for (let i = 0; i < 16; i += 4) {
      const n = parseInt(hash.slice(i, i + 4), 16);
      chunks.push(words[n % words.length]);
    }
    return chunks.join(' ');
  }
}
