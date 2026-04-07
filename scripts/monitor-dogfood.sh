#!/bin/bash
# Monitor dogfood progress and update every 2 minutes

LOG_FILE="dogfood-progress.log"
TELEMETRY_DIR="dogfood-telemetry"
LANDING_DIR="landing-live"

echo "=== DOGFOOD MONITOR STARTED ===" > $LOG_FILE
echo "Time: $(date)" >> $LOG_FILE
echo "" >> $LOG_FILE

while true; do
    echo "--- UPDATE: $(date '+%H:%M:%S') ---" >> $LOG_FILE
    
    # Count files
    HTML_COUNT=$(ls $LANDING_DIR/*.html 2>/dev/null | wc -l)
    TELEMETRY_COUNT=$(find $TELEMETRY_DIR -type f 2>/dev/null | wc -l)
    REASONING_COUNT=$(ls $TELEMETRY_DIR/reasoning/*.md 2>/dev/null | wc -l)
    
    echo "HTML files: $HTML_COUNT" >> $LOG_FILE
    echo "Telemetry files: $TELEMETRY_COUNT" >> $LOG_FILE
    echo "Reasoning traces: $REASONING_COUNT" >> $LOG_FILE
    
    # Count by provider
    echo "" >> $LOG_FILE
    echo "By Provider:" >> $LOG_FILE
    ls $LANDING_DIR/*.html 2>/dev/null | grep -oE '(cloud|lmstudio|ollama)' | sort | uniq -c | sort -rn >> $LOG_FILE
    
    echo "" >> $LOG_FILE
    
    # Show to console
    echo "$(date '+%H:%M:%S') - HTML: $HTML_COUNT | Telemetry: $TELEMETRY_COUNT | Reasoning: $REASONING_COUNT"
    
    sleep 120
done
