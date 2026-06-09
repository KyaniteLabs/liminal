#!/usr/bin/env bash
#
# Install (or refresh) the permanent self-healing self-improvement daemon as a
# macOS launchd LaunchAgent. Idempotent. Replaces the legacy 6h `sinter-self-improve`
# cron with an always-resident, KeepAlive (self-healing), RunAtLoad (persistent) service
# that runs the GLM self-improve loop.
#
# Usage:   bash scripts/quality/install-self-improve-daemon.sh
# Remove:  bash scripts/quality/install-self-improve-daemon.sh --uninstall

set -euo pipefail

LABEL="com.sinter.self-improve"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNNER="$REPO/scripts/quality/self-improve-daemon.sh"
LOG="$REPO/.quality/self-improve-daemon.log"
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

# 1) Remove the legacy cron entry (avoid a duplicate loop), backing up the crontab.
if crontab -l 2>/dev/null | grep -q 'sinter-self-improve'; then
  crontab -l > "$HOME/.sinter/crontab.bak-$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
  crontab -l 2>/dev/null | grep -v 'sinter-self-improve' | crontab -
  echo "removed legacy sinter-self-improve cron (backed up)"
fi

# 2) Ensure runner is executable and log dir exists.
chmod +x "$RUNNER"
mkdir -p "$REPO/.quality"

# 3) Write the LaunchAgent plist.
mkdir -p "$HOME/Library/LaunchAgents"
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
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
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

# 4) (Re)load it.
unload
launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null || launchctl load -w "$PLIST"

echo "installed + loaded $LABEL"
echo "  runner: $RUNNER"
echo "  log:    $LOG"
launchctl print "$DOMAIN/$LABEL" 2>/dev/null | grep -iE "state|pid|program =" | head -5 || launchctl list | grep "$LABEL" || true
