import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { EntropyResult, MetabolicEntropyEngineConfig } from './types.js';
import { EntropyCompressor } from './EntropyCompressor.js';
import { EntropyHarvester } from './EntropyHarvester.js';

type Compressor = NonNullable<MetabolicEntropyEngineConfig['compressor']>;

export class MetabolicEntropyEngine {
  private compressor: Compressor;
  private harvester: EntropyHarvester;
  private crashLog: number[] = [];
  private lastResult: EntropyResult | null = null;

  constructor(config: MetabolicEntropyEngineConfig) {
    this.compressor = config.compressor ?? new EntropyCompressor();
    this.harvester = new EntropyHarvester(config);
  }

  async harvest(): Promise<EntropyResult> {
    try {
      // Circuit breaker: 3 crashes in 60s
      const now = Date.now();
      this.crashLog = this.crashLog.filter(t => now - t < 60000);
      if (this.crashLog.length >= 3) {
        return this.fallback('emergency', 'fallback');
      }

      const input = await this.harvester.gather();
      const compressed = this.compressor.compress(input);
      const result: EntropyResult = {
        ...compressed,
        quality: 'harvested',
        source: 'metabolic',
      };
      this.lastResult = result;
      return result;
    } catch (err) {
      this.crashLog.push(Date.now());
      try {
        return this.genesis();
      } catch {
        return this.fallback('emergency', 'fallback');
      }
    }
  }

  nextFloat(): number {
    if (!this.lastResult) {
      // emergency fallback if harvest was never called
      return (Date.now() % 1000000) / 1000000;
    }
    // SplitMix64-inspired scalar mixer
    let z = this.lastResult.seed + Math.floor(Date.now() / 1000);
    z = (z + 0x9e3779b9) | 0;
    let t = z ^ (z >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return ((t >>> 0) % 1000000) / 1000000;
  }

  nextInt(max = 2147483647): number {
    return Math.floor(this.nextFloat() * max);
  }

  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    this.harvester.setGetTopSeeds(fn);
  }

  private genesis(): EntropyResult {
    let raw = '';
    try {
      raw = execSync('git log --format="%H %s %ad" --date=iso --all --max-count=1000', {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf-8',
      });
    } catch {
      // Build-time fallback or package metadata
      try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
        raw = `${pkg.name ?? 'liminal'} ${pkg.version ?? '0.0.0'} ${process.hrtime.bigint()}`;
      } catch {
        raw = `${process.hrtime.bigint()}`;
      }
    }

    const compressed = this.compressor.compress(raw);
    return {
      ...compressed,
      quality: 'degraded',
      source: 'genesis',
    };
  }

  private fallback(quality: 'emergency', source: 'fallback'): EntropyResult {
    const seed = Number(Date.now() ^ (process.pid || 1));
    return {
      seed,
      phrase: 'ash dust null void',
      quality,
      source,
      hashChain: [],
    };
  }
}
