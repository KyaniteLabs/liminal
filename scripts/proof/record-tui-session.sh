#!/usr/bin/env bash
# Record a Bubble Tea TUI session using macOS `script` command.
# Usage: ./scripts/proof/record-tui-session.sh [description]
#
# Output: .omx/proof/tui-recordings/tui-<timestamp>-<description>.typescript

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RECORDINGS_DIR="$ROOT/.omx/proof/tui-recordings"
mkdir -p "$RECORDINGS_DIR"

DESCRIPTION="${1:-session}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BASENAME="tui-${TIMESTAMP}-${DESCRIPTION}"
RECORDING="$RECORDINGS_DIR/${BASENAME}.typescript"
LOG="$RECORDINGS_DIR/${BASENAME}.log"

echo "Recording TUI session to: $RECORDING"
echo "Bridge log will be at: $LOG"
echo ""
echo "The TUI will start now. Interact normally."
echo "Press Ctrl+C or type /exit to stop recording."
echo ""

# Start bridge in background with logging
LIMINAL_BRIDGE_PORT="${LIMINAL_BRIDGE_PORT:-3000}" \
  node "$ROOT/scripts/start-bubbletea-tui.mjs" > "$LOG" 2>&1 &
BRIDGE_PID=$!

cleanup() {
  echo ""
  echo "Stopping recording..."
  kill "$BRIDGE_PID" 2>/dev/null || true
  wait "$BRIDGE_PID" 2>/dev/null || true
  echo "Recording saved to: $RECORDING"
  echo "Bridge log saved to: $LOG"
}
trap cleanup EXIT INT TERM

# Wait for bridge
echo "Waiting for bridge on port $LIMINAL_BRIDGE_PORT..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$LIMINAL_BRIDGE_PORT/api/tui/session" \
       -X POST -H 'Content-Type: application/json' -d '{}' > /dev/null 2>&1; then
    echo "Bridge is ready."
    break
  fi
  sleep 0.5
done

# Record the TUI session
# macOS `script` captures raw terminal I/O
if command -v script &>/dev/null; then
  script -q "$RECORDING" pnpm run tui 2>/dev/null || true
else
  echo "script command not found, using tee fallback"
  pnpm run tui 2>&1 | tee "$RECORDING" || true
fi
