#!/usr/bin/env bash
#
# Permanent self-improvement loop (GLM) — the persistent, self-healing daemon.
#
# Runs the #664 domain-diversified self-improve cycle on a paced interval, forever,
# against the global ~/.sinter config (generator + evaluator = GLM). Two layers of
# self-healing:
#   - inner:  a failed cycle is logged and the loop continues (never exits on error)
#   - outer:  launchd KeepAlive restarts this whole script if it is ever killed/crashes
# Persistent: launchd RunAtLoad starts it at login and across reboots.
#
# Managed by ~/Library/LaunchAgents/com.sinter.self-improve.plist
# (install/uninstall via scripts/quality/install-self-improve-daemon.sh).
#
# Tunables (env): SINTER_REPO, SINTER_CYCLE_COUNT, SINTER_CYCLE_INTERVAL (seconds).

set -u

REPO="${SINTER_REPO:-$HOME/workspaces/liminal}"
COUNT="${SINTER_CYCLE_COUNT:-3}"
INTERVAL="${SINTER_CYCLE_INTERVAL:-3600}"   # seconds between cycles (default: 1h)

export PATH="/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"

cd "$REPO" || { echo "[daemon] FATAL: repo not found at $REPO"; exit 1; }

SCRIPT_PATH="$0"
SCRIPT_MTIME="$(stat -f %m "$SCRIPT_PATH" 2>/dev/null || stat -c %Y "$SCRIPT_PATH")"

echo "[daemon $(date -u +%FT%TZ)] started — repo=$REPO count=$COUNT interval=${INTERVAL}s (GLM)"

while true; do
  current_mtime="$(stat -f %m "$SCRIPT_PATH" 2>/dev/null || stat -c %Y "$SCRIPT_PATH")"
  if [ "$current_mtime" != "$SCRIPT_MTIME" ]; then
    echo "[daemon $(date -u +%FT%TZ)] script changed on disk — re-exec"
    exec "$SCRIPT_PATH" "$@"
  fi

  mkdir -p .quality
  head_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  build_marker=".quality/last-build-sha"
  if [ -n "$head_sha" ]; then
    last_build_sha="$(cat "$build_marker" 2>/dev/null || true)"
    if [ "$head_sha" != "$last_build_sha" ]; then
      echo "[daemon $(date -u +%FT%TZ)] HEAD moved ${last_build_sha:-none}→${head_sha} — rebuilding dist"
      if pnpm build; then
        printf '%s\n' "$head_sha" > "$build_marker"
      else
        rc=$?
        echo "[daemon $(date -u +%FT%TZ)] build FAILED (rc=$rc) — running PREVIOUS dist"
      fi
    fi
  fi

  # LLM-free gardener pass first: refresh health/stagnation telemetry and
  # persist the dream plan that the cycle below consumes (one dream per cycle).
  echo "[daemon $(date -u +%FT%TZ)] garden tend"
  node bin/sinter garden tend || echo "[daemon $(date -u +%FT%TZ)] tend FAILED (rc=$?) — continuing"
  # LLM-free taste training: score-gap auto-feed means the model trains from
  # the archive's own evaluator ordering, refined by human pins when they exist.
  # `preferences train` is the PERSISTING path (TasteLearningService → SinterFS).
  echo "[daemon $(date -u +%FT%TZ)] preferences train"
  node bin/sinter preferences train || echo "[daemon $(date -u +%FT%TZ)] preferences train FAILED (rc=$?) — continuing"
  echo "[daemon $(date -u +%FT%TZ)] cycle start"
  if node scripts/quality/self-improve-cycle.mjs "$COUNT"; then
    echo "[daemon $(date -u +%FT%TZ)] cycle ok"
  else
    echo "[daemon $(date -u +%FT%TZ)] cycle FAILED (rc=$?) — continuing"
  fi
  echo "[daemon $(date -u +%FT%TZ)] sleeping ${INTERVAL}s"
  sleep "$INTERVAL"
done
