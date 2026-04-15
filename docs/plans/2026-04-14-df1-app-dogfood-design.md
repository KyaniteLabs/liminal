# DF1 App Dogfood Design

## Goal

DF1 turns the RT1-RT4 runtime proving work into product-facing evidence. Instead of proving the harness can repair itself, DF1 runs real creative generation slices and captures enough artifacts to identify and fix actual Liminal generator, validator, routing, and preview failures.

## Scope

The first slice covers six representative product domains:

- `p5`
- `glsl`
- `three`
- `strudel`
- `tone`
- `html`

Each domain has one stable prompt, one generator invocation, domain validation, wrapped preview output when the generator supports it, and durable artifacts under `.omx/logs/df1-runs/<run-id>/`.

## Artifact Contract

Each DF1 run emits:

- `run.json`: run configuration, actual `generatorConfig`, provider/model, domain list, timestamps
- `summary.json`: machine-readable aggregate results
- `summary.md`: human-readable report
- `<domain>/prompt.json`: prompt and domain metadata
- `<domain>/response.json`: model response metadata, thinking/reasoning/provenance when available
- `<domain>/code.txt`: generated code
- `<domain>/preview.html`: wrapped preview where available
- `<domain>/validation.json`: `CodeValidator` result
- `<domain>/runtime.json`: browser render/runtime status for visual domains, skipped only for dry-run or non-visual domains
- `<domain>/screenshot.png`: captured browser output when runtime rendering reaches a drawable surface
- `<domain>/result.json`: terminal per-domain result, including explicit `runtimeStatus` (`completed`, `skipped`, or `error`) and `runtimeReason` when runtime is intentionally not applicable

Dry runs are allowed for runner verification but are explicitly marked `dryRun: true` and do not count as product dogfood evidence.

## Provider Policy

DF1 treats `--provider` as the **actual generator provider** for the run and records it as `generatorConfig` in `run.json`. The intended default product path is a smaller local model served by LM Studio, including a remote LM Studio server reached over Tailscale. Cloud models remain comparison or repair/escalation lanes, not the default generator lane.

Current local generator routing policy:

- Default generator: `qwen3.5-2b`
- Cheap draft generator: `qwen3.5-0.8b` for `p5`, `three`, and `tone`
- Quality fallback: `qwen3-coder-next-reap-40b-a3b-i1` for `p5`, `glsl`, `hydra`, and `strudel`
- Avoid as default: `lfm2.5-1.2b-instruct`, `qwen3.5-4b`, `qwen3.5-9b`, and `gemma-4-e4b-claude-4.6-opus-reasoning-distilled`

This policy came from remote-only direct prompt and actual generator-class bakeoffs. DF1 records the policy in `run.json` so later runs can be interpreted against the intended routing baseline. The policy is not itself evidence that those local models generated a specific run; `generatorConfig` is the source of truth for that.

Actual generation is opt-in by provider:

- `--provider=active`
- `--provider=openai`
- `--provider=glm`
- `--provider=kimi`
- `--provider=minimax`
- `--provider=lmstudio`
- `--provider=ollama`

For LM Studio over Tailscale, pass:

```bash
npm run dogfood:df1 -- --provider=lmstudio --lmstudio-base-url=<tailscale-lm-studio-url>/v1 --lmstudio-model=<model-id> --domains=p5
```

The runner records provider/baseUrl/model/API usage where available. It does not use template fallback for real dogfood. If generation fails, the failure is recorded as product evidence.

## Success Criteria

DF1 is useful when it can answer:

1. Which real product domains generate valid code?
2. Which validation errors recur?
3. Which models/providers fail by domain?
4. Which failures have enough context for a bounded harness fix?
5. Does re-running the same slice after a fix improve pass rate?

The first implementation is complete when the dry-run path writes all artifacts and the actual path can run one selected domain/provider without changing the artifact schema.

## First Real Finding

