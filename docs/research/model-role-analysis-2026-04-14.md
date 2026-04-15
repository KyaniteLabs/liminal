# DF1 Model Role Analysis: Local, OpenRouter Free, GPT-5.4 Mini/Nano, and GLM 4.5 Air

Date: 2026-04-14
Scope: Recovery and comparison artifact for evaluator/generator model selection after DF1 and OpenRouter free-model bakeoffs.

## Executive summary

The strongest current practical policy from the evidence we have is:

```text
Default evaluator:
  lmstudio/qwen3.5-2b

Default generator:
  glm-4.5-air

Best free OpenRouter backup generator:
  openrouter/elephant-alpha

Best OpenRouter free evaluator candidates:
  openrouter/elephant-alpha
  liquid/lfm-2.5-1.2b-instruct:free
  nvidia/nemotron-3-nano-30b-a3b:free

Avoid as broad/default generator:
  gpt-5.4-nano
```

The main update versus the earlier OpenRouter-only analysis is that **GLM 4.5 Air has the strongest observed DF1 generator evidence**. It produced a full `7/7` DF1 pass with `6/7` launch-ready domains in the run `df1-2026-04-14T15-40-34-437Z`.

---

## Source artifacts

### OpenRouter free-model artifacts

- `.omx/logs/openrouter-free-models.json`
- `.omx/logs/openrouter-free-models-refresh.json`
- `.omx/logs/run_openrouter_free_roles.ts`
- `.omx/logs/openrouter-free-roles/latest.json`
- `.omx/logs/openrouter-free-roles/fast_generator_probe.mjs`
- `.omx/logs/openrouter-free-roles/fast-generator-probe.json`
- `.omx/logs/openrouter-free-roles/rerun_relaxed_probe.mjs`
- `.omx/logs/openrouter-free-roles/relaxed-probe.json`
- `.omx/logs/openrouter-free-roles/rerun_relaxed_probe_fast.mjs`
- `.omx/logs/openrouter-free-roles/relaxed-probe-fast.json`

Primary OpenRouter result:

```text
.omx/logs/openrouter-free-roles/relaxed-probe-fast.json
```

This was the latest completed OpenRouter free-model bakeoff after guardrails were relaxed.

### Local/LM Studio bakeoff artifacts

- `.omx/logs/evaluator-bakeoff/latest-v2.json`
- `.omx/logs/evaluator-bakeoff/latest-consistency.json`
- `.omx/logs/generator-bakeoff/latest.json`
- `.omx/logs/generator-bakeoff/latest-actual-remote.json`

### DF1 model comparison artifacts

Key DF1 run artifacts under:

```text
.worktrees/df1-app-dogfood/.omx/logs/df1-runs/
```

Important runs:

- `df1-2026-04-14T13-55-14-173Z` — GPT-5.4-mini generator + GPT-5.4-nano evaluator.
- `df1-2026-04-14T13-58-25-676Z` — GPT-5.4-nano generator + GPT-5.4-nano evaluator.
- `df1-2026-04-14T14-32-14-432Z` — GPT-5.4-mini generator + qwen3.5-2b evaluator.
- `df1-2026-04-14T15-40-34-437Z` — GLM 4.5 Air generator + qwen3.5-2b evaluator.
- `df1-2026-04-14T16-08-27-412Z` — GLM 4.5 Air focused Strudel/Tone follow-up.
- `df1-2026-04-14T16-10-14-794Z` — GPT-5.4-nano generator + qwen3.5-2b evaluator.

---

## OpenRouter free-model bakeoff

### Inventory

The refreshed OpenRouter free-model inventory had 28 models:

- `arcee-ai/trinity-large-preview:free`
- `cognitivecomputations/dolphin-mistral-24b-venice-edition:free`
- `google/gemma-3-12b-it:free`
- `google/gemma-3-27b-it:free`
- `google/gemma-3-4b-it:free`
- `google/gemma-3n-e2b-it:free`
- `google/gemma-3n-e4b-it:free`
- `google/gemma-4-26b-a4b-it:free`
- `google/gemma-4-31b-it:free`
- `google/lyria-3-clip-preview`
- `google/lyria-3-pro-preview`
- `liquid/lfm-2.5-1.2b-instruct:free`
- `liquid/lfm-2.5-1.2b-thinking:free`
- `meta-llama/llama-3.2-3b-instruct:free`
- `meta-llama/llama-3.3-70b-instruct:free`
- `minimax/minimax-m2.5:free`
- `nousresearch/hermes-3-llama-3.1-405b:free`
- `nvidia/nemotron-3-nano-30b-a3b:free`
- `nvidia/nemotron-3-super-120b-a12b:free`
- `nvidia/nemotron-nano-12b-v2-vl:free`
- `nvidia/nemotron-nano-9b-v2:free`
- `openai/gpt-oss-120b:free`
- `openai/gpt-oss-20b:free`
- `openrouter/elephant-alpha`
- `openrouter/free`
- `qwen/qwen3-coder:free`
- `qwen/qwen3-next-80b-a3b-instruct:free`
- `z-ai/glm-4.5-air:free`

