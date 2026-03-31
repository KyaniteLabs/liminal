#!/bin/bash
# Regenerate all failing examples through improved Liminal pipeline

cd /Users/simongonzalezdecruz/workspaces/liminal

OUTPUT_DIR="landing-assets/regenerated"
mkdir -p $OUTPUT_DIR

echo "=== REGENERATING FAILING EXAMPLES ==="
echo "Output: $OUTPUT_DIR"
echo ""

# Function to run generation
run_gen() {
  local name=$1
  local prompt="$2"
  local mode=$3
  
  echo ""
  echo "========================================"
  echo "Generating: $name"
  echo "Prompt: $prompt"
  echo "Mode: $mode"
  echo "========================================"
  
  node bin/liminal generate \
    -p "$prompt" \
    --mode=$mode \
    --output "$OUTPUT_DIR/$name" \
    --max-iterations 6 \
    --min-quality 0.70 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✓ $name: Success"
  else
    echo "✗ $name: Failed"
  fi
}

# GLSL Shaders
run_gen "shader-fractal" "GLSL raymarched fractal landscape with volumetric fog" "shader"
run_gen "shader-warp" "GLSL shader with warping noise patterns" "shader"
run_gen "shader-nebula" "GLSL shader cosmic nebula with stars" "shader"

# Three.js
run_gen "three-rotating" "Three.js rotating geometric shapes with dynamic lighting" "three"
run_gen "three-abstract" "Three.js abstract geometric sculpture with iridescent materials" "three"

# Hydra
run_gen "hydra-liquid" "liquid morphing shapes with feedback trails" "hydra"
run_gen "hydra-geometric" "geometric patterns with rotating grid" "hydra"

echo ""
echo "=== COMPLETE ==="
echo "Check $OUTPUT_DIR for results"
ls -la $OUTPUT_DIR/