The first LM Studio p5 smoke used `qwen3.5-2b` at `http://100.66.225.85:1234/v1`. It exposed two validator gaps before any harness repair model was involved:

- Raw/global p5 validation accepted syntactically invalid browser JavaScript.
- HTML-wrapped p5 validation accepted incomplete HTML documents that later failed in preview rendering.

DF1 now parses p5 code as browser-script JavaScript, rejects incomplete p5 HTML wrappers, and records runtime render errors separately from static validation errors. This keeps generator failures, validator gaps, and runtime preview failures distinct enough for a later harness repair loop.

A later GPT-5.4-nano probe exposed a p5 false negative: keyboard globals such as `key`, `keyCode`, and `keyIsPressed` are valid p5 global-mode API surface and must not be treated as undeclared sketch state.

## RT1-RT4 Learnings Carried Forward

DF1 follows the same proving principles learned in RT1-RT4:

- Preserve failed candidates as artifacts. A generator validation failure must still emit `code.txt` and `validation.json` when a candidate exists.
- Separate axes. Static validation, runtime rendering, provider/generator failure, and harness/infra failure are not the same outcome.
- Make skipped evidence explicit. Audio/text domains that do not use browser runtime must emit `runtimeStatus: "skipped"` with a reason, not an absent `runtimePassed` field that a harness model can misread as missing telemetry.
- Prefer deterministic gates before model repair. Syntax, wrapper completeness, undeclared identifiers, and browser runtime errors should be classified before asking another model to fix anything.
- Do not count dry-run fixture success as product evidence.
- Do not spend expensive models on opaque failures. First make the failure replayable, then repair.

## Cloud Harness / Local Generator Switching

DF1 must prove not only that one local generator can pass, but that the cloud harness can intentionally switch among local LM Studio generator models without losing provenance or state.

Launch-readiness requires a provider-switching slice:

- Cloud harness model selects a local generator model ID.
- DF1 runs the same domain set against that LM Studio model.
- Artifacts record `provider`, `baseUrl`, `model`, domain, duration, validation outcome, runtime outcome, and error class.
- Harness switches to another LM Studio model ID on the same server and reruns the same domain set.
- Summary compares model-specific failures without overwriting prior artifacts.
- A failed local model is treated as generator compatibility evidence, not harness failure, unless provider/model provenance is missing.

## DF2: Iterative Generator-Evaluator Loop

DF1 proves the single-pass tri-role path:

```text
Generator -> deterministic validation/runtime -> Evaluator -> Harness analysis
```

DF2 now proves the bounded inner improvement behavior:

```text
Generator candidate 1 -> validation/runtime -> Evaluator score/critique
Generator candidate 2, informed by candidate 1 compact repair packet -> validation/runtime -> Evaluator score/critique
Deterministic best-candidate selection -> final adjudication
```

Required DF2 artifact contract:

- `run.manifest.json`
- `env.snapshot.json`
- `preflight.task.json`
- `preflight.canary.json`
- `state-trace.jsonl`
- `candidate-*/code.txt`
- `candidate-*/validate.report.json`
- `candidate-*/runtime.report.json`
- `candidate-*/evaluator.final.json`
- `candidate-*/decision.json`
- `candidate-*/candidate.summary.json`
- `candidate-index.json`
- `adjudication.final.json`

DF2 must separate loop purposes:

- Generator loop: produce improved candidates.
- Evaluator loop: score only candidates that pass deterministic validation and runtime execution.
- Harness loop: deterministic adjudication; LLM harnesses are shadow-only and cannot control state transitions.

DF2 success criteria:

- Up to 2 generator candidates are produced for one representative runtime-backed domain.
- Each candidate has deterministic validation/runtime evidence.
- Each candidate has explicit runtime applicability evidence: `completed`, `skipped`, or `error`.
- Evaluator artifacts exist only for runtime-passing candidates; skipped evaluator artifacts record the deterministic skip reason.
- The selected best candidate is chosen by deterministic evidence hierarchy and rank score, not harness prose.
- Final adjudication records whether the result is launch-ready, functional, warning-quality, generator compatibility failure, or harness/validator/wrapper failure.

