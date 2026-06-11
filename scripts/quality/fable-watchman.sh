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
  [ $rc -eq 0 ] && exit 0
done
echo "[watchman $(date -u +%FT%TZ)] ALL RUNNERS FAILED" >> "$LOG"
exit 1
