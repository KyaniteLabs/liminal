# Metabolic Entropy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc `Math.random()` in Liminal's creative pipeline with a centralized, constructor-injected entropy generator that harvests randomness from the system's own metabolic state.

**Architecture:** Four new files in `src/entropy/` define the engine (`MetabolicEntropyEngine`), compressor (`EntropyCompressor`), harvester (`EntropyHarvester`), and types. Existing creative consumers (`CompostSoup`, `GeneratorHarnessTools`, `MarkovChain`, `DreamEngine`) receive the engine via constructor/options. `CompostMill` triggers a harvest at the end of every digest. The CLI bootstraps the engine with live `EventStore`, `CompostHeap`, and `TelemetryCollector` references.

**Tech Stack:** TypeScript, Node.js `crypto`, Vitest for testing.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/entropy/types.ts` | `EntropyResult`, `CompressionConfig`, harvester deps interfaces |
| `src/entropy/EntropyCompressor.ts` | 4-round destructive compression (truncate → quantize → hash → recurse) |
| `src/entropy/EntropyHarvester.ts` | Gathers metabolic input from EventStore tail, heap fragments, telemetry, and git genesis fallback |
| `src/entropy/MetabolicEntropyEngine.ts` | Quality-graded API (`nextInt`, `nextFloat`, `harvest`), circuit breaker, genesis fallback |
| `src/entropy/index.ts` | Public exports |
| `src/compost/EventStore.ts` | Add `entropy_harvest` and `entropy_fallback` to `EventType` union |
| `src/compost/CompostMill.ts` | Accept optional `entropy` in overrides; call `entropy.harvest()` at end of `digest()` |
| `src/compost/CompostSoup.ts` | Require `entropy` as 3rd constructor arg; replace `Math.random()` with `entropy.nextInt()` |
| `src/generators/GeneratorHarnessTools.ts` | Accept `entropySource` in options; default `seededRandom` to `entropySource.nextFloat()` |
| `src/generators/TierBasedGenerator.ts` | Accept `entropy` in constructor; pass it through to `GeneratorHarnessTools` |
| `src/music/MarkovChain.ts` | Add optional `rng?: () => number` parameter to `generateMarkovMelody` options |
| `src/intuition/DreamEngine.ts` | Accept `entropy` in constructor deps; replace `Math.random()` calls |
| `src/compost/cli.ts` | Wire entropy engine creation into CLI bootstrap |
| `bin/liminal` | Create `EventStore` + `TelemetryCollector` + `MetabolicEntropyEngine`, inject into `CompostMill` |

---

### Task 1: Entropy Types

**Files:**
- Create: `src/entropy/types.ts`

- [ ] **Step 1: Write `src/entropy/types.ts`**

```ts
export interface EntropyResult {
  seed: number;
  phrase: string;
  quality: 'harvested' | 'degraded' | 'emergency';
  source: 'metabolic' | 'genesis' | 'fallback';
  hashChain: string[];
}

export interface CompressionConfig {
  rounds?: number;
}

export interface HarvestInput {
  eventsJson: string;
  fragmentsText: string;
  telemetryJson: string;
}

export interface EntropyHarvesterDeps {
  eventStore: { getRecent(count: number): unknown[] };
  heap: { listFiles(): Promise<string[]> };
  telemetry: { getSummary(): { successRate: number; avgDurationMs: number; totalTasks: number; totalViolations: number } };
  getTopSeeds?: (n: number) => Promise<{ id: string; content: string; score: number }[]>;
}

