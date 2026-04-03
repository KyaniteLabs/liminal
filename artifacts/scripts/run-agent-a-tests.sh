#!/bin/bash

# Agent A Test Runner for remaining models and domains
# Work directory: /Users/simongonzalezdecruz/workspaces/liminal

set -e

WORK_DIR="/Users/simongonzalezdecruz/workspaces/liminal"
OUTPUT_DIR="$WORK_DIR/landing-live"
TELEMETRY_LOG="$WORK_DIR/dogfood-telemetry.log"

# Domains and prompts
declare -A DOMAINS
declare -A PROMPTS
DOMAINS=(
    ["p5"]="p5"
    ["glsl"]="glsl"
    ["three"]="three"
    ["strudel"]="strudel"
    ["hydra"]="hydra"
    ["tone"]="tone"
    ["html"]="html"
    ["ascii"]="ascii"
    ["remotion"]="remotion"
)
PROMPTS=(
    ["p5"]="Create a calming blue particle system with flowing movement"
    ["glsl"]="Create an abstract plasma shader with animated colors"
    ["three"]="Create a rotating 3D cube with interesting lighting"
    ["strudel"]="Create a simple techno beat pattern with drums"
    ["hydra"]="Create a geometric video synth pattern with kaleidoscope effect"
    ["tone"]="Create an ambient drone synthesizer with reverb"
    ["html"]="Create a landing page with hero section and call to action"
    ["ascii"]="Create ASCII art of a mountain landscape"
    ["remotion"]="Create a typing text animation video component"
)

# Model configurations
declare -A MODEL_NAMES
declare -A MODEL_BASE_URLS
declare -A MODEL_IDS
declare -A MODEL_API_KEYS

MODEL_NAMES=(
    ["minimax-m25"]="minimax-m25"
    ["lm-coder-40b"]="lm-coder-40b"
    ["lm-qwen-9b"]="lm-qwen-9b"
)
MODEL_BASE_URLS=(
    ["minimax-m25"]="https://api.minimax.io/v1"
    ["lm-coder-40b"]="http://localhost:1234/v1"
    ["lm-qwen-9b"]="http://localhost:1234/v1"
)
MODEL_IDS=(
    ["minimax-m25"]="MiniMax-M2.5"
    ["lm-coder-40b"]="qwen3-coder-next-reap-40b-a3b-i1"
    ["lm-qwen-9b"]="qwen3.5-9b"
)
MODEL_API_KEYS=(
    ["minimax-m25"]="$MINIMAX_API_KEY"
    ["lm-coder-40b"]=""
    ["lm-qwen-9b"]=""
)

# Function to run a single test
run_test() {
    local domain=$1
    local model=$2
    local prompt="${PROMPTS[$domain]}"
    local base_url="${MODEL_BASE_URLS[$model]}"
    local model_id="${MODEL_IDS[$model]}"
    local api_key="${MODEL_API_KEYS[$model]}"
    
    echo "=========================================="
    echo "Testing: Domain=$domain | Model=$model"
    echo "Prompt: $prompt"
    echo "=========================================="
    
    # Set environment variables
    export LIMINAL_LLM_BASE_URL="$base_url"
    export LIMINAL_LLM_MODEL="$model_id"
    if [ -n "$api_key" ]; then
        export LIMINAL_LLM_API_KEY="$api_key"
    fi
    
    # Clean up previous output
    rm -f "$OUTPUT_DIR/cli-project-final.html"
    rm -f "$OUTPUT_DIR/cli-project-final.js"
    
    # Run the test
    local start_time=$(date +%s%3N)
    local output
    local exit_code=0
    
    if output=$(node "$WORK_DIR/bin/liminal" --prompt "$prompt" --max-iterations 1 --output "$OUTPUT_DIR" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    # Extract quality score
    local score=$(echo "$output" | grep -oP 'Quality score: \K[0-9.]+' || echo "0")
    if [ -z "$score" ]; then
        score="0"
    fi
    
    # Determine status
    local status="❌"
    if (( $(echo "$score >= 0.5" | bc -l 2>/dev/null || echo "0") )); then
        status="✅"
    fi
    
    # Rename output files if they exist
    if [ -f "$OUTPUT_DIR/cli-project-final.html" ]; then
        mv "$OUTPUT_DIR/cli-project-final.html" "$OUTPUT_DIR/${domain}-${model}.html"
        echo "Renamed HTML to: ${domain}-${model}.html"
    fi
    if [ -f "$OUTPUT_DIR/cli-project-final.js" ]; then
        mv "$OUTPUT_DIR/cli-project-final.js" "$OUTPUT_DIR/${domain}-${model}.js"
        echo "Renamed JS to: ${domain}-${model}.js"
    fi
    
    # Log to telemetry
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_entry="[${timestamp}] Domain: ${domain} | Model: ${model} | Status: ${status} | Duration: ${duration}ms | Score: ${score}"
    echo "$log_entry" | tee -a "$TELEMETRY_LOG"
    
    echo "Output preview:"
    echo "$output" | tail -20
    echo ""
    
    return $exit_code
}

# Main execution
main() {
    cd "$WORK_DIR"
    
    # MiniMax-M2.5 remaining domains (p5 and glsl are done)
    MINIMAX_DOMAINS=("three" "strudel" "hydra" "tone" "html" "ascii" "remotion")
    
    # All domains for LM models
    ALL_DOMAINS=("p5" "glsl" "three" "strudel" "hydra" "tone" "html" "ascii" "remotion")
    
    echo "Starting Agent A tests..."
    echo "Telemetry log: $TELEMETRY_LOG"
    echo ""
    
    # Run MiniMax-M2.5 remaining tests
    echo "=== MiniMax-M2.5 Remaining Tests ==="
    for domain in "${MINIMAX_DOMAINS[@]}"; do
        run_test "$domain" "minimax-m25" || true
    done
    
    # Run LM-Coder-40b tests
    echo "=== LM-Coder-40b Tests ==="
    for domain in "${ALL_DOMAINS[@]}"; do
        run_test "$domain" "lm-coder-40b" || true
    done
    
    # Run LM-Qwen-9b tests
    echo "=== LM-Qwen-9b Tests ==="
    for domain in "${ALL_DOMAINS[@]}"; do
        run_test "$domain" "lm-qwen-9b" || true
    done
    
    echo "=== All tests completed ==="
    echo "Results logged to: $TELEMETRY_LOG"
}

main "$@"