### Best OpenRouter free evaluator candidates

Models with perfect toy-evaluator accuracy, parse success, and zero false positives in `relaxed-probe-fast.json`:

| Model | Toy accuracy | False positives | Approx latency |
| --- | ---: | ---: | ---: |
| `openrouter/elephant-alpha` | `1.0` | `0` | `0.85s` |
| `liquid/lfm-2.5-1.2b-instruct:free` | `1.0` | `0` | `0.89s` |
| `nvidia/nemotron-3-nano-30b-a3b:free` | `1.0` | `0` | `1.79s` |
| `openai/gpt-oss-20b:free` | `1.0` | `0` | `2.57s` |
| `openrouter/free` | `1.0` | `0` | `3.12s` |
| `openai/gpt-oss-120b:free` | `1.0` | `0` | `3.15s` |
| `nvidia/nemotron-3-super-120b-a12b:free` | `1.0` | `0` | `9.87s` |

Caveat: this was a small toy evaluator suite, not full DF1 evaluator parity.

### Best OpenRouter free generator candidates

| Model | Valid domains | Pass rate | Notes |
| --- | --- | ---: | --- |
| `openrouter/elephant-alpha` | p5, tone, ascii, glsl, three, strudel, hydra | `7/8` | Best OpenRouter free generator candidate; missed HTML. |
| `nvidia/nemotron-3-nano-30b-a3b:free` | p5, html, tone, glsl, three | `5/8` | Strong visual/code candidate. |
| `liquid/lfm-2.5-1.2b-thinking:free` | html, tone, glsl, three | `4/8` | Useful generator; evaluator JSON failed. |
| `liquid/lfm-2.5-1.2b-instruct:free` | p5, html, ascii, glsl | `4/8` | Fast utility candidate; also strong evaluator candidate. |
| `openrouter/free` | p5, html | `2/3` partial | Promising but non-deterministic router. |
| `openai/gpt-oss-20b:free` | p5 | `1/2` partial | Useful if endpoint available. |

### Domain winners in OpenRouter free run

- **p5**: `nvidia/nemotron-3-nano-30b-a3b:free`, `openai/gpt-oss-20b:free`, `openrouter/elephant-alpha`, `openrouter/free`.
- **html**: `nvidia/nemotron-3-nano-30b-a3b:free`, `liquid/lfm-2.5-1.2b-thinking:free`, `liquid/lfm-2.5-1.2b-instruct:free`, `openrouter/free`.
- **tone**: `nvidia/nemotron-3-nano-30b-a3b:free`, `openrouter/elephant-alpha`, `liquid/lfm-2.5-1.2b-thinking:free`.
- **ascii**: `openrouter/elephant-alpha`, `liquid/lfm-2.5-1.2b-instruct:free`.
- **glsl**: `openrouter/elephant-alpha`, `nvidia/nemotron-3-nano-30b-a3b:free`, `liquid/lfm-2.5-1.2b-instruct:free`, `liquid/lfm-2.5-1.2b-thinking:free`.
- **three**: `openrouter/elephant-alpha`, `nvidia/nemotron-3-nano-30b-a3b:free`, `liquid/lfm-2.5-1.2b-thinking:free`.
- **strudel**: only `openrouter/elephant-alpha` passed in latest OpenRouter run.
- **hydra**: only `openrouter/elephant-alpha` passed in latest OpenRouter run.

### OpenRouter operational reliability

Latest OpenRouter free error profile from `relaxed-probe-fast.json`:

Evaluator rows:

- ok: `7`
- timeout: `3`
- upstream 429: `6`
- provider 400: `9`
- parse/no-json: `2`
- provider 401: `1`

Generator rows:

- valid: `23`
- invalid shape: `13`
- timeout: `60`
- upstream 429: `48`
- provider 400: `72`
- provider 401: `8`

