#!/bin/bash
# Check for orphaned source files (not imported anywhere in src/)

orphans=0
for file in $(find src -name '*.ts' -not -name 'index.ts' -not -name '*.d.ts' 2>/dev/null || true); do
    basename=$(basename "$file" .ts)
    imports=$(grep -rE "from\s+.*/$basename|from\s+$basename|import\s+.*/$basename|import\s+$basename" src/ --include="*.ts" | grep -v "$file" | wc -l || true)
    if [ "$imports" -eq 0 ]; then
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
