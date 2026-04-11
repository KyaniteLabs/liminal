# Dogfood Role Evaluation — Spec

**Date:** 2026-04-10
**Status:** Draft
**Scope:** Comprehensive tri-provider dogfood test with role-based model evaluation

---

## 1. Problem Statement

Evaluate which models perform best in which roles (Generator, Evaluator, Harness) across all 9 creative domains, using GLM-5.1 and MiniMax-M2.7 as harness candidates, Qwen 3.5 2B and Gemma 4B as generator candidates, and Qwen 3.5 2B-it as the evaluator.

---

## 2. Test Matrix

| Role | Provider | Model | Temperature | Timeout | Max Tokens |
|------|----------|-------|------------|---------|------------|
| **Generator A** | LM Studio (local) | `qwen3.5-2b` | 0.7 | 600,000ms | 32,768 |
| **Generator B** | LM Studio (local) | `gemma-4b` | 0.7 | 600,000ms | 32,768 |
| **Evaluator** | LM Studio (local) | `qwen3.5-2b-it` | 0.2 | 600,000ms | 32,768 |
| **Harness A** | Cloud | `glm-5.1` | 0.5 | 600,000ms | 32,768 |
| **Harness B** | Cloud | `MiniMax-M2.7` | 0.5 | 600,000ms | 32,768 |

**Domains:** p5, glsl, three, revideo, strudel, hydra, tone, html, ascii

**Total runs:** 9 domains × 2 generators × 2 harnesses = **36 runs**

---

## 3. Configuration — No Limits

All settings are maximized to give every model the best chance:

- **Timeout:** 600,000ms (10 minutes) per LLM call — prevents premature timeouts on slow local models
- **Max Tokens:** 32,768 — accommodates large Three.js/HTML generator outputs
- **Context Window:** 200,000 tokens — effectively unlimited for these generator prompts
- **No rate limiting between runs** — sequential execution to avoid contention
- **All providers use OpenAI-compatible API** (`/v1/chat/completions`)

### LM Studio Constraints

- Only queries `localhost:1234` — no remote LM Studio instances
- No Ollama, no MiniMax for generation (only as harness)
- Auto-detects available models from `GET /v1/models`
- Filters for `qwen` or `gemma` in model name
- Gracefully skips if a required model is not available

---

## 4. Architecture

### Direct LLMClient Pattern (bypasses RalphLoop)

Each test run creates three dedicated LLMClient instances:

```typescript
const harnessLLM = new LLMClient({ role: 'harness',  baseUrl, model, apiKey, timeout: 600_000, maxTokens: 32_768 });
const generatorLLM = new LLMClient({ role: 'generator', baseUrl: 'http://localhost:1234/v1', model, timeout: 600_000, maxTokens: 32_768 });
const evaluatorLLM = new LLMClient({ role: 'evaluator', baseUrl: 'http://localhost:1234/v1', model: 'qwen3.5-2b-it', timeout: 600_000, maxTokens: 32_768 });
```

### Harness Role (GLM-5.1 / MiniMax-M2.7)

The harness is a **lightweight orchestrator** (not the full RalphLoop) responsible for:
1. Receiving the domain prompt
2. Calling the Generator (local LM Studio) to produce code
3. Calling the Evaluator (local LM Studio) to score the output
4. Returning the best result (no iteration — single pass for dogfood comparison)

**Implementation:** The harness uses a **system prompt** that instructs it to call the Generator, then the Evaluator, then return the final code with a score. This is a single-pass pipeline so we can fairly compare harness quality without iteration confounds.

### Generator Role

- **Qwen 3.5 2B:** Fast, good quality for small local model
- **Gemma 4B:** Larger, potentially better code quality
- Both use `temperature: 0.7` (creative, as intended)

### Evaluator Role

- **Qwen 3.5 2B-it** (instruction-tuned) — best practice for evaluation tasks (April 2026)
- Uses `temperature: 0.2` (precise, consistent scoring)
- Evaluates generated code for: correctness, creativity, domain relevance

---

## 5. Generators Tested

All generators from `registerGenerators.ts`:

