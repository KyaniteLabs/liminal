#!/bin/bash
# Auto-Ratchet — lint warnings and `any` type counts only go DOWN
# Usage: ./scripts/ci/auto-ratchet.sh [--update]
#   --update  Write current counts to floor files (use in CI after successful run)
#   (no flag) Compare current counts to floor files, exit 1 if regressed

set -euo pipefail

FLOOR_DIR=".pipeline"
LINT_FLOOR="$FLOOR_DIR/lint-floor.json"
ANY_FLOOR="$FLOOR_DIR/any-floor.json"
UPDATE=false

if [ "${1:-}" = "--update" ]; then
  UPDATE=true
fi

mkdir -p "$FLOOR_DIR"

# ──────────────────────────────────────────────────
# 1. Count ESLint warnings/errors in src/
# ──────────────────────────────────────────────────
count_lint() {
  local output
  output=$(npx eslint 'src/**/*.{ts,js}' --format json 2>/dev/null || true)
  if [ -z "$output" ] || echo "$output" | jq -e '. == []' >/dev/null 2>&1; then
    echo '{"errors": 0, "warnings": 0}'
    return
  fi
  local errors warnings
  errors=$(echo "$output" | jq '[.[].errorCount] | add // 0')
  warnings=$(echo "$output" | jq '[.[].warningCount] | add // 0')
  echo "{\"errors\": $errors, \"warnings\": $warnings}"
}

# ──────────────────────────────────────────────────
# 2. Count `any` type annotations in src/
# ──────────────────────────────────────────────────
count_any() {
  local total
  total=$(grep -rn ': any\b\|: any\[\|as any\b' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'node_modules' | grep -v '.d.ts' | wc -l | tr -d ' ')
  echo "{\"any_count\": $total}"
}

# ──────────────────────────────────────────────────
# 3. Ratchet logic — compare or update
# ──────────────────────────────────────────────────
ratchet_check() {
  local name="$1"
  local current="$2"
  local floor="$3"
  local key="$4"
  local current_val
  local floor_val

  current_val=$(echo "$current" | jq ".$key")
  floor_val=$(echo "$floor" | jq ".$key")

  if [ "$current_val" -lt "$floor_val" ]; then
    echo "IMPROVED: $name $key $floor_val → $current_val (ratchet will update)"
    return 0
  elif [ "$current_val" -gt "$floor_val" ]; then
    echo "REGRESSED: $name $key $floor_val → $current_val (BLOCKED)"
    return 1
  else
    echo "OK: $name $key = $current_val"
    return 0
  fi
}

# ──────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────
LINT_CURRENT=$(count_lint)
ANY_CURRENT=$(count_any)

echo "Current lint: $LINT_CURRENT"
echo "Current any:  $ANY_CURRENT"

BLOCKED=false

if [ "$UPDATE" = true ]; then
  echo "$LINT_CURRENT" > "$LINT_FLOOR"
  echo "$ANY_CURRENT" > "$ANY_FLOOR"
  echo "Floor files updated:"
  echo "  $LINT_FLOOR → $LINT_CURRENT"
  echo "  $ANY_FLOOR → $ANY_CURRENT"
  exit 0
fi

# Initialize floors if they don't exist
if [ ! -f "$LINT_FLOOR" ]; then
  echo "No lint floor file. Creating initial baseline."
  echo "$LINT_CURRENT" > "$LINT_FLOOR"
fi
if [ ! -f "$ANY_FLOOR" ]; then
  echo "No any floor file. Creating initial baseline."
  echo "$ANY_CURRENT" > "$ANY_FLOOR"
fi

LINT_FLOOR_CONTENT=$(cat "$LINT_FLOOR")
ANY_FLOOR_CONTENT=$(cat "$ANY_FLOOR")

echo ""
echo "Lint floor: $LINT_FLOOR_CONTENT"
echo "Any floor:  $ANY_FLOOR_CONTENT"
echo ""

# Check lint errors
if ! ratchet_check "lint" "$LINT_CURRENT" "$LINT_FLOOR_CONTENT" "errors"; then
  BLOCKED=true
fi
# Check lint warnings
if ! ratchet_check "lint" "$LINT_CURRENT" "$LINT_FLOOR_CONTENT" "warnings"; then
  BLOCKED=true
fi
# Check any count
if ! ratchet_check "types" "$ANY_CURRENT" "$ANY_FLOOR_CONTENT" "any_count"; then
  BLOCKED=true
fi

# Auto-update floors if improved
if [ "$BLOCKED" = false ]; then
  LINT_ERR_FLOOR=$(echo "$LINT_FLOOR_CONTENT" | jq '.errors')
  LINT_ERR_CURRENT=$(echo "$LINT_CURRENT" | jq '.errors')
  LINT_WARN_FLOOR=$(echo "$LINT_FLOOR_CONTENT" | jq '.warnings')
  LINT_WARN_CURRENT=$(echo "$LINT_CURRENT" | jq '.warnings')
  ANY_FLOOR_VAL=$(echo "$ANY_FLOOR_CONTENT" | jq '.any_count')
  ANY_CURRENT_VAL=$(echo "$ANY_CURRENT" | jq '.any_count')

  if [ "$LINT_ERR_CURRENT" -lt "$LINT_ERR_FLOOR" ] || [ "$LINT_WARN_CURRENT" -lt "$LINT_WARN_FLOOR" ]; then
    echo "$LINT_CURRENT" > "$LINT_FLOOR"
    echo "Lint floor auto-updated."
  fi
  if [ "$ANY_CURRENT_VAL" -lt "$ANY_FLOOR_VAL" ]; then
    echo "$ANY_CURRENT" > "$ANY_FLOOR"
    echo "Any floor auto-updated."
  fi
fi

if [ "$BLOCKED" = true ]; then
  echo ""
  echo "RATCHET BLOCKED. Fix regressions before merging."
  echo "To reset floors (NOT recommended): ./scripts/ci/auto-ratchet.sh --update"
  exit 1
fi

echo ""
echo "All ratchet checks passed."