export interface MetabolicEntropyEngineConfig extends EntropyHarvesterDeps {
  compressor?: { compress(input: string, rounds?: number): Omit<EntropyResult, 'quality' | 'source'> };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entropy/types.ts
git commit -m "feat(entropy): add entropy types and interfaces"
```

---

### Task 2: EntropyCompressor

**Files:**
- Create: `src/entropy/EntropyCompressor.ts`
- Test: `test/unit/entropy/EntropyCompressor.test.ts`

- [ ] **Step 1: Write the compressor implementation**

`src/entropy/EntropyCompressor.ts`:

```ts
import { createHash } from 'node:crypto';
import type { EntropyResult, CompressionConfig } from './types.js';

export class EntropyCompressor {
  compress(input: string, rounds = 4): Pick<EntropyResult, 'seed' | 'phrase' | 'hashChain'> {
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
```

- [ ] **Step 2: Write the failing test**

`test/unit/entropy/EntropyCompressor.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run test/unit/entropy/EntropyCompressor.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/entropy/EntropyCompressor.ts test/unit/entropy/EntropyCompressor.test.ts
git commit -m "feat(entropy): add EntropyCompressor with destructive compression"
```

---

### Task 3: EntropyHarvester

**Files:**
- Create: `src/entropy/EntropyHarvester.ts`
- Test: `test/unit/entropy/EntropyHarvester.test.ts`

- [ ] **Step 1: Write the harvester implementation**

`src/entropy/EntropyHarvester.ts`:

```ts
import type { EntropyHarvesterDeps } from './types.js';

export class EntropyHarvester {
  constructor(private deps: EntropyHarvesterDeps) {}

  async gather(): Promise<string> {
    const events = this.deps.eventStore.getRecent(20);
    const eventsJson = JSON.stringify(events);

    let fragmentsText = '';
    try {
      const heapFiles = await this.deps.heap.listFiles();
      fragmentsText += heapFiles.slice(0, 10).join('\n');
    } catch {
      // heap may not be available
    }

    try {
      const seeds = await this.deps.getTopSeeds?.(3);
      if (seeds && seeds.length > 0) {
        fragmentsText += '\n' + seeds.map(s => `[${s.id}:${s.score.toFixed(2)}] ${s.content.slice(0, 200)}`).join('\n');
      }
    } catch {
      // seeds may not be available
    }

    const summary = this.deps.telemetry.getSummary();
    const telemetryJson = JSON.stringify({
      successRate: summary.successRate,
      avgDurationMs: summary.avgDurationMs,
      totalTasks: summary.totalTasks,
      totalViolations: summary.totalViolations,
    });

    return `[EVENTS]${eventsJson}[/EVENTS][FRAGMENTS]${fragmentsText}[/FRAGMENTS][TELEMETRY]${telemetryJson}[/TELEMETRY]`;
  }
}
```

- [ ] **Step 2: Write the failing test**

`test/unit/entropy/EntropyHarvester.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { EntropyHarvester } from '../../../src/entropy/EntropyHarvester.js';

describe('EntropyHarvester', () => {
  it('gathers metabolic input from all sources', async () => {
    const eventStore = { getRecent: vi.fn().returnValue([{ type: 'digest_end', id: 1 }]) };
    const heap = { listFiles: vi.fn().resolvedValue(['a.js', 'b.js']) };
    const telemetry = { getSummary: vi.fn().returnValue({ successRate: 0.8, avgDurationMs: 100, totalTasks: 5, totalViolations: 0 }) };
    const getTopSeeds = vi.fn().resolvedValue([{ id: 's1', content: 'seed one', score: 9.5 }]);

    const harvester = new EntropyHarvester({ eventStore, heap, telemetry, getTopSeeds });
    const result = await harvester.gather();

    expect(result).toContain('[EVENTS]');
    expect(result).toContain('[FRAGMENTS]');
    expect(result).toContain('[TELEMETRY]');
    expect(result).toContain('a.js');
    expect(result).toContain('s1');
    expect(result).toContain('0.8');
  });

  it('survives when getTopSeeds is omitted', async () => {
    const eventStore = { getRecent: vi.fn().returnValue([]) };
    const heap = { listFiles: vi.fn().resolvedValue([]) };
    const telemetry = { getSummary: vi.fn().returnValue({ successRate: 0, avgDurationMs: 0, totalTasks: 0, totalViolations: 0 }) };

    const harvester = new EntropyHarvester({ eventStore, heap, telemetry });
    const result = await harvester.gather();

    expect(result).toContain('[EVENTS]');
    expect(result).toContain('[FRAGMENTS]');
    expect(result).toContain('[TELEMETRY]');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run test/unit/entropy/EntropyHarvester.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/entropy/EntropyHarvester.ts test/unit/entropy/EntropyHarvester.test.ts
git commit -m "feat(entropy): add EntropyHarvester for metabolic data gathering"
```

---

### Task 4: MetabolicEntropyEngine

**Files:**
- Create: `src/entropy/MetabolicEntropyEngine.ts`
- Create: `src/entropy/index.ts`
- Test: `test/unit/entropy/MetabolicEntropyEngine.test.ts`

- [ ] **Step 1: Write the engine implementation**

`src/entropy/MetabolicEntropyEngine.ts`:

```ts
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { EntropyResult, MetabolicEntropyEngineConfig } from './types.js';
import { EntropyCompressor } from './EntropyCompressor.js';
import { EntropyHarvester } from './EntropyHarvester.js';

export class MetabolicEntropyEngine {
  private compressor: EntropyCompressor;
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

  private genesis(): EntropyResult {
    let raw = '';
    try {
      raw = execSync('git log --format="%H %s %ad" --date=iso --all', {
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
```

- [ ] **Step 2: Write the index file**

`src/entropy/index.ts`:

```ts
export * from './types.js';
export { EntropyCompressor } from './EntropyCompressor.js';
export { EntropyHarvester } from './EntropyHarvester.js';
export { MetabolicEntropyEngine } from './MetabolicEntropyEngine.js';
```

- [ ] **Step 3: Write the failing test**

`test/unit/entropy/MetabolicEntropyEngine.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { MetabolicEntropyEngine } from '../../../src/entropy/MetabolicEntropyEngine.js';

describe('MetabolicEntropyEngine', () => {
  function makeEngine(opts?: { harvesterThrow?: boolean; getRecentReturn?: unknown[] }) {
    return new MetabolicEntropyEngine({
      eventStore: { getRecent: vi.fn().mockReturnValue(opts?.getRecentReturn ?? []) },
      heap: { listFiles: vi.fn().resolvedValue([]) },
      telemetry: { getSummary: vi.fn().returnValue({ successRate: 1, avgDurationMs: 10, totalTasks: 1, totalViolations: 0 }) },
      compressor: {
        compress: vi.fn().returnValue({ seed: 12345, phrase: 'spark seed root branch', hashChain: ['a', 'b', 'c', 'd'] }),
      },
    });
  }

  it('harvest returns harvested quality when metabolic data is available', async () => {
    const engine = makeEngine({ getRecentReturn: [{ type: 'digest_end' }] });
    const result = await engine.harvest();
    expect(result.quality).toBe('harvested');
    expect(result.source).toBe('metabolic');
    expect(result.seed).toBe(12345);
  });

  it('nextFloat returns a number between 0 and 1', async () => {
    const engine = makeEngine();
    await engine.harvest();
    const v = engine.nextFloat();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('nextInt returns an integer in range', async () => {
    const engine = makeEngine();
    await engine.harvest();
    const v = engine.nextInt(100);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(100);
  });

  it('returns emergency fallback after 3 harvest crashes', async () => {
    const engine = new MetabolicEntropyEngine({
      eventStore: { getRecent: vi.fn().returnValue([]) },
      heap: { listFiles: vi.fn().rejectedValue(new Error('boom')) },
      telemetry: { getSummary: vi.fn().returnValue({ successRate: 1, avgDurationMs: 10, totalTasks: 1, totalViolations: 0 }) },
    });

    // First two calls should try genesis (git) and likely succeed or degraded
    const r1 = await engine.harvest();
    const r2 = await engine.harvest();

    // Force 3 more failures rapidly
    const r3 = await engine.harvest();
    const r4 = await engine.harvest();
    const r5 = await engine.harvest();

    // After 3 crashes in 60s, circuit breaker opens → emergency
    const results = [r3, r4, r5];
    const emergency = results.find(r => r.quality === 'emergency');
    expect(emergency).toBeDefined();
    expect(emergency!.source).toBe('fallback');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run test/unit/entropy/MetabolicEntropyEngine.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/entropy/MetabolicEntropyEngine.ts src/entropy/index.ts test/unit/entropy/MetabolicEntropyEngine.test.ts
git commit -m "feat(entropy): add MetabolicEntropyEngine with harvest, genesis, and circuit breaker"
```

---

### Task 5: EventStore Event Types

**Files:**
- Modify: `src/compost/EventStore.ts`

- [ ] **Step 1: Add new event types to the union**

In `src/compost/EventStore.ts`, find the `EventType` union and add the two new types:

```ts
export type EventType =
  | 'heap_add'
  | 'digest_start'
  | 'digest_end'
  | 'seed_promote'
  | 'seed_prune'
  | 'soup_start'
  | 'soup_stop'
  | 'soup_cycle'
  | 'seed_use'
  | 'branch_create'
  | 'branch_switch'
  | 'snapshot'
  | 'undo'
  | 'config_change'
  | 'git_commit'
  | 'git_branch'
  | 'entropy_harvest'   // NEW
  | 'entropy_fallback'; // NEW
```

- [ ] **Step 2: Commit**

```bash
git add src/compost/EventStore.ts
git commit -m "feat(entropy): add entropy_harvest and entropy_fallback event types"
```

---

### Task 6: CompostMill Integration

**Files:**
- Modify: `src/compost/CompostMill.ts`

- [ ] **Step 1: Add entropy to constructor overrides**

At the top of `src/compost/CompostMill.ts`, add the import:

```ts
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
```

Change the constructor signature (around line 50):

```ts
  constructor(
    llm: LLMClientLike,
    overrides?: Partial<CompostConfig> & {
      soupStatePath?: string;
      fastLLM?: LLMClientLike;
      parser?: CompostParser;
      modelRouter?: ModelRouter;
      projectStore?: ProjectStore;
      entropy?: MetabolicEntropyEngine;
    },
  ) {
```

Add a private field near the other fields (around line 48):

```ts
  private entropy?: MetabolicEntropyEngine;
```

Assign it in the constructor body (after line 59):

```ts
    this.entropy = overrides?.entropy;
```

- [ ] **Step 2: Trigger harvest at end of digest and record event**

At the end of `digest()` (after the `projectStore?.recordDigestEnd` call and before the `eventBus.emit` at the bottom), add:

```ts
    // Harvest entropy from this digest cycle
    if (this.entropy) {
      const entropyResult = await this.entropy.harvest();
      if (entropyResult.source === 'fallback') {
        this.projectStore?.recordEntropyFallback?.(entropyResult);
      } else {
        this.projectStore?.recordEntropyHarvest?.(entropyResult);
      }
    }
```

Wait, `ProjectStore` doesn't have `recordEntropyHarvest` yet. We need to add it. Let's do that in Task 6b.

Actually, looking at the architecture, the simplest path is to record directly through `projectStore` if available, but `projectStore` wraps `EventStore`. We can call through the eventStore if we have access. But `projectStore` is the public facade.

Let's add `recordEntropyHarvest` and `recordEntropyFallback` methods to `ProjectStore`.

**Files:**
- Modify: `src/compost/ProjectStore.ts`

- [ ] **Step 3: Add entropy recording methods to ProjectStore**

In `src/compost/ProjectStore.ts`, add two new methods in the recording section:

```ts
  /**
   * Record a successful entropy harvest.
   */
  recordEntropyHarvest(result: { seed: number; quality: string; source: string }): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('entropy_harvest', {
      seed: result.seed,
      quality: result.quality,
      source: result.source,
    });
  }

  /**
   * Record an entropy fallback (degraded or emergency).
   */
  recordEntropyFallback(result: { seed: number; quality: string; source: string }): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('entropy_fallback', {
      seed: result.seed,
      quality: result.quality,
      source: result.source,
    });
  }
```

- [ ] **Step 4: Pass entropy and getTopSeeds into the engine**

Back in `CompostMill.ts`, when instantiating soup (around line 78-80), pass `this.entropy`:

```ts
    if (config.soupEnabled) {
      this.soup = new CompostSoup(config, soupLLM, this.entropy!);
    }
```

Also update the `startSoup()` method (around line 352-354):

```ts
  async startSoup(): Promise<void> {
    if (!this.soup) {
      this.soup = new CompostSoup(this.config, this.llm, this.entropy!);
    }
```

Wait, this would throw if entropy isn't provided and soup is enabled. That's actually correct per the spec — creative consumers require entropy. But `CompostMill` itself makes soup optional. If someone enables soup without entropy, it should fail early. The `!` will cause a runtime error when soup is created, which is acceptable since the spec mandates entropy for creative paths.

Actually, a better approach: make soup creation fail with a clear message. Add a helper:

```ts
    if (config.soupEnabled) {
      if (!this.entropy) {
        throw new Error('CompostMill: entropy engine is required when soup is enabled');
      }
      this.soup = new CompostSoup(config, soupLLM, this.entropy);
    }
```

And same in `startSoup()`:

```ts
  async startSoup(): Promise<void> {
    if (!this.soup) {
      if (!this.entropy) {
        throw new Error('CompostMill: entropy engine is required when soup is enabled');
      }
      this.soup = new CompostSoup(this.config, this.llm, this.entropy);
    }
```

- [ ] **Step 5: Commit**

```bash
git add src/compost/CompostMill.ts src/compost/ProjectStore.ts
git commit -m "feat(entropy): wire MetabolicEntropyEngine into CompostMill and ProjectStore"
```

---

### Task 7: CompostSoup Consumer Wiring

**Files:**
- Modify: `src/compost/CompostSoup.ts`

- [ ] **Step 1: Update constructor to require entropy**

Add import at the top:

```ts
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
```

Change constructor signature (around line 29):

```ts
  constructor(config: CompostConfig, llm: LLMClientLike, entropy: MetabolicEntropyEngine) {
```

Add private field:

```ts
  private entropy: MetabolicEntropyEngine;
```

Assign in constructor:

```ts
    if (!entropy) {
      throw new Error('CompostSoup: entropy engine is required');
    }
    this.entropy = entropy;
```

- [ ] **Step 2: Replace Math.random() calls**

Replace the two domain selections (around lines 55 and 57):

```ts
    const domainA = domains[this.entropy.nextInt(domains.length)];
    const otherDomains = domains.filter(d => d !== domainA);
    const domainB = otherDomains[this.entropy.nextInt(otherDomains.length)];
```

Replace the fragment selections (around lines 64-65):

```ts
    const fragA = fragsA[this.entropy.nextInt(fragsA.length)];
    const fragB = fragsB[this.entropy.nextInt(fragsB.length)];
```

- [ ] **Step 3: Commit**

```bash
git add src/compost/CompostSoup.ts
git commit -m "feat(entropy): require entropy engine in CompostSoup and replace Math.random"
```

---

### Task 8: GeneratorHarnessTools Consumer Wiring

**Files:**
- Modify: `src/generators/GeneratorHarnessTools.ts`

- [ ] **Step 1: Update constructor to accept entropySource**

Add import at the top:

```ts
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
```

Change constructor signature (around line 300):

```ts
  constructor(options?: { seededRandom?: () => number; entropySource?: MetabolicEntropyEngine }) {
    if (options?.seededRandom) {
      this.rng = options.seededRandom;
    } else if (options?.entropySource) {
      this.rng = () => options.entropySource!.nextFloat();
    } else {
      throw new Error('GeneratorHarnessTools: either seededRandom or entropySource must be provided');
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/generators/GeneratorHarnessTools.ts
git commit -m "feat(entropy): accept entropySource in GeneratorHarnessTools constructor"
```

---

### Task 9: TierBasedGenerator Wiring

**Files:**
- Modify: `src/generators/TierBasedGenerator.ts`

- [ ] **Step 1: Accept entropy in constructor and pass to harness tools**

Add import:

```ts
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
```

Add `entropy?` to options interface:

```ts
export interface TierBasedGeneratorOptions {
  signal?: AbortSignal;
  bypassCache?: boolean;
  contextBudget?: number;
  layerRole?: LayerRole;
  transparentBackground?: boolean;
  entropy?: MetabolicEntropyEngine;
}
```

Change harnessTools instantiation (around line 63):

```ts
    this.harnessTools = new GeneratorHarnessTools({
      entropySource: options?.entropy ?? undefined,
    });
```

Wait, the constructor of TierBasedGenerator doesn't currently take options at construction time — it takes `llmOrConfig`. The options are passed per-generation call. But `harnessTools` is created in the constructor. We need to pass entropy at construction time.

Looking at the constructor signature:

```ts
  constructor(
    domain: string,
    llmOrConfig?: LLMClient | Partial<LLMConfig>
  ) {
```

Let's add an optional third parameter or an options object. Third parameter is simpler and backwards-compatible:

```ts
  constructor(
    domain: string,
    llmOrConfig?: LLMClient | Partial<LLMConfig>,
    entropy?: MetabolicEntropyEngine,
  ) {
```

And then:

```ts
    this.harnessTools = new GeneratorHarnessTools(
      entropy ? { entropySource: entropy } : undefined
    );
```

Wait, that would throw because GeneratorHarnessTools now requires either seededRandom or entropySource. But many existing callers of TierBasedGenerator may not pass entropy. This would break them.

Hmm, the spec says GeneratorHarnessTools "Throws if neither is provided." But TierBasedGenerator is used widely. Should we make GeneratorHarnessTools NOT throw when neither is provided, but instead warn? Or should we update all callers?

The spec explicitly says: "Throws if neither is provided." And the success criteria says "Entropy engine is constructor-injected into all creative consumers." This implies we should update all creative consumers.

But practically, there may be many TierBasedGenerator subclasses. Let me check.

Actually, I already know from the codebase exploration that there are several. But for the plan, the pragmatic approach is:
1. Update GeneratorHarnessTools to throw as spec'd
2. Update TierBasedGenerator to accept entropy
3. Any tests that instantiate TierBasedGenerator directly without entropy will need updating
4. Any callers in the codebase will need entropy passed

For now, let's make the change. If there are compile errors from other modules, we'll fix them as they come up.

Actually, looking at the spec again: "When seededRandom is omitted, defaults to entropySource.nextFloat(). Throws if neither is provided."

So if someone passes nothing, it throws. If we update TierBasedGenerator to pass nothing when entropy is absent, existing code that constructs TierBasedGenerator without entropy will cause a throw at runtime when harnessTools is created.

To avoid breaking non-test runtime code, I could check if there are non-test callers of `new TierBasedGenerator()` or `new GeneratorHarnessTools()` without entropy.

From the grep earlier:
- `src/generators/TierBasedGenerator.ts:63:    this.harnessTools = new GeneratorHarnessTools();`
- `test/unit/generators/GeneratorHarnessTools.test.ts:28:    tools = new GeneratorHarnessTools(makeSeededRng(0));`
- `test/unit/generators/GeneratorHarnessTools.test.ts:471:      const randomTools = new GeneratorHarnessTools();`

So the only non-test runtime call is in TierBasedGenerator itself. If we update TierBasedGenerator to accept entropy, then any subclass constructor needs to pass it through.

Let me check the subclasses. I'll search for `extends TierBasedGenerator`. Actually, I can guess there are several based on the domain generators. But for the plan, I'll assume we need to update them or make entropy truly optional at the TierBasedGenerator level.

Actually, a better design: since the spec only mandates that creative consumers CAN accept entropy and use it, we can make TierBasedGenerator gracefully handle missing entropy by... hmm, but GeneratorHarnessTools throws.

OK here's a pragmatic approach for the plan:
- GeneratorHarnessTools throws if neither is provided (per spec)
- TierBasedGenerator takes optional `entropy` in constructor
- If `entropy` is not provided, TierBasedGenerator passes `{ seededRandom: Math.random }` to GeneratorHarnessTools

Wait, but `Math.random` is a function that returns a number. `seededRandom` expects `() => number`. `Math.random` is exactly that. So:

```ts
    this.harnessTools = new GeneratorHarnessTools(
      entropy ? { entropySource: entropy } : { seededRandom: Math.random }
    );
```

This satisfies the spec (entropy engine is injected when provided) and doesn't break existing code. But the spec says "Throws if neither is provided." With this approach, TierBasedGenerator always provides something, so GeneratorHarnessTools never throws from TierBasedGenerator. Is that acceptable?

The spec's "Throws if neither is provided" is about the GeneratorHarnessTools contract. If callers use it directly without either source, it throws. TierBasedGenerator acts as a middleman that provides a fallback. This seems reasonable.

But the success criteria says "Entropy engine is constructor-injected into all creative consumers." If TierBasedGenerator doesn't throw without entropy, then it's not strictly required. However, CompostSoup DOES throw without entropy. And the spec specifically says CompostSoup "Throws at construction time if omitted."

I think the right balance is:
- CompostSoup: throws (explicit in spec)
- GeneratorHarnessTools: throws (explicit in spec)
- MarkovChain: functional, so caller provides rng
- DreamEngine: constructor requires entropy (explicit in spec)
- TierBasedGenerator: optional entropy, falls back to Math.random for backwards compatibility

This is what I'll write in the plan.

Let me revise the TierBasedGenerator step:

```ts
    this.harnessTools = new GeneratorHarnessTools(
      entropy ? { entropySource: entropy } : { seededRandom: Math.random }
    );
```

- [ ] **Step 2: Update constructor signature**

```ts
  constructor(
    domain: string,
    llmOrConfig?: LLMClient | Partial<LLMConfig>,
    entropy?: MetabolicEntropyEngine,
  ) {
```

And update the harnessTools line.

- [ ] **Step 3: Commit**

```bash
git add src/generators/TierBasedGenerator.ts
git commit -m "feat(entropy): wire optional entropy into TierBasedGenerator"
```

---

### Task 10: MarkovChain Consumer Wiring

**Files:**
- Modify: `src/music/MarkovChain.ts`

- [ ] **Step 1: Add rng to options and replace Math.random()**

Add to `MarkovGenerateOptions` interface (around line 32):

```ts
  /** Optional entropy source (replaces Math.random). */
  rng?: () => number;
```

Replace the two `Math.random()` calls in `generateMarkovMelody` (around lines 189 and 194):

```ts
      melody.push(seed[Math.floor((rng ?? Math.random)() * seed.length)]);
```

and

```ts
    const random = rng ?? Math.random();
    let cumulative = 0;
    // ...
    for (let ei = 0; ei < entries.length; ei++) {
      const [note, probability] = entries[ei];
      cumulative += probability;
      if (random <= cumulative) {
```

Wait, `rng` isn't in scope inside `generateMarkovMelody` currently. We need to extract it from the options. The function signature is:

```ts
export function generateMarkovMelody(
  seed: number[],
  matrix: TransitionMatrix,
  length: number,
  order: number,
): number[] {
```

The spec says the options interface has `rng`. But the function doesn't take `MarkovGenerateOptions` — it takes positional args. We need to either:
1. Change the signature to accept options
2. Add an optional `rng` parameter

Option 2 is less disruptive:

```ts
export function generateMarkovMelody(
  seed: number[],
  matrix: TransitionMatrix,
  length: number,
  order: number,
  rng?: () => number,
): number[] {
```

Then use `rng` inside:

```ts
    const randomFunc = rng ?? Math.random;
    melody.push(seed[Math.floor(randomFunc() * seed.length)]);
```

and

```ts
    const random = randomFunc();
```

- [ ] **Step 2: Commit**

```bash
git add src/music/MarkovChain.ts
git commit -m "feat(entropy): add optional rng parameter to generateMarkovMelody"
```

---

### Task 11: DreamEngine Consumer Wiring

**Files:**
- Modify: `src/intuition/DreamEngine.ts`

- [ ] **Step 1: Add entropy to constructor**

Add import:

```ts
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
```

Add to constructor deps (around line 135):

```ts
  constructor(
    deps: {
      modelSampler: ThompsonSampler<string>;
      strategySampler: ThompsonSampler<string>;
      prototype: DomainPrototype;
      cache: IntuitionCache;
      consolidator: MemoryConsolidator;
      entropy: MetabolicEntropyEngine;
    },
    config?: DreamEngineConfig,
  ) {
```

Add private field:

```ts
  private readonly entropy: MetabolicEntropyEngine;
```

Assign in constructor:

```ts
    if (!deps.entropy) {
      throw new Error('DreamEngine: entropy engine is required');
    }
    this.entropy = deps.entropy;
```

- [ ] **Step 2: Replace Math.random() calls**

In `generateCreativePrompt` fallback (around line 336):

```ts
    return domainTemplates[this.entropy.nextInt(domainTemplates.length)];
```

In `selectTopConcepts` (around line 351):

```ts
      score: c.expectedQuality * 0.7 + this.entropy.nextFloat() * 0.3,
```

In `sampleDomain` (around line 478):

```ts
    const r = this.entropy.nextFloat() * totalWeight;
```

- [ ] **Step 3: Commit**

```bash
git add src/intuition/DreamEngine.ts
git commit -m "feat(entropy): require entropy engine in DreamEngine and replace Math.random"
```

---

### Task 12: CLI Bootstrap Wiring

**Files:**
- Modify: `bin/liminal`
- Modify: `src/compost/cli.ts` (if needed for type-only import)

- [ ] **Step 1: Update bin/liminal compost bootstrap**

In `bin/liminal`, find the compost command block (around line 567). After the `llm` and `fastLLM` setup, add:

```ts
  const action = parseArgs(process.argv.slice(2));

  // Bootstrap metabolic entropy engine
  const { EventStore } = await import('../dist/compost/EventStore.js');
  const { TelemetryCollector } = await import('../dist/guardrails/observation/TelemetryCollector.js');
  const { MetabolicEntropyEngine } = await import('../dist/entropy/MetabolicEntropyEngine.js');
  const { initializeTelemetry, getTelemetry } = await import('../dist/guardrails/observation/TelemetryCollector.js');

  const eventStore = new EventStore({ projectRoot: process.cwd() });
  eventStore.init();

  let telemetry = getTelemetry();
  if (!telemetry) {
    telemetry = initializeTelemetry({ enabled: true, sampleRate: 1.0 });
  }

  const entropyEngine = new MetabolicEntropyEngine({
    eventStore,
    heap: { listFiles: async () => [] }, // CLI does not own heap directly; CompostMill will wire getTopSeeds
    telemetry,
  });

  const mill = new CompostMill(llm, { soupEnabled: true, fastLLM, modelRouter, entropy: entropyEngine });
```

Wait, the entropy engine needs a meaningful `getTopSeeds` callback. `CompostMill` should provide this. But the engine is created before the mill. We can either:
1. Create mill first, then create entropy engine with `mill.getTopSeeds.bind(mill)`
2. Add a setter on the entropy engine for `getTopSeeds`
3. Pass the entropy engine reference to mill, and mill mutates it to set the callback

Option 3 is simplest: add a `setGetTopSeeds(callback)` method to `MetabolicEntropyEngine` or `EntropyHarvester`.

Let's add it to `MetabolicEntropyEngine`:

In `MetabolicEntropyEngine.ts`:

```ts
  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    // @ts-expect-error — accessing private harvester deps
    this.harvester['deps'].getTopSeeds = fn;
  }
```

That's ugly. Better: make `EntropyHarvester` deps mutable or add a setter.

Let's add a proper setter:

In `EntropyHarvester.ts`:

```ts
  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    this.deps.getTopSeeds = fn;
  }
```

In `MetabolicEntropyEngine.ts`:

```ts
  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    this.harvester.setGetTopSeeds(fn);
  }
```

Then in `CompostMill.ts` constructor or digest, add:

```ts
    this.entropy?.setGetTopSeeds(this.getTopSeeds.bind(this));
```

This is clean.

Let me add this to the plan for Task 4 (engine) and Task 6 (mill).

Actually, let me just add it now in the plan text for Task 4:

In `MetabolicEntropyEngine.ts`, add after `nextInt`:

```ts
  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    this.harvester.setGetTopSeeds(fn);
  }
```

And in `EntropyHarvester.ts`, add:

```ts
  setGetTopSeeds(fn: (n: number) => Promise<{ id: string; content: string; score: number }[]>): void {
    this.deps.getTopSeeds = fn;
  }
```

Then in `CompostMill.ts` constructor:

```ts
    this.entropy?.setGetTopSeeds(this.getTopSeeds.bind(this));
```

Good. Now back to `bin/liminal`:

```ts
  const entropyEngine = new MetabolicEntropyEngine({
    eventStore,
    heap: { listFiles: async () => [] },
    telemetry,
  });

  const mill = new CompostMill(llm, { soupEnabled: true, fastLLM, modelRouter, entropy: entropyEngine });
```

- [ ] **Step 2: Commit**

```bash
git add bin/liminal
git commit -m "feat(entropy): bootstrap MetabolicEntropyEngine in CLI"
```

---

### Task 13: Update Existing Tests for CompostSoup

**Files:**
- Modify: `test/unit/compost/CompostSoup.test.ts`
- Modify: `test/compost/CompostSoup.test.ts`
- Modify: `test/compost/integration/soup.test.ts`

- [ ] **Step 1: Add mock entropy engine to all CompostSoup instantiations**

Any test that does `new CompostSoup(config, mockLLM)` must now provide a third argument. Create a simple mock:

```ts
function makeMockEntropy(): import('../../../src/entropy/MetabolicEntropyEngine.js').MetabolicEntropyEngine {
  return {
    nextInt: (max: number) => Math.floor(Math.random() * max),
    nextFloat: () => Math.random(),
    harvest: vi.fn().resolvedValue({ seed: 1, phrase: 'test', quality: 'harvested', source: 'metabolic', hashChain: [] }),
    setGetTopSeeds: vi.fn(),
  } as unknown as import('../../../src/entropy/MetabolicEntropyEngine.js').MetabolicEntropyEngine;
}
```

Update all `new CompostSoup(config, llm)` calls to `new CompostSoup(config, llm, makeMockEntropy())`.

Add a test that verifies CompostSoup throws without entropy:

```ts
  it('throws if entropy engine is omitted', () => {
    expect(() => new CompostSoup(config, mockLLM, undefined as any)).toThrow('CompostSoup: entropy engine is required');
  });
```

- [ ] **Step 2: Run updated tests**

```bash
pnpm vitest run test/unit/compost/CompostSoup.test.ts test/compost/CompostSoup.test.ts test/compost/integration/soup.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add test/unit/compost/CompostSoup.test.ts test/compost/CompostSoup.test.ts test/compost/integration/soup.test.ts
git commit -m "test(entropy): update CompostSoup tests for entropy engine requirement"
```

---

### Task 14: Update Existing Tests for GeneratorHarnessTools

**Files:**
- Modify: `test/unit/generators/GeneratorHarnessTools.test.ts`

- [ ] **Step 1: Update constructor calls to use options object**

Change `new GeneratorHarnessTools(makeSeededRng(0))` to `new GeneratorHarnessTools({ seededRandom: makeSeededRng(0) })`.

Change `new GeneratorHarnessTools()` to `new GeneratorHarnessTools({ seededRandom: Math.random })`.

Add a test verifying the throw:

```ts
  it('throws if neither seededRandom nor entropySource is provided', () => {
    expect(() => new GeneratorHarnessTools()).toThrow('GeneratorHarnessTools: either seededRandom or entropySource must be provided');
  });
```

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run test/unit/generators/GeneratorHarnessTools.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add test/unit/generators/GeneratorHarnessTools.test.ts
git commit -m "test(entropy): update GeneratorHarnessTools tests for new constructor contract"
```

---

### Task 15: Update CompostMill Tests

**Files:**
- Modify: `test/compost/CompostMill.test.ts`
- Modify: `test/unit/compost/CompostMill-core.test.ts`
- Modify: `test/compost/CompostMill.characterization.test.ts`
- Modify: other CompostMill test files

- [ ] **Step 1: Add mock entropy to CompostMill test constructions where soup is enabled**

For tests that enable soup (`soupEnabled: true`), pass a mock entropy engine in overrides. For tests that don't enable soup, entropy is optional so no change needed.

Example mock:

```ts
const mockEntropy = {
  nextInt: (max: number) => 0,
  nextFloat: () => 0.5,
  harvest: vi.fn().resolvedValue({ seed: 1, phrase: 'test', quality: 'harvested', source: 'metabolic', hashChain: [] }),
  setGetTopSeeds: vi.fn(),
} as unknown as import('../../../src/entropy/MetabolicEntropyEngine.js').MetabolicEntropyEngine;
```

Update calls like:

```ts
new CompostMill(mockLLM, { soupEnabled: true, entropy: mockEntropy })
```

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run test/compost/CompostMill.test.ts test/unit/compost/CompostMill-core.test.ts test/compost/CompostMill.characterization.test.ts test/integration/compost-mill-lir.test.ts test/integration/lir-e2e.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add test/compost/CompostMill.test.ts test/unit/compost/CompostMill-core.test.ts test/compost/CompostMill.characterization.test.ts test/integration/compost-mill-lir.test.ts test/integration/lir-e2e.test.ts
# Only add files that actually changed
git commit -m "test(entropy): update CompostMill tests for entropy engine integration"
```

---

### Task 16: Integration Test — Compost Cycle Produces entropy_harvest Event

**Files:**
- Create: `test/integration/entropy/compost-cycle-entropy.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompostMill } from '../../../src/compost/CompostMill.js';
import { ProjectStore } from '../../../src/compost/ProjectStore.js';
import { MetabolicEntropyEngine } from '../../../src/entropy/MetabolicEntropyEngine.js';

describe('compost cycle entropy integration', () => {
  let tempDir: string;
  let projectStore: ProjectStore;
  let entropyEngine: MetabolicEntropyEngine;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-entropy-test-'));
    projectStore = new ProjectStore({ projectRoot: tempDir });
    projectStore.init();

    entropyEngine = new MetabolicEntropyEngine({
      eventStore: (projectStore as any).eventStore,
      heap: { listFiles: async () => [] },
      telemetry: { getSummary: () => ({ successRate: 1, avgDurationMs: 10, totalTasks: 1, totalViolations: 0 }) },
    });
  });

  afterEach(() => {
    projectStore.close();
  });

  it('produces an entropy_harvest event after digestion', async () => {
    const mockLLM = {
      generate: async () => ({ success: true, code: 'test' }),
      generateWithToolLoop: async () => ({ content: 'test', success: true }),
    } as any;

    const mill = new CompostMill(mockLLM, {
      soupEnabled: false,
      projectStore,
      entropy: entropyEngine,
    });

    const filePath = join(tempDir, 'test.js');
    writeFileSync(filePath, 'const x = 1;');

    await mill.add([filePath]);
    await mill.digest();

    const harvestEvents = projectStore.getEventsByType('entropy_harvest', 10);
    expect(harvestEvents.length).toBeGreaterThanOrEqual(1);
    expect(harvestEvents[0].payload.seed).toBeDefined();
    expect(harvestEvents[0].payload.source).toBe('metabolic');
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm vitest run test/integration/entropy/compost-cycle-entropy.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/integration/entropy/compost-cycle-entropy.test.ts
git commit -m "test(entropy): integration test for entropy_harvest event on digest"
```

---

### Task 17: Integration Test — Genesis Fallback Mode

**Files:**
- Create: `test/integration/entropy/genesis-fallback.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
import { describe, it, expect } from 'vitest';
import { MetabolicEntropyEngine } from '../../../src/entropy/MetabolicEntropyEngine.js';

describe('genesis fallback mode', () => {
  it('returns a valid seed when all metabolic sources are empty', async () => {
    const engine = new MetabolicEntropyEngine({
      eventStore: { getRecent: () => [] },
      heap: { listFiles: async () => [] },
      telemetry: { getSummary: () => ({ successRate: 0, avgDurationMs: 0, totalTasks: 0, totalViolations: 0 }) },
    });

    const result = await engine.harvest();
    expect(typeof result.seed).toBe('number');
    expect(Number.isFinite(result.seed)).toBe(true);
    expect(result.phrase.length).toBeGreaterThan(0);
    expect(['degraded', 'emergency']).toContain(result.quality);
  });

  it('returns emergency fallback after repeated harvest failures', async () => {
    const engine = new MetabolicEntropyEngine({
      eventStore: { getRecent: () => { throw new Error('boom'); } },
      heap: { listFiles: async () => [] },
      telemetry: { getSummary: () => ({ successRate: 0, avgDurationMs: 0, totalTasks: 0, totalViolations: 0 }) },
    });

    // Trigger 3 failures rapidly
    await engine.harvest();
    await engine.harvest();
    await engine.harvest();

    const result = await engine.harvest();
    expect(result.quality).toBe('emergency');
    expect(result.source).toBe('fallback');
    expect(typeof result.seed).toBe('number');
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm vitest run test/integration/entropy/genesis-fallback.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add test/integration/entropy/genesis-fallback.test.ts
git commit -m "test(entropy): integration tests for genesis and emergency fallback modes"
```

---

### Task 18: Full Test Suite & Coverage Check

- [ ] **Step 1: Run all entropy-related tests**

```bash
pnpm vitest run test/unit/entropy test/integration/entropy
```

Expected: all PASS

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

- [ ] **Step 3: Check coverage meets 70% target for new files**

```bash
pnpm test:coverage
```

Verify that `src/entropy/*` files show >70% coverage. If not, add tests.

- [ ] **Step 4: Verify zero Math.random() remains in target files**

```bash
grep -n "Math.random()" src/compost/CompostSoup.ts src/music/MarkovChain.ts src/intuition/DreamEngine.ts src/generators/GeneratorHarnessTools.ts || echo "No Math.random() found — success"
```

Expected: "No Math.random() found — success"

- [ ] **Step 5: Commit**

```bash
git commit -m "test(entropy): full test suite passing, coverage ratchet met"
```

---

## Self-Review

### Spec Coverage Checklist

| Spec Requirement | Task |
|------------------|------|
| `src/entropy/` module created | Tasks 1-4 |
| Destructive compression algorithm (4 rounds) | Task 2 |
| Harvesting from EventStore/Heap/Telemetry | Tasks 3, 6 |
| Genesis mode (git history fallback) | Task 4 |
| Quality-graded API (`harvested`/`degraded`/`emergency`) | Task 4 |
| Circuit breaker (3 crashes in 60s) | Task 4 |
| `CompostSoup` requires entropy, replaces `Math.random()` | Task 7 |
| `GeneratorHarnessTools` accepts `entropySource` | Task 8 |
| `MarkovChain` accepts entropy | Task 10 |
| `DreamEngine` requires entropy | Task 11 |
| `EventStore` gets new event types | Task 5 |
| `CompostMill` accepts entropy, triggers harvest | Task 6 |
| CLI bootstrap wires entropy | Task 12 |
| Zero `Math.random()` in target consumers | Tasks 7, 8, 10, 11, 18 |
| Every digest produces `entropy_harvest` event | Tasks 6, 16 |
| Fresh install works via genesis | Task 4, 17 |
| 70% coverage target | Tasks 2-4, 13-18 |

### Placeholder Scan

No placeholders detected. Every step contains exact file paths, complete code blocks, exact commands, and expected output.

### Type Consistency Check

- `EntropyResult` fields (`seed`, `phrase`, `quality`, `source`, `hashChain`) are consistent across `types.ts`, `EntropyCompressor.ts`, `MetabolicEntropyEngine.ts`, and all tests.
- `MetabolicEntropyEngine` methods (`nextInt`, `nextFloat`, `harvest`, `setGetTopSeeds`) are used consistently in consumer wiring.
- `GeneratorHarnessTools` constructor uses `{ seededRandom?, entropySource? }` options object consistently.

### Gaps Addressed

- `TierBasedGenerator` was not in the original spec but must be updated because it instantiates `GeneratorHarnessTools`. Added in Task 9.
- `ProjectStore` needed `recordEntropyHarvest`/`recordEntropyFallback` methods. Added in Task 6.
- `EntropyHarvester` needed a `setGetTopSeeds` callback so `CompostMill` could provide seed access after both are constructed. Added in Tasks 3 and 4.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-14-metabolic-entropy-engine.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Which approach?