| Domain | Generator | Prompt Seed |
|--------|-----------|------------|
| p5 | `P5GeneratorV2` | "Create a calming blue particle system with flowing movement" |
| glsl | `ShaderGenerator` | "Create an abstract plasma shader with animated colors" |
| three | `ThreeGenerator` | "Create a rotating 3D cube with interesting lighting" |
| revideo | `RemotionGenerator` | "Create a typing text animation video component" |
| strudel | `StrudelGenerator` | "Create a simple techno beat pattern with drums" |
| hydra | `HydraGenerator` | "Create a geometric video synth pattern with kaleidoscope effect" |
| tone | `ToneGenerator` | "Create an ambient drone synthesizer with reverb" |
| html | `HTMLWebGenerator` | "Create a landing page with hero section and call to action" |
| ascii | `ASCIIArtGenerator` | "Create ASCII art of a mountain landscape" |

---

## 6. Telemetry Captured

### Per-Run Data

For every test run, capture:

1. **Request trace** (`traces/`): `{ callId, model, provider, baseUrl, promptLengths, temperature, maxTokens, duration }`
2. **Response capture** (`responses/`): `{ success, code, thinking, reasoning, recoveredFromThinking, duration, error? }`
3. **Reasoning trace** (`reasoning/`): Markdown with prompt + thinking/reasoning + generated code
4. **Scores** (`scores/`): `{ harnessScore, evaluatorScore, domain, generator, harness, iterations }`

### Telemetry Directories

```
dogfood-telemetry/
  traces/          # Raw request/response JSON
  responses/       # Full response captures
  reasoning/      # Markdown reasoning traces
  scores/         # Per-run scores
  summaries/      # Aggregated summaries
```

### Output Files

```
landing-live/
  dogfood-role-eval-{harness}-{generator}-{domain}.html  # Generated code outputs

dogfood-report-role-eval.json   # Full structured report
dogfood-report-role-eval.md     # Human-readable summary
```

---

## 7. Report Structure

### JSON Report

```json
{
  "timestamp": "ISO8601",
  "matrix": {
    "total": 36,
    "generators": ["qwen3.5-2b", "gemma-4b"],
    "harnesses": ["glm-5.1", "MiniMax-M2.7"],
    "domains": ["p5", "glsl", ...]
  },
  "summary": {
    "byHarness": { "glm-5.1": { success, avgScore, avgDuration }, "MiniMax-M2.7": {...} },
    "byGenerator": { "qwen3.5-2b": {...}, "gemma-4b": {...} },
    "byDomain": { "p5": {...}, ... },
    "harnessWinner": "glm-5.1 | MiniMax-M2.7 | tie",
    "generatorWinner": "qwen3.5-2b | gemma-4b | tie"
  },
  "runs": [ ... each run's full data ... ]
}
```

### Markdown Summary

- Matrix table: success rate per (harness × generator × domain)
- Winner analysis per role
- Notable failures with error breakdown
- Reasoning trace highlights

---

## 8. Script Location

`scripts/dogfood-role-eval.ts`

- ESM module, `#!/usr/bin/env node` shebang
- Imports compiled `dist/` files (not TS sources)
- Parallel execution: each harness × generator combination runs all 9 domains in parallel
- Sequential across combinations to avoid LM Studio contention

---

## 9. Graceful Degradation

If a model is not available:
- Log a warning and skip that configuration
- Continue with available models
- Report which configurations were skipped and why

---

## 10. Implementation Steps

1. Create `scripts/dogfood-role-eval.ts`
2. Implement model auto-detection from LM Studio
3. Wire three LLMClient instances per test run
4. Implement harness orchestration logic (Generator → Evaluator → decision)
5. Add rich telemetry (traces, responses, reasoning, scores)
6. Add structured report generation (JSON + Markdown)
7. Test with one domain first (p5 × qwen3.5-2b × glm-5.1)
8. Run full matrix

---

## 11. Related Prior Work

- `scripts/dogfood-glm.ts` — single-provider, direct generation (no harness)
- `scripts/dogfood-lmstudio.ts` — local only, direct generation
- `scripts/dogfood-all-providers-telemetry.ts` — all providers, direct generation, rich telemetry
- Branch `tri-provider-dogfood` — prior attempt (may be stale)
