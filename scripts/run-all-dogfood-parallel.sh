#!/bin/bash
# Run all dogfood tests in parallel across providers

echo "🚀 Starting Parallel Dogfood Testing"
echo "====================================="
echo ""

# Run all three in parallel background processes
echo "☁️ Starting Cloud providers..."
npx tsx scripts/dogfood-cloud.ts > dogfood-cloud.log 2>&1 &
CLOUD_PID=$!

echo "🖥️ Starting LM Studio..."
npx tsx scripts/dogfood-lmstudio.ts > dogfood-lmstudio.log 2>&1 &
LM_PID=$!

echo "🦙 Starting Ollama..."
npx tsx scripts/dogfood-ollama.ts > dogfood-ollama.log 2>&1 &
OLLAMA_PID=$!

echo ""
echo "PIDs: Cloud=$CLOUD_PID, LMStudio=$LM_PID, Ollama=$OLLAMA_PID"
echo ""

# Wait for all to complete
wait $CLOUD_PID
CLOUD_EXIT=$?
wait $LM_PID
LM_EXIT=$?
wait $OLLAMA_PID
OLLAMA_EXIT=$?

echo ""
echo "====================================="
echo "📊 PARALLEL DOGFOOD COMPLETE"
echo "====================================="
echo ""

# Check results
echo "Exit codes: Cloud=$CLOUD_EXIT, LMStudio=$LM_EXIT, Ollama=$OLLAMA_EXIT"
echo ""

# Show summaries
echo "☁️ Cloud Results:"
cat dogfood-cloud.log | tail -5

echo ""
echo "🖥️ LM Studio Results:"
cat dogfood-lmstudio.log | tail -5

echo ""
echo "🦙 Ollama Results:"
cat dogfood-ollama.log | tail -5

echo ""
echo "📁 Generated files:"
ls -1 landing-live/*.html | wc -l
echo "HTML files in landing-live/"
