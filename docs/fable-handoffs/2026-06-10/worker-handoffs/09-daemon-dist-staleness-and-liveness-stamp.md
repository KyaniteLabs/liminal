# Handoff 09 — Daemon dist-staleness rebuild + per-cycle liveness stamp (closes the merged-vs-live class)

**Mode:** You may edit `scripts/quality/self-improve-daemon.sh` and `scripts/quality/self-improve-cycle.mjs` only.

## Purpose

Two real incidents in 12 hours of the same class — merged code that the live self-improvement loop silently did not run:

1. FAB-009 (2026-06-10): #698's `preferences train` step inert for ~8h (stale parsed loop body). Fixed by Handoff 03's re-exec-on-mtime guardrail.
2. FAB-015 (2026-06-11): the entire handoff-fix merge (`ee5a54f0` at 01:48Z — F18 contract, ASCII receipt fix, H06 render measurement) was dormant because `dist/` was last built at 15:21 the previous day; the daemon invokes `node bin/sinter` against dist. Caught at ~03:00Z; fixed operationally (`pnpm build` + restart, daemon pid 20551).

The script guardrail covers the script file only. Nothing covers dist after a merge. Both incidents were found by forensic auditing — the loop must self-report instead.

## Implementation (two small pieces)

**A. Rebuild dist when HEAD moved.** At the top of each loop iteration (after the existing mtime re-exec check): read `git rev-parse HEAD`; compare to `.quality/last-build-sha`. If different (or marker missing): log `[daemon …] HEAD moved <old>→<new> — rebuilding dist`, run `pnpm build`; on success write the marker, on failure log loudly (`build FAILED (rc=$?) — running PREVIOUS dist`) and continue (a broken build must not kill the loop; the stamp in B makes the degradation visible).

**B. Liveness stamp per cycle.** Each ledger line (in `self-improve-cycle.mjs`, which writes `docs/validation/self-improve-ledger.jsonl`) gains two fields: `codeSha` (git HEAD) and `distBuiltAt` (mtime of `dist/index.js`, ISO). Then "is the merged fix live?" is one grep, forever.

Keep total diff under ~35 lines. Match existing log style. `bash -n` clean.

## Verification

```bash
bash -n scripts/quality/self-improve-daemon.sh
node -e "/* parse last ledger line, assert codeSha + distBuiltAt present after one live cycle */"
```

Live proof: after merge + daemon pickup (the mtime guardrail now handles pickup), confirm the next ledger line carries both fields and that an empty-commit HEAD bump triggers the rebuild log line.

## What not to touch

`bin/sinter`, `src/`, the launchd plist, ledger lines already written (append-only).

## Final report format

```
DIFF: <stat>
SYNTAX: <bash -n exit>
LEDGER PROOF: <last ledger line showing codeSha + distBuiltAt>
REBUILD PROOF: <log lines from the HEAD-moved path>
```

Stop and ask if `pnpm build` inside the daemon iteration exceeds ~3 minutes on this machine (would delay cycles; we'd switch to building only when idle-budget allows).
