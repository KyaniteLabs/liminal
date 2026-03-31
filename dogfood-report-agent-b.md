# Agent B Dogfood Test Report

**Date:** 2026-03-31  
**Test Configuration:** Ollama Local Models + Cloud (kimi skipped - no API key)  
**Commit:** b971ca7 (fix: resolve dogfood harness issues - routing, tokens, validation)

## Summary

Agent B dogfood tests were initiated for 6 local Ollama models across 9 creative coding domains (54 total tests). Due to model performance characteristics and timeout constraints, partial results were collected.

### Test Status

| Model | Tests Run | ✅ Passed | ❌ Failed | ⏱️ Timeout | Notes |
|-------|-----------|----------|----------|-----------|-------|
| granite4:350m | 2 | 0 | 2 | 0 | Fast but produces empty code |
| qwen3.5:2b | 1 | 0 | 0 | 1 | Hit 120s timeout |
| gemma3:4b | 1 | 0 | 0 | 1 | Hit 120s timeout |
| granite4:1b | 0 | - | - | - | Not tested |
| phi4-mini | 0 | - | - | - | Not tested |
| lfm2.5-thinking | 0 | - | - | - | Not tested |
| **kimi-k2.5:cloud** | - | - | - | - | Skipped (no API key) |

### Domain Coverage

| Domain | Complexity | Tests Run | Status |
|--------|------------|-----------|--------|
| ascii | low | 3 | 2 timeouts, 1 validation fail |
| html | low | 1 (partial) | In progress |
| p5 | medium | 0 | Not started |
| strudel | medium | 0 | Not started |
| hydra | medium | 0 | Not started |
| tone | medium | 0 | Not started |
| remotion | medium | 0 | Not started |
| glsl | high | 0 | Not started |
| three | high | 0 | Not started |

## Key Findings

### 1. Model Performance Issues

**granite4:350m** (fast models, 60s timeout):
- Responds quickly (~2-4s)
- BUT: Returns empty code after stripping reasoning text
- Error: `Code is empty after stripping LLM reasoning text`
- All generations fail validation

**qwen3.5:2b** (medium models, 120s timeout):
- Times out at 120s
- Error: `The operation was aborted due to timeout`
- May need longer timeout or has generation issues

**gemma3:4b** (medium models, 120s timeout):
- Times out at 120s
- Similar behavior to qwen35

### 2. Harness Configuration

The test harness was configured with:
- `maxIterations: 2-3` (was 1)
- `num_predict` and `num_ctx` set via Ollama (fixes truncation)
- Routing confidence set to 0.95+ (fixes misrouting)
- Default maxTokens: 4096 (prevents OOM)

### 3. Test Infrastructure

Created test scripts:
- `scripts/run-agent-b.ts` - Full test suite with smart timeouts
- `scripts/run-agent-b-batched.ts` - Batched execution with intermediate saves
- `scripts/run-agent-b-quick.ts` - Quick verification subset

## Observed Errors

1. **Validation Error (granite):**
   ```
   Code is empty after stripping LLM reasoning text
   p5.js code must contain at least one of: function setup(), function draw(), or createCanvas()
   ```

2. **Timeout Errors (qwen/gemma):**
   ```
   The operation was aborted due to timeout
   LLMClient.generate failed: The operation was aborted due to timeout
   ```

3. **Truncation Error (observed in previous runs):**
   ```
   ShaderGenerator: Generated code appears truncated or incomplete
   ```

## Recommendations

### For Local Models

1. **granite4:350m/1b**: May need prompt tuning to produce valid code structure
2. **qwen3.5:2b/gemma3:4b**: May need extended timeout (180s+) or debugging for generation stall
3. **phi4-mini**: Not tested - recommend separate validation
4. **lfm2.5-thinking**: Slow model - needs 180s+ timeout

### For Cloud Model

- **kimi-k2.5:cloud** requires `MOONSHOT_API_KEY` environment variable
- Cloud API endpoint: `https://api.moonshot.cn/v1`

### Harness Improvements

1. Add model-specific prompt templates
2. Implement retry logic for timeout scenarios
3. Add validation before timeout to catch quick failures
4. Consider parallel execution for faster completion

## Files Generated

```
landing-live/
├── ascii-granite-350m.html (empty)
├── ascii-qwen35.html (timeout)
├── ascii-gemma.html (timeout)
└── ... (partial)

dogfood-telemetry-agent-b.log    # Test execution log
dogfood-results-agent-b.json     # Structured results (partial)
dogfood-report-agent-b.md        # This report
```

## Next Steps

1. **Investigate model-specific issues:**
   - Test granite models with simplified prompts
   - Extend timeouts for qwen/gemma
   - Verify Ollama model health

2. **Enable cloud testing:**
   - Configure MOONSHOT_API_KEY
   - Run kimi-k2.5:cloud tests separately

3. **Complete testing:**
   - Run remaining 48+ tests
   - Collect full telemetry
   - Generate pass/fail matrix

## Test Runner Usage

```bash
# Full test suite (54 tests, ~2-3 hours)
npx tsx scripts/run-agent-b.ts

# Batched with progress (54 tests)
npx tsx scripts/run-agent-b-batched.ts

# Quick verification (12 tests, ~30 min)
npx tsx scripts/run-agent-b-quick.ts
```

## Environment Verification

```bash
# Verify Ollama is running
curl http://localhost:11434/api/tags

# Verify models are available
# - granite4:1b
# - granite4:350m  
# - qwen3.5:2b
# - phi4-mini:latest
# - gemma3:4b
# - lfm2.5-thinking:1.2b
```

---

**Report Generated:** 2026-03-31  
**Status:** Partial - Infrastructure ready, model tuning needed