Interpretation:

- OpenRouter free contains useful candidates, but endpoint availability is noisy.
- Many `:free` models are not actually usable for this code/chat path at a given moment.
- `openrouter/free` is non-deterministic, so it should not be treated as a stable model.
- `openrouter/elephant-alpha` and `nvidia/nemotron-3-nano-30b-a3b:free` are the best practical OpenRouter generator candidates.

---

## Local / LM Studio baseline

### Evaluator baseline

From `.omx/logs/evaluator-bakeoff/latest-v2.json` and `.omx/logs/evaluator-bakeoff/latest-consistency.json`:

| Model | Evidence | Verdict |
| --- | --- | --- |
| `qwen3.5-2b` | `7/8` validity + `3/3` ranking; `12/12` consistency | Best default evaluator. |
| `qwen3-coder-next-reap-40b-a3b-i1` | `12/12` consistency | Strong fallback evaluator; heavier. |
| `qwen3.5-4b` | `7/8` validity + `3/3` ranking; `9/12` consistency | Fast alternate; less consistent. |
| `qwen3.5-9b` | `9/12` consistency; slow | Not worth defaulting to. |

Default evaluator remains:

```text
lmstudio/qwen3.5-2b
```

Fallback evaluator:

```text
lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

### Local generator baseline

From `.omx/logs/generator-bakeoff/latest.json`:

| Model | Pass rate | Valid domains | Verdict |
| --- | ---: | --- | --- |
| `qwen3-coder-next-reap-40b-a3b-i1` | `5/8` | p5, html, three, strudel, hydra | Best local synthetic generator; slower. |
| `qwen3.5-0.8b` | `4/8` | p5, html, three, tone | Surprisingly useful cheap probe. |
| `qwen3.5-2b` | `4/8` | p5, three, tone, strudel | Useful but uneven. |
| `qwen3.5-4b` | `4/8` | p5, html, three, strudel | Useful but not clearly superior. |
| `qwen3.5-9b` | `2/8` | p5, strudel | Too slow for the value shown. |
| `lfm2.5-1.2b-instruct` | `2/8` | p5, html | Fast but weak as broad generator. |

---

## GPT-5.4 Mini / GPT-5.4 Nano / GLM 4.5 Air as generators

## Summary table

| Model as generator | Best evidence | Pass rate | Launch-ready / quality notes | Verdict |
| --- | --- | ---: | --- | --- |
| `glm-4.5-air` | `df1-2026-04-14T15-40-34-437Z` | `7/7` | 6/7 launch-ready; only Strudel quality warning | Best current generator candidate. |
| `gpt-5.4-mini` | `df1-2026-04-14T14-32-14-432Z` | `5/7` | Strong GLSL/Three/ASCII; failed p5 and Tone | Useful paid fallback, not default. |
| `gpt-5.4-mini` + nano evaluator | `df1-2026-04-14T13-55-14-173Z` | `6/7` | Only GLSL/ASCII launch-ready; many quality warnings | Static pass count overstates quality. |
| `gpt-5.4-nano` | `df1-2026-04-14T16-10-14-794Z` | `4/7` | Passed Three/Strudel/Tone/ASCII; failed p5/GLSL/Kinetic | Useful narrow/cheap probe, not broad default. |
| `gpt-5.4-nano` + nano evaluator | `df1-2026-04-14T13-58-25-676Z` | `3/7` | Only ASCII launch-ready; p5/GLSL/Three/Tone had serious failures | Weak as broad generator. |

---

## GLM 4.5 Air generator evidence

Primary run:

```text
.worktrees/df1-app-dogfood/.omx/logs/df1-runs/df1-2026-04-14T15-40-34-437Z
```

Config:

```text
Generator:
  provider: glm
  baseUrl: https://api.z.ai/api/anthropic
  model: glm-4.5-air

Harness:
  provider/model: kimi-for-coding

Evaluator:
  lmstudio/qwen3.5-2b

Fallback evaluator:
  lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

Results:

| Domain | Static | Runtime | Eval | Quality | Launch | Duration |
| --- | --- | --- | ---: | --- | --- | ---: |
| p5 | PASS | PASS | `0.90` | PASS | YES | `10.5s` |
| glsl | PASS | PASS | `0.90` | PASS | YES | `13.3s` |
| three | PASS | PASS | `0.90` | PASS | YES | `11.9s` |
| strudel | PASS | SKIP | `0.70` | WARN | NO | `11.9s` |
| tone | PASS | SKIP | `0.90` | PASS | YES | `6.0s` |
| kinetic | PASS | PASS | `0.90` | PASS | YES | `69.1s` |
| ascii | PASS | SKIP | `0.95` | PASS | YES | `15.9s` |

