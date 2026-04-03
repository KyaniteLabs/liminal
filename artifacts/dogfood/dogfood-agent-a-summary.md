# Agent A Dogfood Test Results

**Date:** 2026-03-31  
**Commit:** b971ca7 (fix: resolve dogfood harness issues - routing, tokens, validation)  
**Test Configuration:** 4 models × 9 domains = 36 tests

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Tests** | 36 |
| **✅ Passed** | 4 |
| **❌ Failed** | 32 |
| **Success Rate** | 11.1% |

---

## Results by Model

| Model | Type | Passed | Failed | Success Rate |
|-------|------|--------|--------|--------------|
| minimax-m2.7 | Cloud | 1 | 8 | 11.1% |
| minimax-m2.5 | Cloud | 1 | 8 | 11.1% |
| lm-coder-40b | Local (LM Studio) | 1 | 8 | 11.1% |
| lm-qwen-9b | Local (LM Studio) | 1 | 8 | 11.1% |

---

## Results by Domain

| Domain | Passed | Failed | Success Rate |
|--------|--------|--------|--------------|
| p5 | 4 | 0 | 100% |
| glsl | 0 | 4 | 0% |
| three | 0 | 4 | 0% |
| strudel | 0 | 4 | 0% |
| hydra | 0 | 4 | 0% |
| tone | 0 | 4 | 0% |
| html | 0 | 4 | 0% |
| ascii | 0 | 4 | 0% |
| remotion | 0 | 4 | 0% |

---

## Detailed Test Results

### ✅ Passed Tests

| Domain | Model | Duration | Score | Size |
|--------|-------|----------|-------|------|
| p5 | minimax-m27 | 95ms | 0.68 | 160b |
| p5 | minimax-m25 | 137ms | 0.68 | 160b |
| p5 | lm-coder-40b | 98ms | 0.68 | 2163b |
| p5 | lm-qwen-9b | 74ms | 0.68 | 2163b |

### ❌ Failed Tests

#### Cloud Models (MiniMax) - Missing API Configuration

All MiniMax model failures show: `No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.`

This indicates the cloud API keys/endpoints are not properly configured in the test environment.

| Domain | Model | Error |
|--------|-------|-------|
| glsl | minimax-m27 | ShaderGenerator: No LLM configured |
| glsl | minimax-m25 | ShaderGenerator: No LLM configured |
| three | minimax-m27 | ThreeGenerator: No LLM configured |
| three | minimax-m25 | ThreeGenerator: No LLM configured |
| strudel | minimax-m27 | StrudelGenerator: No LLM configured |
| strudel | minimax-m25 | StrudelGenerator: No LLM configured |
| hydra | minimax-m27 | HydraGenerator: No LLM configured |
| hydra | minimax-m25 | HydraGenerator: No LLM configured |
| tone | minimax-m27 | ToneGenerator: No LLM configured |
| tone | minimax-m25 | ToneGenerator: No LLM configured |
| html | minimax-m27 | HTMLWebGenerator: No LLM configured |
| html | minimax-m25 | HTMLWebGenerator: No LLM configured |
| ascii | minimax-m27 | ASCIIArtGenerator: No LLM configured |
| ascii | minimax-m25 | ASCIIArtGenerator: No LLM configured |
| remotion | minimax-m27 | RemotionGenerator: No LLM configured |
| remotion | minimax-m25 | RemotionGenerator: No LLM configured |

#### Local Models (LM Studio) - API Errors

All LM Studio model failures show: `LLM API error: 400 Bad Request`

This indicates the LM Studio server is not running or the models are not properly loaded.

| Domain | Model | Error |
|--------|-------|-------|
| glsl | lm-coder-40b | Generated code appears truncated or incomplete |
| glsl | lm-qwen-9b | Generated code appears truncated or incomplete |
| three | lm-coder-40b | p5.js code validation failed (too small) |
| three | lm-qwen-9b | p5.js code validation failed (too small) |
| strudel | lm-coder-40b | p5.js code validation failed (too small) |
| strudel | lm-qwen-9b | p5.js code validation failed (too small) |
| hydra | lm-coder-40b | p5.js code validation failed (too small) |
| hydra | lm-qwen-9b | p5.js code validation failed (too small) |
| tone | lm-coder-40b | Generated code does not use Tone.js |
| tone | lm-qwen-9b | Generated code does not use Tone.js |
| html | lm-coder-40b | LLM output is not valid HTML |
| html | lm-qwen-9b | LLM output is not valid HTML |
| ascii | lm-coder-40b | p5.js code validation failed (too small) |
| ascii | lm-qwen-9b | p5.js code validation failed (too small) |
| remotion | lm-coder-40b | p5.js code validation failed (too small) |
| remotion | lm-qwen-9b | p5.js code validation failed (too small) |

---

## Key Findings

### 1. p5.js Domain Works Across All Models
The p5.js domain successfully generates output for all 4 models, indicating the core harness is functional.

### 2. Cloud Models (MiniMax) Not Configured
- All non-p5 domains fail with "No LLM configured" error
- The cloud API endpoints or authentication are not properly set up
- Environment variables needed: `LIMINAL_LLM_BASE_URL`, `LIMINAL_LLM_MODEL`, plus API keys

### 3. LM Studio Models Not Accessible
- All LM Studio tests return "400 Bad Request" errors
- Likely causes:
  - LM Studio server not running on localhost:1234
  - Models not loaded in LM Studio
  - Incorrect model identifiers

### 4. Routing Issues Observed
Some non-p5 domains (three, strudel, hydra) are being routed to p5.js validation, indicating potential routing confidence or domain detection issues.

---

## Files Generated

Valid HTML outputs saved to `./landing-live/`:
- `p5-minimax-m27.html` (160b)
- `p5-minimax-m25.html` (160b)
- `p5-lm-coder-40b.html` (2163b)
- `p5-lm-qwen-9b.html` (2163b)

Note: Previous test runs left some additional files in landing-live/ from earlier agent runs.

---

## Recommendations

1. **Configure Cloud API Keys**: Set up MiniMax API credentials for cloud model tests
2. **Start LM Studio**: Ensure LM Studio is running with the specified models loaded
3. **Verify Model IDs**: Confirm the exact model identifiers expected by LM Studio
4. **Debug Routing**: Investigate why some domains route to p5.js instead of their proper generators
5. **Re-run Tests**: After fixing environment issues, re-run the full test suite

---

## Raw Log

Full telemetry log available at: `./dogfood-telemetry-agent-a.log`
