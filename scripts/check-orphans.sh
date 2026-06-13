#!/bin/bash
# Check for orphaned source files across source, tests, and runtime entrypoints.

set -euo pipefail

orphans=0
for file in $(find src -name '*.ts' -not -name 'index.ts' -not -name '*.d.ts' 2>/dev/null || true); do
    basename=$(basename "$file" .ts)
    # Portable scan with grep (ERE). The CI runner's node:22 container has no ripgrep,
    # and `rg ... 2>/dev/null || true` would silently match nothing → every file flagged
    # as an orphan (587 false orphans broke the gate). grep is always present.
    pattern="from[[:space:]]+['\"][^'\"]*/$basename(\.js|\.ts)?['\"]|import[[:space:]]+[^'\"]*['\"][^'\"]*/$basename(\.js|\.ts)?['\"]|import[[:space:]]*\([[:space:]]*['\"][^'\"]*/$basename(\.js|\.ts)?['\"]"
    matches=$(
        grep -rlE "$pattern" src bin scripts test gui \
          --include="*.ts" \
          --include="*.tsx" \
          --include="*.js" \
          --include="*.mjs" \
          --exclude-dir=node_modules \
          --exclude-dir=dist \
          --exclude-dir=coverage \
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