Summary:

```text
Pass rate: 7/7
Launch-ready: 6/7
```

Focused follow-up run:

```text
df1-2026-04-14T16-08-27-412Z
```

| Domain | Result | Eval | Launch |
| --- | --- | ---: | --- |
| strudel | PASS | `0.70` | NO / quality warning |
| tone | PASS | `0.95` | YES |

Conclusion:

```text
GLM 4.5 Air is the best observed DF1 generator candidate.
```

It passed all domains and only had a Strudel quality warning. It should be promoted from “interesting cheap model” to “primary generator candidate to beat.”

---

## GPT-5.4 Mini generator evidence

### Run A: GPT-5.4-mini generator + GPT-5.4-nano evaluator

Artifact:

```text
df1-2026-04-14T13-55-14-173Z
```

Config:

```text
Generator:
  openai/gpt-5.4-mini

Evaluator:
  openai/gpt-5.4-nano
```

Results:

| Domain | Result | Runtime | Eval | Quality | Launch | Error |
| --- | --- | --- | ---: | --- | --- | --- |
| p5 | FAIL | FAIL | `0.18` | WARN | NO | undeclared `constrain`, `createGraphics` |
| glsl | PASS | PASS | `0.92` | PASS | YES | |
| three | PASS | PASS | `0.74` | WARN | NO | |
| strudel | PASS | SKIP | `0.46` | WARN | NO | |
| tone | PASS | SKIP | `0.62` | WARN | NO | |
| kinetic | PASS | PASS | `0.62` | WARN | NO | |
| ascii | PASS | SKIP | `0.86` | PASS | YES | |

Summary:

```text
Static/pass rate: 6/7
Launch-ready: 2/7
```

### Run B: GPT-5.4-mini generator + qwen3.5-2b evaluator

Artifact:

```text
df1-2026-04-14T14-32-14-432Z
```

Config:

```text
Generator:
  openai/gpt-5.4-mini

Evaluator:
  lmstudio/qwen3.5-2b

Fallback evaluator:
  lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

Results:

| Domain | Result | Runtime | Eval | Quality | Launch | Error |
| --- | --- | --- | ---: | --- | --- | --- |
| p5 | FAIL | FAIL | `0.75` | PASS | NO | undeclared `constrain` |
| glsl | PASS | PASS | `0.80` | PASS | YES | |
| three | PASS | PASS | `0.90` | PASS | YES | |
| strudel | PASS | SKIP | `0.85` | PASS | YES | |
| tone | FAIL | SKIP | `0.95` | PASS | NO | Tone object/import issue; invalid `.filter` usage |
| kinetic | PASS | PASS | `0.70` | WARN | NO | |
| ascii | PASS | SKIP | `0.95` | PASS | YES | |

Summary:

```text
Pass rate: 5/7
Launch-ready: 4/7
```

Conclusion:

GPT-5.4-mini is useful, but not the best default generator. It is good for GLSL, Three, Strudel, and ASCII, but it produced p5 undeclared identifiers and Tone API/import problems.

Recommendation:

```text
Use GPT-5.4-mini as a paid fallback generator or comparison model.
Do not make it the default DF1 generator while GLM 4.5 Air has stronger evidence.
```

---

## GPT-5.4 Nano generator evidence

### Run A: GPT-5.4-nano generator + GPT-5.4-nano evaluator

Artifact:

```text
df1-2026-04-14T13-58-25-676Z
```

Config:

```text
Generator:
  openai/gpt-5.4-nano

Evaluator:
  openai/gpt-5.4-nano
