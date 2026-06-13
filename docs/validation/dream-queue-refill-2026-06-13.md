# Dream Queue Refill — Reviving Recombination (D3)

> Diagnose-and-fix campaign, D3. Simon-approved 2026-06-13 ("do D3"). Revives the
> dreaming/recombination layer, which had gone dark (`dreams: +0 new` since 2026-06-11).

## The handoff's premise was stale

The handoff said D3 was *architectural and risky*: "the emergence MAP-Elites archive is
starved — `<2` occupied elites, garden health 10% — because the live loop populates the
QualityArchive but not the emergence archive." **That is no longer true.** `RalphLoop:1786`
already calls `EmergenceHooks.onCreativeRun` on every fresh generation (lineage has 5,645
entries), and `EmergenceHooks.getArchive()` lazily hydrates from SinterFS. Live state:

```
garden tend → 264–265 cells, health 84.1%, 100% occupancy, stagnation: NO
project-local .sinter/refs/archive → 347 persisted refs
```

The emergence archive is **healthy**. The "10% / <2 elites" was the pre-hydration-fix state.
So D3 was **not** the hot-loop wiring the handoff feared — it's a narrower, contained bug in
the dream queue, and the fix never touches the generation loop.

## The real root cause of `dreams: +0`

Two compounding bugs starved the dream queue:

1. **The queue saturated with finished history and was never pruned.** `DreamQueue` has
   `DEFAULT_MAX_QUEUE = 50` and `enqueue()` returns `undefined` once `queue.length >= 50`.
   The queue held exactly **50 finished tasks** (39 completed + 11 failed), and `garden tend`
   **never called `prune()`** — so enqueue was permanently blocked. The queue could never
   accept a new recombination, so the gen loop (`self-improve-cycle.mjs:122` dequeues one
   dream/cycle as a theme) always found `queued=0` and fell back to the idea pool.
2. **`DreamPlanner` re-proposed the same top pairs every cycle.** From a stable archive it
   deterministically picked `topQuality × topNovel` etc., which the garden-tend dedup rejected
   against the 50 tried — so even with queue room it would have been `+0`.

## The fix (bounded, no hot-loop changes)

- `garden tend` now **prunes finished dreams** before planning (capturing their signatures
  first for dedup), reclaiming queue slots.
- `DreamPlanner.plan(cells, axes, { excludeKeys })` walks **deeper into each strategy's
  candidate space** to propose only FRESH pairings from the huge unexplored pair space
  (265 cells → ~35k possible pairs, ~50 tried), instead of re-proposing the same top pairs.

## Proof (live, daemon paused)

```
BEFORE: queue = { completed: 39, failed: 11 } (50, full) → dreams: +0 new, queued=0
AFTER:  pruned 50 finished dream(s) → dreams: +8 new (queued=8 completed=0)
        queue = { queued: 8 } (8 fresh recombinations)
```

The 8 queued recombinations are now drainable by the gen loop (one/cycle as a dream theme),
so dreaming/recombination is live again. Unit coverage: `DreamPlanner.test.ts` gains two tests
pinning the `excludeKeys` freshness contract (8/8 pass; 34/34 dreaming suite).

## Note

`DreamPlanner.groupByDomain` keys on `artifactRef.kind`, which is always `'generated-code'`
for live entries, so the **cross-modal** strategy is inert in production (a separate, pre-existing
limitation — the elite-x-elite / distant-niche / elite-x-compost strategies carry the variety).
Worth revisiting if cross-modal recombination is wanted, but out of scope for reviving the queue.
