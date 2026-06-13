#!/usr/bin/env bash
#
# Install (or refresh) the weekly READ-ONLY archive re-score cadence as a macOS
# launchd LaunchAgent. Scheduled one-shot (Sundays 04:30 local time). Idempotent.
#
# Runs scripts/quality/rescore-cadence.sh, which re-scores the top-2 entries per
# visual domain (read-only — never mutates the archive) and writes a dated JSONL
# report to docs/validation/rescore/. Cost: ~16 GLM render+score calls per week.
#
# Usage:   bash scripts/quality/install-rescore-cadence.sh
# Remove:  bash scripts/quality/install-rescore-cadence.sh --uninstall

set -euo pipefail

LABEL="com.sinter.rescore"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNNER="$REPO/scripts/quality/rescore-cadence.sh"
LOG="$REPO/.quality/rescore-cadence.log"
DOMAIN="gui/$(id -u)"

unload() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
}

if [[ "${1:-}" == "--uninstall" ]]; then
  unload
  rm -f "$PLIST"
  echo "uninstalled $LABEL"
  exit 0
fi

chmod +x "$RUNNER"
mkdir -p "$REPO/.quality" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RUNNER}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>
    <key>Hour</key><integer>4</integer>
    <key>Minute</key><integer>30</integer>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>WorkingDirectory</key><string>${REPO}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>${HOME}</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
PLIST_EOF

unload
launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST"

echo "installed + loaded $LABEL (weekly: Sundays 04:30 local)"
echo "  runner: $RUNNER"
echo "  log:    $LOG"
echo "  cost:   ~16 GLM render+score calls/week (READ-ONLY; archive never mutated)"
echo "  disable: bash scripts/quality/install-rescore-cadence.sh --uninstall"
