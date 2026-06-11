#!/bin/bash
# Overnight Fable watchman: one bounded headless Claude pass per invocation.
# Diagnoses daemon cycles, ships <=30-line test-first fixes or files findings,
# and logs to docs/validation/watchman-log.md. Schedule: launchd
# (com.sinter.fable-watchman). Disable: launchctl unload ~/Library/LaunchAgents/com.sinter.fable-watchman.plist
set -u
REPO="/Users/simongonzalezdecruz/workspaces/liminal"
LOG="$REPO/.quality/watchman.log"
cd "$REPO" || exit 1
echo "[watchman $(date -u +%FT%TZ)] pass start" >> "$LOG"
# Sanitize provider overrides (the repo env points ANTHROPIC_* at the GLM
# proxy / stale tokens — claude must use its own keychain login; same env
# hygiene as the truth matrix's sanitized test runs).
/usr/bin/env -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL \
  -u ANTHROPIC_DEFAULT_HAIKU_MODEL -u ANTHROPIC_DEFAULT_OPUS_MODEL -u ANTHROPIC_DEFAULT_SONNET_MODEL \
  PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" \
  claude -p "$(cat "$REPO/scripts/quality/watchman-prompt.md")" \
  --dangerously-skip-permissions --max-turns 40 >> "$LOG" 2>&1
rc=$?
echo "[watchman $(date -u +%FT%TZ)] pass end rc=$rc" >> "$LOG"
