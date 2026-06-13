# Archive Re-score Cadence (Phase 4.G2)

A weekly, **read-only** re-score of the visual archive's strongest entries, so score
freshness is tracked over time without anyone having to remember to run it. It never
mutates the archive — that path (`--persist`) stays manual and Simon-approved.

## What it does

- Runs `scripts/quality/rescore-tops.mjs` (no `--persist`) → re-renders and re-scores the
  **top-2 entries per visual domain** (p5, glsl, three, hydra, svg, ascii, textgen, kinetic)
  against the current `ScoringEngine` + evaluator.
- Writes a dated JSONL report to `docs/validation/rescore/rescore-YYYY-MM-DD.jsonl`
  (one record per entry; gitignored — it's ops output, not tracked source).
- **Cost:** ~16 GLM render+score calls per run. Read-only: the archive file is never written.

## Schedule

A macOS launchd LaunchAgent (`com.sinter.rescore`), scheduled one-shot, Sundays 04:30 local.
It is a one-shot (`RunAtLoad=false`, no `KeepAlive`) — it wakes, writes the report, and exits;
it is not a resident daemon. It runs from the root worktree, reusing the `dist/` the
self-improve daemon keeps current.

## Install / disable

```bash
# install + load (weekly)
bash scripts/quality/install-rescore-cadence.sh

# disable + remove
bash scripts/quality/install-rescore-cadence.sh --uninstall

# run once on demand (read-only)
bash scripts/quality/rescore-cadence.sh
```

Log: `.quality/rescore-cadence.log`. Reports: `docs/validation/rescore/`.

## Why read-only

Re-normalization (`--persist`) races the self-improve daemon's archive saves and is a
deliberate, supervised operation (see the 2026-06-12 re-normalization sweep). The cadence
deliberately stays read-only: it surfaces drift as evidence; a human decides whether to
re-normalize.
