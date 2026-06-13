# Kinetic Re-normalization (Phase 4.G3)

> Diagnose-and-fix campaign, G3. Simon-approved 2026-06-13 ("do G3"). Ends kinetic's
> "sealed at 0.85" exclusion from the 2026-06-12 banded-rubric re-normalization sweep —
> kinetic now carries honest banded scores like every other visual domain.

## Method (supervised, reversible)

1. Added a `--domain <d[,d2]>` filter to `scripts/quality/rescore-tops.mjs` so a single
   domain can be re-normalized **without re-jittering the already-normalized domains**
   (re-rendering stochastic pieces varies ±0.3 — the judge-swap matrix's known confound).
2. **Paused** the `com.sinter.self-improve` daemon (`launchctl bootout`) so a cycle couldn't
   race the archive save.
3. **Backed up** the archive → `~/.sinter/archive/quality_archive.json.bak-g3-20260613215533`
   (plus the script's own `bak-renorm-2026-06-13T21-55-47…`).
4. Ran `node scripts/quality/rescore-tops.mjs --domain kinetic --all --persist` — re-render +
   re-score each of the 20 kinetic entries with the current banded `ScoringEngine`, persist via
   `QualityArchive.rescoreEntry` (the class-mutation path, never hand-edited).
5. **Reload-verified** (160 visual entries present after) and **resumed** the daemon.

## Result

| | Before | After |
|---|---|---|
| kinetic scores | `0.78×3, 0.82×16, 0.85×1` | `0.72×1, 0.78×4, 0.82×15` |
| range | 0.78 – **0.85 (sealed)** | **0.72** – 0.82 (honest) |

- 20 entries re-scored; 4 changed (deltas −0.13, −0.04, 0, +0.04).
- **The lone "sealed" 0.85 entry re-scored to 0.72** (Δ−0.13) — the seal was *inflating a weak
  kinetic entry*. The rest sit honestly at 0.78–0.82, consistent with the 2026-06-12 codex finding
  (kinetic floor stored 0.85 → fresh 0.78–0.82).

## Consequence

Kinetic's honest floor (0.72, below the quality bar) is now **visible to the self-improvement
loop**, which targets weak domains — instead of a false 0.85 ceiling that masked kinetic from
improvement. No threshold was lowered; the floor was *un-inflated*. This is the same honest-signal
correction the other domains already received.

## Reuse

The new `--domain` filter makes targeted re-normalization a one-liner, e.g.
`node scripts/quality/rescore-tops.mjs --domain <name> --all --persist` (daemon paused, archive
backed up). The weekly read-only rescore cadence (Phase 4.G2) is unaffected — it passes no
`--domain`, so it still reports all domains.
