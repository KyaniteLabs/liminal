#!/bin/bash
# Overnight Fable watchman: one bounded headless agent pass per invocation.
# Diagnoses daemon cycles, ships <=30-line test-first fixes or files findings,
# and logs to docs/validation/watchman-log.md. Schedule: launchd
# (com.sinter.fable-watchman). Disable:
#   launchctl unload ~/Library/LaunchAgents/com.sinter.fable-watchman.plist
#
# Runner cascade (first that exits 0 wins): codex -> kimi -> claude.
# codex/kimi run on this machine's GLM/Moonshot auth (cheapest sufficient
# inference for a bounded analysis pass); claude is the premium fallback and
# needs a fresh `claude setup-token` login. Override order:
#   WATCHMAN_RUNNERS="claude codex" bash scripts/quality/fable-watchman.sh
set -u
REPO="/Users/simongonzalezdecruz/workspaces/liminal"
LOG="$REPO/.quality/watchman.log"
PROMPT_FILE="$REPO/scripts/quality/watchman-prompt.md"
export PATH="$HOME/.local/bin:$HOME/.kimi-code/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$REPO" || exit 1

# Concurrency guard: never run a pass while another agent is mid-operation in
# this repo (a kickstart test raced an interactive session today: ref-lock
# failures + a FAB id collision). Signals: git's own index lock, or an
# unambiguous headless agent process already running. Interactive sessions are
# not reliably detectable — the overnight schedule keeps that overlap rare.
if [ -f "$REPO/.git/index.lock" ] || pgrep -f "codex exec|kimi-cli -y|claude -p" >/dev/null 2>&1; then
  echo "[watchman $(date -u +%FT%TZ)] another agent active in repo — skipping pass" >> "$LOG"
  exit 0
fi

run_codex() {
  codex exec --dangerously-bypass-approvals-and-sandbox "$(cat "$PROMPT_FILE")"
}

run_kimi() {
  kimi-cli -y -w "$REPO" -p "$(cat "$PROMPT_FILE")"
}

run_claude() {
  # Sanitize provider overrides (the repo env points ANTHROPIC_* at the GLM
  # proxy / stale tokens). Headless auth: long-lived token from
  # `claude setup-token`, stored at ~/.claude/watchman-token (chmod 600,
  # never committed). Delegation policy (Simon, 2026-06-11): claude
  # delegation runs HAIKU only — premium models are not for watchman passes.
  local token=""
  [ -f "$HOME/.claude/watchman-token" ] && token="$(cat "$HOME/.claude/watchman-token")"
  /usr/bin/env -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL \
    -u ANTHROPIC_DEFAULT_HAIKU_MODEL -u ANTHROPIC_DEFAULT_OPUS_MODEL -u ANTHROPIC_DEFAULT_SONNET_MODEL \
    ${token:+CLAUDE_CODE_OAUTH_TOKEN="$token"} \
    claude -p "$(cat "$PROMPT_FILE")" --model haiku --dangerously-skip-permissions --max-turns 40
}

# Land a pass via a branch + PR, never a direct push to main. Branch-protected CI
# rejects direct pushes to main, so the agent's commit (made on the root worktree's
# local main) would otherwise pile up unpushed and re-diverge the shared daemon
# worktree. This converts any local-ahead commit into a review-gated PR (NOT auto-merged
# — see the 2026-06-14 Hydra-clamp lesson) and restores the root to clean main. The
# agent's work is pushed to the branch BEFORE any reset, so it is never lost.
land_via_pr() {
  git -C "$REPO" fetch origin main --quiet 2>/dev/null || return 0
  local ahead
  ahead=$(git -C "$REPO" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  [ "${ahead:-0}" -gt 0 ] || return 0
  local br="watchman/auto-$(date -u +%Y%m%d-%H%M%S)"
  if ! git -C "$REPO" push origin "HEAD:refs/heads/$br" 2>>"$LOG"; then
    echo "[watchman $(date -u +%FT%TZ)] branch push FAILED — leaving commits local" >> "$LOG"
    return 0
  fi
  local token api
  token=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill 2>/dev/null | awk -F= '/^password=/{print $2}')
  api="https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal"
  if [ -n "$token" ]; then
    curl -s -X POST -H "Authorization: token $token" -H "Content-Type: application/json" "$api/pulls" \
      -d "{\"title\":\"watchman: automated pass ($br)\",\"head\":\"$br\",\"base\":\"main\",\"body\":\"Automated overnight watchman pass. REVIEW before merge — do not auto-merge code changes (2026-06-14 Hydra-clamp lesson).\"}" \
      >> "$LOG" 2>&1
  fi
  echo "[watchman $(date -u +%FT%TZ)] landed pass as branch $br + PR (review-gated)" >> "$LOG"
  # Restore root to clean main; the daemon-owned ledger (telemetry) is reset to origin's.
  git -C "$REPO" stash push -q -u -- docs/validation/self-improve-ledger.jsonl 2>/dev/null
  git -C "$REPO" reset --hard origin/main >> "$LOG" 2>&1
  git -C "$REPO" checkout HEAD -- docs/validation/self-improve-ledger.jsonl 2>/dev/null
  git -C "$REPO" stash drop 2>/dev/null || true
}

for runner in ${WATCHMAN_RUNNERS:-codex kimi claude}; do
  case "$runner" in
    codex) bin=codex ;;
    kimi) bin=kimi-cli ;;
    claude) bin=claude ;;
    *) echo "[watchman $(date -u +%FT%TZ)] unknown runner $runner — skipping" >> "$LOG"; continue ;;
  esac
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[watchman $(date -u +%FT%TZ)] runner $runner ($bin) not installed — skipping" >> "$LOG"
    continue
  fi
  echo "[watchman $(date -u +%FT%TZ)] pass start runner=$runner" >> "$LOG"
  "run_$runner" < /dev/null >> "$LOG" 2>&1
  rc=$?
  echo "[watchman $(date -u +%FT%TZ)] pass end runner=$runner rc=$rc" >> "$LOG"
  if [ $rc -eq 0 ]; then land_via_pr; exit 0; fi
done
echo "[watchman $(date -u +%FT%TZ)] ALL RUNNERS FAILED" >> "$LOG"
exit 1