Implemented runner:

```bash
npm run dogfood:df2 -- --domains=p5 --preset=qwen-local
```

Current presets:

- `qwen-local`: `qwen3.5-2b` primary generator/evaluator with `qwen3-coder-next-reap-40b-a3b-i1` fallback.
- `glm-ab`: GLM 4.5 Air primary generator with the same local fallback/evaluator stack.

Current run policy is cloud-first for DF2/DF3 progression: prove lightweight cloud generators (`gpt-5.4-mini`, `gpt-5.4-nano`, and `glm-4.5-air`) before returning to local-only and local-cloud combination work. Local models remain the long-term cost target, but they should not block cloud-first DF2/DF3 correctness and telemetry.

First real DF2 p5 smoke:

```text
.omx/logs/df2-runs/df2-2026-04-14T17-10-14-957Z
```

Result: `launch_ready_pass` with deterministic validation pass, runtime pass, evaluator score `90`, runtime health `100`, and rank score `92`.

First cloud-first DF2 results:

- `gpt-5.4-mini`: p5, GLSL, Three, and Kinetic passed launch-ready in the full runtime-backed batch; HTML passed launch-ready in a focused rerun after evaluator score-scale normalization.
- `gpt-5.4-nano`: Three, Kinetic, and HTML passed launch-ready in the full batch; GLSL passed via fallback generator; p5 passed launch-ready in a focused rerun after 0-10 evaluator score normalization.
- `glm-4.5-air`: p5, GLSL, Three, Kinetic, and HTML all passed launch-ready in the full runtime-backed batch.

## First Clean Local p5 Pass

Run:

```bash
npm run dogfood:df1 -- --provider=lmstudio --lmstudio-base-url=http://100.66.225.85:1234/v1 --lmstudio-model=qwen3.5-2b --domains=p5
```

Artifact:

```text
.omx/logs/df1-runs/df1-2026-04-14T05-18-19-737Z
```

Result:

- `validationPassed: true`
- `runtimePassed: true`
- browser screenshot captured
- browser errors: `[]`

The compounding fix was contract alignment, not model escalation: p5 prompt contract, generator harness skeleton, validator, wrapper, and recovery prompt now all agree on raw global-mode p5 JavaScript by default.

## First Clean Local GLSL Pass

Run:

```bash
npm run dogfood:df1 -- --provider=lmstudio --lmstudio-base-url=http://100.66.225.85:1234/v1 --lmstudio-model=qwen3.5-2b --domains=glsl
```

Artifact:

```text
.omx/logs/df1-runs/df1-2026-04-14T05-25-48-566Z
```

Result:

- `validationPassed: true`
- `runtimePassed: true`
- browser screenshot captured
- browser errors: `[]`

The compounding fix was the same pattern as p5: remove conflicting global HTML/import hints from shader generation, give `ShaderGenerator` a fragment-only GLSL contract, make the preview wrapper avoid duplicate boilerplate, and backport runtime shader compile errors into static validation.

## First Clean Local Three.js Pass

Run:

```bash
npm run dogfood:df1 -- --provider=lmstudio --lmstudio-base-url=http://100.66.225.85:1234/v1 --lmstudio-model=qwen3.5-2b --domains=three
```

Artifact:

```text
.omx/logs/df1-runs/df1-2026-04-14T05-37-28-330Z
```

Result:

- `validationPassed: true`
- `runtimePassed: true`
- browser screenshot captured at `800x600`
- browser errors: `[]`

The compounding fix was wrapper and semantic alignment: the Three wrapper no longer duplicates `THREE` imports, provides `canvas/w/h`, attaches the actual renderer canvas, and static validation rejects unstarted or non-mutating animation loops.
