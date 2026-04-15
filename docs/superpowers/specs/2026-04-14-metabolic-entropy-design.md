# Metabolic Entropy Engine Design

## Summary

Replace ad-hoc `Math.random()` usage in Liminal's creative pipeline with a centralized, constructor-injected entropy generator that harvests randomness from the system's own metabolic state (EventStore, CompostHeap, TelemetryCollector) via intentional destructive compression. The engine closes the creative loop: compost produces fragments, fragments feed entropy, entropy drives the next creative cycle.

## Motivation

Liminal currently uses `Math.random()` throughout its creative systems (`CompostSoup`, `MarkovChain`, `DreamEngine`, `GeneratorHarnessTools`). This randomness is white noise — statistically uniform, devoid of history, and easy for downstream systems to ignore. By generating entropy from the system's own metabolism, we make randomness **interesting**, **observable**, and **un-ignorable**.

## Architecture

### New Module: `src/entropy/`

```
src/entropy/
├── MetabolicEntropyEngine.ts    # Core engine
├── EntropyCompressor.ts         # Destructive compression algorithm
├── EntropyHarvester.ts          # Gathers data from EventStore/Heap/Telemetry
├── types.ts                     # EntropyEvent, CompressionConfig, EntropyResult
└── index.ts                     # Public exports
```

### Modified Modules

| File | Change |
|------|--------|
| `src/compost/CompostSoup.ts` | Replace `Math.random()` with `entropyEngine.nextInt()` / `nextFloat()` |
| `src/generators/GeneratorHarnessTools.ts` | Default `seededRandom` reads from entropy engine |
| `src/music/MarkovChain.ts` | Accept `entropy: MetabolicEntropyEngine` in constructor |
| `src/intuition/DreamEngine.ts` | Accept `entropy: MetabolicEntropyEngine` in constructor |
| `src/compost/cli.ts` | Instantiate `MetabolicEntropyEngine`, inject into `CompostMill` |
| `src/compost/EventStore.ts` | Add `entropy_harvest` and `entropy_fallback` to `EventType` union |
| `src/compost/CompostMill.ts` | Accept `entropy?: MetabolicEntropyEngine`; trigger harvest on digest end |

## Destructive Compression Algorithm

### `EntropyCompressor.compress(input: string, rounds = 4): EntropyResult`

**Round 1 — Aggressive Truncation (Spatial Decimation)**
```ts
const stride = (input.length % 5) + 2;
const truncated = input.split('').filter((_, i) => i % stride === 0).join('');
```

**Round 2 — Alphabet Quantization (Symbolic Reduction)**
Map every character to a 16-character alphabet: `0123456789abcdef`.

**Round 3 — Entropic Hashing (Information Collapse)**
```ts
const hash = createHash('sha256').update(reduced).digest('hex');
```

**Round 4 — Recursive Re-entrance**
Use the hash as the new input. Repeat rounds 1–3. After 4 total rounds, extract:
- `seed`: `parseInt(finalHash.slice(0, 16), 16)`
- `phrase`: grouped 4-char chunks mapped to a reduced word list (optional)
- `hashChain`: the 4 intermediate hashes

## Harvesting Strategy

### `EntropyHarvester.gather(): HarvestInput`

The harvester mixes three sources in a fixed format:

```ts
`[EVENTS]${eventsJson}[/EVENTS][FRAGMENTS]${fragmentsText}[/FRAGMENTS][TELEMETRY]${telemetryJson}[/TELEMETRY]`
```

| Source | Amount |
|--------|--------|
| EventStore tail | Last 20 events, NDJSON |
| Creative fragments | Top 3 highest-scoring seeds/fragments from the active fragment store (e.g., `SeedBank`, `FragmentArchive`, or digest output) |
| Telemetry snapshot | `successRate`, `avgDurationMs`, `totalTasks`, `totalViolations` |

### Genesis Mode (Primordial Soup)

When live metabolic data is insufficient (< 5 events and < 1 fragment), the harvester falls back to **genesis mode**, using Liminal's own git history as the primordial entropy source.

**Runtime sourcing:**
```ts
execSync('git log --format="%H %s %ad" --date=iso --all', { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 })
```

