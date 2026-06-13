#!/usr/bin/env bash
#
# cli-worker.sh — safe dispatch of a NON-ANTHROPIC headless coding worker into an
# isolated git worktree. Encapsulates the kimi-cli gotchas that cost a multi-hour
# debacle on 2026-06-12 (see memory: diagnose-fix-campaign-2026-06-12), so the
# safe path is the only path:
#
#   1. MCP auto-load hang — `kimi-cli --print` auto-loads ~/.kimi-code/mcp.json
#      (12 servers), hangs at "loading", and exits making NO edits. FIX: always
#      pass an empty --mcp-config-file.
#   2. Invisible worker — the worker process is named "Kimi Code", NOT "kimi-cli".
#      Every `pgrep kimi-cli` missed it, so multiple workers ran concurrently and
#      corrupted the same file. FIX: a single-worker guard + a wait that polls the
#      real "Kimi Code" process name.
#   3. Self-matching wait — an INLINE `bash -c 'until ! pgrep -f "kimi-cli"...'`
#      self-matches (its own cmdline contains the search string). FIX: keep the
#      wait in THIS FILE — a script's matched string lives in the file, not the
#      launching cmdline, so pgrep here only matches real workers.
#
# Anthropic and codex are NEVER used (Simon's standing constraint, 2026-06-12).
# The worker EDITS files in the worktree but does NOT commit/push — the
# orchestrator reviews, verifies, and PRs the result.
#
# Usage:
#   scripts/dispatch/cli-worker.sh -w <worktree> -p <prompt-file> [-m <model>]
#   scripts/dispatch/cli-worker.sh --help
#
# Exit codes: 0 worker ran to completion · 2 bad args · 3 another worker already
# running · 4 runner binary missing.

set -u

RUNNER="kimi"          # only non-anthropic coding CLI proven to work headless
MODEL=""               # optional --model passthrough (rotate the underlying model)
WORKTREE=""
PROMPT_FILE=""
MAX_STEPS="${CLI_WORKER_MAX_STEPS:-80}"

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -w|--worktree)   WORKTREE="${2:-}"; shift 2 ;;
    -p|--prompt)     PROMPT_FILE="${2:-}"; shift 2 ;;
    -m|--model)      MODEL="${2:-}"; shift 2 ;;
    --runner)        RUNNER="${2:-}"; shift 2 ;;
    -h|--help)       usage 0 ;;
    *) echo "cli-worker: unknown arg '$1'" >&2; usage 2 ;;
  esac
done

[ -n "$WORKTREE" ] && [ -d "$WORKTREE" ] || { echo "cli-worker: -w <worktree> must be an existing dir" >&2; exit 2; }
[ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ] || { echo "cli-worker: -p <prompt-file> must be an existing file" >&2; exit 2; }

case "$RUNNER" in
  kimi) BIN="kimi-cli" ;;
  *) echo "cli-worker: runner '$RUNNER' not supported (anthropic/codex are forbidden; only 'kimi' is wired)" >&2; exit 2 ;;
esac
command -v "$BIN" >/dev/null 2>&1 || { echo "cli-worker: '$BIN' not on PATH" >&2; exit 4; }

# --- Single-worker guard (gotcha #2): refuse if a "Kimi Code" worker is already
# running anywhere. Concurrent workers on the same file corrupt it. The string
# "Kimi Code" lives in this file, not in this process's cmdline, so pgrep does
# not self-match. ---
if pgrep -f "Kimi Code" >/dev/null 2>&1; then
  echo "cli-worker: a 'Kimi Code' worker is already running — one at a time." >&2
  echo "            wait for it, or: pkill -9 -f 'Kimi Code'" >&2
  exit 3
fi

# --- Empty MCP config (gotcha #1) ---
EMPTY_MCP="$(mktemp -t cli-worker-mcp.XXXXXX)"
printf '{"mcpServers":{}}' > "$EMPTY_MCP"
cleanup() { rm -f "$EMPTY_MCP"; }
trap cleanup EXIT

LOG="$WORKTREE/.cli-worker.log"
echo "cli-worker: launching $RUNNER${MODEL:+ (model=$MODEL)} in $WORKTREE — log: $LOG"

# shellcheck disable=SC2086
nohup "$BIN" --print -y \
  --mcp-config-file "$EMPTY_MCP" \
  --max-steps-per-turn "$MAX_STEPS" \
  ${MODEL:+-m "$MODEL"} \
  -w "$WORKTREE" \
  -p "$(cat "$PROMPT_FILE")" \
  > "$LOG" 2>&1 &
LAUNCHER_PID=$!
echo "cli-worker: launcher PID $LAUNCHER_PID"

# --- Reliable wait (gotcha #2 + #3): the launcher shell may exit before the
# "Kimi Code" worker does, so wait until BOTH the launcher is gone AND no
# "Kimi Code" process remains. PID-based for the launcher; name-based (safe from
# a file) for the worker. ---
while kill -0 "$LAUNCHER_PID" 2>/dev/null || pgrep -f "Kimi Code" >/dev/null 2>&1; do
  sleep 15
done

echo "cli-worker: worker finished. Review the diff in $WORKTREE, then verify (tsc/tests) before committing."
echo "cli-worker: worker does NOT commit — the orchestrator owns review + PR."
exit 0
