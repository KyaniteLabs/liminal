# Handoff 03 — Guardrail: self-improve daemon must notice its own script changed

**Mode:** You may edit `scripts/quality/self-improve-daemon.sh` only, plus its doc note.

## Purpose

Prevent a recurrence of FAB-009: #698 added a `preferences train` step to the daemon script, but the long-running bash `while true` loop had been parsed at process start (01:54), so the merged change silently never ran — the taste model stayed untrained for ~8 hours until a manual `launchctl kickstart` (23:39Z, 2026-06-10).

## Why this matters

The self-improvement loop is the product's keystone claim. Any future merged improvement to the daemon script is silently inert until someone remembers to restart the daemon. That is a recurring failure mode, not a one-off.

## Implementation constraints

- At the top of each loop iteration, compare the script file's current mtime (or SHA) against the value captured at process start; if changed, log one line (`script changed on disk — re-exec`) and `exec "$0" "$@"` to reload.
- `exec` must happen at a loop boundary (never mid-cycle).
- Keep the change under ~10 lines; preserve existing log style (`[daemon $(date -u +%FT%TZ)] ...`).
- The script is supervised by launchd (`com.sinter.self-improve`); `exec` keeps the same pid, which launchd tolerates. Do not change the plist.

## Exact commands to run

```bash
bash -n scripts/quality/self-improve-daemon.sh   # syntax check, exit 0
shellcheck scripts/quality/self-improve-daemon.sh || true  # report, don't block on pre-existing warnings
```

Then a live proof WITHOUT killing a mid-flight cycle: wait for `sleeping` in `.quality/self-improve-daemon.log`, `touch scripts/quality/self-improve-daemon.sh`, and confirm the next iteration logs the re-exec line. (Touching the file is enough — mtime comparison.)

## Definition of done

Re-exec line appears in the live log after a touch; `bash -n` exit 0; diff confined to the one script (+ optional 2-line note in `docs/validation/self-improve-loop` docs if one exists).

## What not to touch

`scripts/quality/self-improve-cycle.mjs`, the launchd plist, `bin/sinter`, anything in `src/`.

## Final report format

```
DIFF: <stat>
SYNTAX: <bash -n exit code>
LIVE PROOF: <log lines showing re-exec>
```

Stop and ask if launchd restarts the daemon unexpectedly during the live proof (would indicate `exec` is not tolerated and the approach must change to a clean-exit-and-let-launchd-respawn design).
