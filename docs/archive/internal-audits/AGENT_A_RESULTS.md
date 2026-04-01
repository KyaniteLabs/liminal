# Agent A Test Results

**Models Tested:** MiniMax-M2.7, MiniMax-M2.5, LM-Coder-40b, LM-Qwen-9b
**Total Tests:** 36 (9 domains × 4 models)

## Results Summary

| Model | Passed | Failed | Pass Rate |
|-------|--------|--------|-----------|
| MiniMax-M2.7 | 2 | 7 | 22% |
| MiniMax-M2.5 | 1 | 8 | 11% |
| LM-Coder-40b | 2 | 7 | 22% |
| LM-Qwen-9b | 2 | 7 | 22% |
| **TOTAL** | **7** | **29** | **19%** |

## Passed Tests

| Domain | Model | Score | Output File |
|--------|-------|-------|-------------|
| p5 | MiniMax-M2.7 | 0.68 | p5-minimax-m27.html |
| glsl | MiniMax-M2.7 | 0.90 | glsl-minimax-m27.html |
| p5 | MiniMax-M2.5 | 0.68 | p5-minimax-m25.html |
| p5 | LM-Coder-40b | 0.68 | p5-lm-coder.html |
| glsl | LM-Coder-40b | 0.90 | glsl-lm-coder.html |
| p5 | LM-Qwen-9b | 0.68 | p5-lm-qwen.html |
| glsl | LM-Qwen-9b | 0.90 | glsl-lm-qwen.html |

## Best Outputs for Gallery

| Domain | Best Model | Score | File |
|--------|------------|-------|------|
| p5 | MiniMax-M2.7 / LM-Coder-40b / LM-Qwen-9b (tie) | 0.68 | p5-minimax-m27.html |
| glsl | MiniMax-M2.7 / LM-Coder-40b / LM-Qwen-9b (tie) | 0.90 | glsl-minimax-m27.html |

## Key Failures

1. **three.js** - All models fail p5.js validation (domain misclassification)
2. **strudel** - Routed to p5.js instead of strudel generator
3. **hydra** - Invalid regex error `/.sin(/: Unterminated group`
4. **tone** - Routed to p5.js validation
5. **html** - Timeout on local models (120s)
6. **ascii** - Code too small or empty
7. **remotion** - Low scores or validation failures

## Harness Issues Identified

1. **Domain routing broken** - three.js, strudel, tone prompts routed to p5.js
2. **Hydra regex bug** - `/.sin(/` pattern causes validation error
3. **HTML timeout** - Local models too slow for HTML generation
4. **MiniMax-M2.5 auth issues** - Some tests failed authentication