**Build-time fallback:** `npm run build` generates `dist/genesis.json` containing the git history.

**Final fallback:** `package.json` metadata + `process.hrtime.bigint()`.

## Quality-Graded API

The `MetabolicEntropyEngine` never throws on entropy requests. It returns a graded result:

```ts
interface EntropyResult {
  seed: number;
  phrase: string;
  quality: 'harvested' | 'degraded' | 'emergency';
  source: 'metabolic' | 'genesis' | 'fallback';
  hashChain: string[];
}
```

### Failure Modes

| Scenario | Behavior | Quality | Source |
|----------|----------|---------|--------|
| Full harvest succeeds | Normal compression | `harvested` | `metabolic` |
| Harvester fails, genesis works | Skip metabolic, use genesis | `degraded` | `genesis` |
| Both fail | Use `Date.now() ^ process.pid` | `emergency` | `fallback` |
| 3 crashes in 60s | Circuit breaker opens | `emergency` | `fallback` |

## Consumer Wiring (Mandatory Integration)

### `CompostSoup`
- Constructor requires `entropy: MetabolicEntropyEngine`.
- Throws at construction time if omitted.
- Uses `entropy.nextInt()` for domain/fragment selection.

### `GeneratorHarnessTools`
- Accepts `entropySource: MetabolicEntropyEngine` in options.
- When `seededRandom` is omitted, defaults to `entropySource.nextFloat()`.
- Throws if neither is provided.

### `MarkovChain`
- Constructor requires `entropy: MetabolicEntropyEngine`.
- Replaces `Math.random()` for note selection and probability thresholds.

### `DreamEngine`
- Constructor requires `entropy: MetabolicEntropyEngine`.
- Replaces `Math.random()` for template selection and weighted choice.

### EventStore Event Types

```ts
type EventType =
  | 'heap_add'
  | 'digest_start'
  | 'digest_end'
  | 'seed_promote'
  | 'entropy_harvest'      // NEW
  | 'entropy_fallback'     // NEW
  | 'soup_start'
  | 'soup_stop'
  | 'soup_cycle'
  | 'seed_use'
  | ...;
```

### CLI Bootstrap (`src/compost/cli.ts`)

```ts
const entropyEngine = new MetabolicEntropyEngine({ eventStore, heap, telemetry });
const mill = new CompostMill(config, llm, entropyEngine);
```

## Lifecycle

1. **Bootstrap:** CLI creates `EventStore`, `TelemetryCollector`, `CompostHeap`, then `MetabolicEntropyEngine`.
2. **Trigger:** `CompostMill.digest()` calls `entropyEngine.harvest()` at the end of every successful digest.
3. **Record:** The engine appends an `entropy_harvest` (or `entropy_fallback`) event to `EventStore`.
4. **Consume:** `CompostSoup`, `GeneratorHarnessTools`, `MarkovChain`, and `DreamEngine` read the latest seed via the engine's API.

## What Does NOT Change

- ID generation (`session-${Date.now()}-${Math.random()}`) remains unchanged. These are not creative randomness.
- Cryptographic uses (`crypto.randomBytes`) remain unchanged.

## Testing Strategy

1. **Unit: `EntropyCompressor`** — Fixed input produces deterministic seed; different inputs produce divergent seeds.
2. **Unit: `EntropyHarvester`** — Mock empty/full states; verify source selection logic.
3. **Integration: Compost cycle** — Run full digest; assert `entropy_harvest` event exists in `EventStore`.
4. **Integration: Consumer wiring** — Verify `CompostSoup` throws without entropy engine and uses seeds correctly when provided.
5. **Integration: Genesis fallback** — Simulate no events/no fragments/no git; verify emergency mode returns a valid seed.

## Success Criteria

- [ ] Zero `Math.random()` calls remain in `CompostSoup`, `MarkovChain`, `DreamEngine`, and `GeneratorHarnessTools`.
- [ ] Every compost digest produces an `entropy_harvest` event.
- [ ] Entropy engine is constructor-injected into all creative consumers.
- [ ] Fresh installation produces valid entropy via genesis mode.
- [ ] All new code meets the 70% coverage ratchet.