```

Results:

| Domain | Result | Runtime | Eval | Quality | Launch | Error |
| --- | --- | --- | ---: | --- | --- | --- |
| p5 | FAIL | FAIL | `0.12` | WARN | NO | undeclared `MULTIPLY`, `constrain`, `createGraphics`, `exp` |
| glsl | FAIL | FAIL | `0.22` | WARN | NO | undefined `rot()`, `falloff()` |
| three | FAIL | FAIL | `0.12` | WARN | NO | document write invalid token |
| strudel | PASS | SKIP | `0.22` | WARN | NO | |
| tone | FAIL | SKIP | `0.18` | WARN | NO | Tone object/import + invalid `.filter` |
| kinetic | PASS | PASS | `0.52` | WARN | NO | |
| ascii | PASS | SKIP | `0.82` | PASS | YES | |

Summary:

```text
Pass rate: 3/7
Launch-ready: 1/7
```

### Run B: GPT-5.4-nano generator + qwen3.5-2b evaluator

Artifact:

```text
df1-2026-04-14T16-10-14-794Z
```

Config:

```text
Generator:
  openai/gpt-5.4-nano

Harness:
  kimi-for-coding

Evaluator:
  lmstudio/qwen3.5-2b

Fallback evaluator:
  lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

Results:

| Domain | Result | Runtime | Eval | Quality | Launch | Error |
| --- | --- | --- | ---: | --- | --- | --- |
| p5 | FAIL | FAIL | `0.70` | WARN | NO | undeclared `key` |
| glsl | FAIL | FAIL | `0.70` | WARN | NO | undefined `rot()` |
| three | PASS | PASS | `0.95` | PASS | YES | |
| strudel | PASS | SKIP | `0.80` | PASS | YES | |
| tone | PASS | SKIP | `0.82` | PASS | YES | |
| kinetic | FAIL | FAIL | — | UNKNOWN | NO | generation timeout |
| ascii | PASS | SKIP | `0.95` | PASS | YES | |

Summary:

```text
Pass rate: 4/7
Launch-ready: 4/7
```

Conclusion:

GPT-5.4-nano is not a broad generator default. It is useful for narrow/cheap probes, especially Three, Strudel, Tone, and ASCII, but it struggled with p5, GLSL, and Kinetic.

Recommendation:

```text
Use GPT-5.4-nano as a cheap evaluator/cross-check or narrow generator for simple domains.
Do not use it as the default generator for DF1/DF2.
```

---

## Evaluator role update

## qwen3.5-2b remains default evaluator

This remains the strongest evaluator recommendation.

Reasons:

- Best local consistency baseline.
- Cheap and local.
- Avoids OpenRouter free endpoint instability.
- Worked well in the best GLM generator run.

```text
Default evaluator: lmstudio/qwen3.5-2b
Fallback evaluator: lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

## GPT-5.4 Nano as evaluator

GPT-5.4-nano has more evaluator-role evidence than GPT-5.4-mini.

Observed behavior:

- It scored obviously broken outputs low:
  - GPT-nano p5: `0.12`
  - GPT-nano GLSL: `0.22`
  - GPT-nano Three runtime failure: `0.12`
  - invalid Tone examples: `0.12–0.18`
- It was conservative on pass-but-not-launch-ready outputs:
  - GPT-mini Three: `0.74` / WARN
  - GPT-mini Strudel: `0.46` / WARN
  - GPT-mini Tone: `0.62` / WARN
  - GPT-mini Kinetic: `0.62` / WARN
- It gave strong scores to clean outputs:
  - p5 pass from qwen3.5-4b: `0.93`
  - GLSL pass: `0.86–0.92`
  - Kinetic pass: `0.86`
  - ASCII pass: `0.86–0.92`

Recommendation:

```text
Use GPT-5.4-nano as a cloud cross-check evaluator, not the default evaluator.
```

## GPT-5.4 Mini as evaluator

Evidence is thinner.

Partial artifact:

```text
df1-2026-04-14T07-50-41-520Z
```

Config:

```text
Generator:
  lmstudio/qwen3.5-4b

Evaluator:
  openai/gpt-5.4-mini
```

Observed partial examples:

- p5 valid output:
  - evaluator score `0.88`
  - evaluator notes described it as valid/calming particle field
- Tone invalid output:
  - evaluator score `0.12`
  - evaluator notes correctly identified missing Tone import / invalid API shape

Recommendation:

```text
GPT-5.4-mini evaluator: promising but under-tested.
Use only if a stronger paid evaluator check is needed.
```

## GLM 4.5 Air as evaluator

Evidence is currently too thin.

Direct evaluator candidate artifact:

```text
df1-2026-04-14T15-36-23-603Z
```

Config:

```text
Generator:
  lmstudio/qwen3.5-2b

Evaluator:
  glm-4.5-air
