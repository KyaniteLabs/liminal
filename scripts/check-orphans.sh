#!/bin/bash
# Check for orphaned source files across source, tests, and runtime entrypoints.

set -euo pipefail

orphans=0
for file in $(find src -name '*.ts' -not -name 'index.ts' -not -name '*.d.ts' 2>/dev/null || true); do
    basename=$(basename "$file" .ts)
    pattern="from\s+['\"][^'\"]*/$basename(\.js|\.ts)?['\"]|import\s+[^'\"]*['\"][^'\"]*/$basename(\.js|\.ts)?['\"]|import\s*\(\s*['\"][^'\"]*/$basename(\.js|\.ts)?['\"]"
    matches=$(
        rg -l "$pattern" src bin scripts test gui \
          --glob "*.ts" \
          --glob "*.tsx" \
          --glob "*.js" \
          --glob "*.mjs" \
          --glob "!**/node_modules/**" \
          --glob "!**/dist/**" \
          --glob "!**/coverage/**" \
          2>/dev/null || true
    )
    refs=$(printf '%s\n' "$matches" | grep -v "^$file$" | grep -c . || true)
    if [ "$refs" -eq 0 ]; then
        echo "ORPHAN: $file"
        orphans=$((orphans + 1))
    fi
done

if [ "$orphans" -gt 0 ]; then
    echo ""
    echo "$orphans orphaned file(s) found."
    exit 1
else
    echo "No orphaned files found."
fi
