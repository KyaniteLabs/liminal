#!/usr/bin/env bash
# serve-archaeology.sh — Build (if needed) and serve the archaeology Datasette
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB="$PROJECT_ROOT/narrative/data/archaeology.db"
METADATA="$SCRIPT_DIR/datasette-metadata.yaml"

# Build if DB doesn't exist
if [ ! -f "$DB" ]; then
    echo "Building archaeology database..."
    python3 "$SCRIPT_DIR/build-archaeology-db.py" --project-root "$PROJECT_ROOT" --verbose
fi

echo "Serving archaeology database at http://localhost:8001"
echo "  DB:       $DB"
echo "  Metadata: $METADATA"
echo ""

exec datasette "$DB" \
    -m "$METADATA" \
    --cors \
    --setting sql_time_limit_ms 5000 \
    --port 8001 \
    "$@"
