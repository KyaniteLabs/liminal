#!/usr/bin/env bash
#
# Weekly archive re-score cadence (READ-ONLY) — Phase 4.G2.
#
# Runs the read-only top-2-per-visual-domain re-score (scripts/quality/rescore-tops.mjs
# with NO --persist, so it NEVER mutates ~/.sinter/archive) and writes a dated JSONL
# report to docs/validation/rescore/. This is a scheduled ONE-SHOT (launchd
# StartCalendarInterval), not a resident daemon — it runs, writes the report, exits.
#
# Cost: ~16 GLM render+score calls per run (top-2 × 8 visual domains). Read-only.
#
# Managed by ~/Library/LaunchAgents/com.sinter.rescore.plist
# (install/uninstall via scripts/quality/install-rescore-cadence.sh).
#
# Tunables (env): SINTER_REPO (default: ~/workspaces/liminal).

set -u

REPO="${SINTER_REPO:-$HOME/workspaces/liminal}"
export PATH="/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"

cd "$REPO" || { echo "[rescore] FATAL: repo not found at $REPO"; exit 1; }

REPORT_DIR="docs/validation/rescore"
LOG=".quality/rescore-cadence.log"
mkdir -p "$REPORT_DIR" .quality

DATE="$(date -u +%Y-%m-%d)"
REPORT="$REPORT_DIR/rescore-$DATE.jsonl"

echo "[rescore $(date -u +%FT%TZ)] start — read-only top-2/domain re-score → $REPORT"

# The re-score reads the compiled runtime under dist/. The self-improve daemon keeps
# dist current; build only if it is somehow missing so a cold machine still works.
if [ ! -d dist ]; then
  echo "[rescore $(date -u +%FT%TZ)] dist missing — building"
  pnpm build || { echo "[rescore $(date -u +%FT%TZ)] build FAILED — aborting"; exit 1; }
fi

if node scripts/quality/rescore-tops.mjs > "$REPORT" 2>>"$LOG"; then
  count="$(grep -c . "$REPORT" 2>/dev/null || echo 0)"
  echo "[rescore $(date -u +%FT%TZ)] ok — $count records written to $REPORT (read-only; archive untouched)"
else
  rc=$?
  echo "[rescore $(date -u +%FT%TZ)] FAILED (rc=$rc) — see $LOG"
  exit "$rc"
fi