```

Result:

| Domain | Result | Eval | Launch |
| --- | --- | ---: | --- |
| p5 | PASS | `0.85` | YES |

Recommendation:

```text
GLM 4.5 Air evaluator: insufficient data.
GLM 4.5 Air generator: excellent data.
```

---

## Compatibility / harness note for GLM 4.5 Air

Separate from DF1 generator/evaluator use, GLM 4.5 Air also had compatibility-lane runtime proving artifacts in `.worktrees/compat-rt4-glm`.

Clean artifacts:

- RT1 success: `.worktrees/compat-rt4-glm/.omx/logs/runtime-task-runs/RT1-2026-04-14T08-05-32-962Z.json`
- RT2 success: `.worktrees/compat-rt4-glm/.omx/logs/runtime-task-runs/RT2-2026-04-14T08-14-03-967Z.json`
- RT3 success: `.worktrees/compat-rt4-glm/.omx/logs/runtime-task-runs/RT3-2026-04-14T08-18-03-500Z.json`

RT4 was not clean in the artifacts inspected here. Attempts either failed after tool-gating/build issues or touched the proving harness when RT4 expected a cut-only/no-change surface.

Implication:

- GLM 4.5 Air is strongly supported as a DF1 **generator**.
- It should not be treated as fully compatibility-graduated harness model from these local artifacts alone unless a separate later RT4-clean artifact exists elsewhere.

---

## Updated overall rankings

## Generator ranking for DF1 / early DF2

### Tier 1 — best current candidate

```text
glm-4.5-air
```

Why:

- Full 7-domain pass.
- Best launch-readiness.
- Strong scores.
- Good speed except Kinetic.

### Tier 2 — strong alternatives

```text
openrouter/elephant-alpha
nvidia/nemotron-3-nano-30b-a3b:free
qwen3-coder-next-reap-40b-a3b-i1
gpt-5.4-mini
```

Interpretation:

- `openrouter/elephant-alpha`: best free OpenRouter broad generator, 7/8 proxy domains.
- `nvidia/nemotron-3-nano-30b-a3b:free`: strong free OpenRouter visual/code generator.
- `qwen3-coder-next-reap-40b-a3b-i1`: best local synthetic generator, slower.
- `gpt-5.4-mini`: decent cloud fallback, weaker than GLM in observed DF1.

### Tier 3 — narrow/cheap probes

```text
gpt-5.4-nano
qwen3.5-0.8b
liquid/lfm-2.5-1.2b-instruct:free
liquid/lfm-2.5-1.2b-thinking:free
```

Use for:

- cheap experiments,
- narrow domains,
- fallback,
- scouting.

Do not use as default broad generator.

## Evaluator ranking

### Tier 1 — default

```text
lmstudio/qwen3.5-2b
```

Why:

- Best consistency baseline.
- Local/cheap.
- Worked well in the best GLM run.
- Avoids cloud/free endpoint noise.

### Tier 2 — fallback/cross-check

```text
lmstudio/qwen3-coder-next-reap-40b-a3b-i1
openai/gpt-5.4-nano
openrouter/elephant-alpha
liquid/lfm-2.5-1.2b-instruct:free
nvidia/nemotron-3-nano-30b-a3b:free
```

### Tier 3 — under-tested

```text
openai/gpt-5.4-mini
glm-4.5-air
```

These are not ranked low because they are bad, but because evaluator-specific gold-suite evidence is insufficient.

---

## Recommended next experiment

To isolate generator quality, keep evaluator constant:

```text
Evaluator:
  lmstudio/qwen3.5-2b

Fallback evaluator:
  lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

Compare generators:

```text
Generator A:
  glm-4.5-air

Generator B:
  openrouter/elephant-alpha

Generator C:
  nvidia/nemotron-3-nano-30b-a3b:free

Generator D:
  gpt-5.4-mini

Generator E:
  qwen3-coder-next-reap-40b-a3b-i1
```

Start with domains:

```text
p5
glsl
three
tone
kinetic
ascii
strudel
```

Then add Hydra once runtime/evaluator gates are stable.

---

## Final recommendation

For the next DF1/DF2-style run, use:

```text
Harness:
  kimi-for-coding
  or another compatibility-graduated harness model

Generator:
  glm-4.5-air

Evaluator:
  lmstudio/qwen3.5-2b

Fallback evaluator:
  lmstudio/qwen3-coder-next-reap-40b-a3b-i1
```

The biggest actionable learning is:

```text
GLM 4.5 Air should be promoted from “interesting cheap model” to “primary generator candidate to beat.”
```
