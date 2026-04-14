# Legacy Dogfood Telemetry Mining — 2026-04-14

This is a narrow mining pass over preserved legacy dogfood/model-comparison artifacts from `.claude/worktrees/launch-plan`. It intentionally does **not** inspect or modify the active DF2 lane.

## Boundary

Off-limits in this pass:

- `.worktrees/df1-app-dogfood`
- live `.omx/logs/df2-runs` artifacts
- active DF2 processes
- compatibility worktrees with dirty provider/runtime state

Sources mined here:

- `.claude/worktrees/launch-plan/test-results/model-comparison/comparison-report.json`
- `.claude/worktrees/launch-plan/dogfood-results-cloud-b.json`
- `.claude/worktrees/launch-plan/dogfood-results-ollama-a.json`
- `.claude/worktrees/launch-plan/artifacts/results/agent-b-results.json`
- `.claude/worktrees/launch-plan/artifacts/results/dogfood-results-agent-a.json`
- `.claude/worktrees/launch-plan/artifacts/results/landing-validation-report.json`
- `.claude/worktrees/launch-plan/artifacts/dogfood/telemetry-analysis.md`
- `.claude/worktrees/launch-plan/artifacts/logs/telemetry-minimax-m27.jsonl`

## Mined telemetry facts

### Model-comparison report was mostly a git/process hygiene failure

`test-results/model-comparison/comparison-report.json` had 20 rows. Most rows failed due to repository/index contention, not model quality:

| Model | Rows | Successes | Avg score | Valid outputs | Dominant error |
| --- | ---: | ---: | ---: | ---: | --- |
| Qwen 3.5 9B | 4 | 0 | 0.163 | 1 | index lock / could not write index |
| Qwen 3 Coder 40B | 4 | 0 | 0.000 | 0 | index lock / could not write index |
| MiniMax-M2.7 | 4 | 0 | 0.000 | 0 | index lock / could not write index |
| MiniMax-M2.7-highspeed | 4 | 0 | 0.000 | 0 | index lock / could not write index |
| MiniMax-M2.5 | 4 | 0 | 0.000 | 0 | index lock / could not write index |

Durable lesson:

> Model bakeoffs must run in isolated worktrees or non-mutating artifact directories. A model score is invalid if git/index contention can abort the run.

Current relevance:

- This directly validates the current worktree-isolation law.
- Any future model leaderboard should record whether the run was isolated and whether git/index state stayed clean.

### Cloud MiniMax legacy run was mixed, not a broad pass

`dogfood-results-cloud-b.json`:

- Total: 10
- Success: 5
- Failed: 5
- Rate: 50%
- Models:
  - `minimax-m27`: 2/5
  - `minimax-m25`: 3/5

Observed pattern:

- Hydra and Tone succeeded in that old run.
- Remotion/Revideo-era video outputs failed the then-active Remotion component contract.
- The run predates current Revideo cleanup and should not be used as current MiniMax quality evidence.

Durable lesson:

> Keep domain-contract migrations separate from model quality judgments. A model can fail an obsolete contract for reasons unrelated to current generator capability.

### Old Ollama Gemma4 run mainly shows timeout sensitivity

`dogfood-results-ollama-a.json`:

- Total: 4
- Success: 1
- Failed: 3
- Rate: 25%
- Model: `gemma4`

Pattern:

- p5 and GLSL timed out around 300 seconds.
- Three succeeded after ~194 seconds.
- Strudel failed contract validation.

Durable lesson:

> Slow local models need explicit timeout profiles and domain-specific candidate routing. A single timeout budget can make a model look worse than it is or waste too much dev-machine time.

Current relevance:

- Reinforces the current preference to avoid heavy local generation on the dev laptop during active coding.
- Supports keeping local models as evaluator/fallback/scout roles unless they prove fast enough.

### Agent B local model matrix shows broad old instability

`artifacts/results/agent-b-results.json` had 52 rows. Aggregated old pass counts:

| Model | Passes / Rows | Avg duration ms | Notes |
| --- | ---: | ---: | --- |
| `gemma` | 4 / 9 | 157,854 | Slow; partial successes only. |
| `granite-1b` | 1 / 9 | 153,618 | Mostly poor fit. |
| `granite-350m` | 2 / 9 | 17,090 | Fastest old local candidate, still weak. |
| `lfm` | 1 / 9 | 90,033 | Weak old evidence. |
| `phi4` | 2 / 9 | 160,402 | Slow and uneven. |
| `qwen35` | 1 / 7 | 250,012 | Very slow in this old run. |

Durable lesson:

> Old small local model runs were not reliable enough for broad generation. Current model-role decisions should continue to be artifact-driven per domain rather than defaulting to “small local model” broadly.

### Agent A result durations are suspiciously low

`artifacts/results/dogfood-results-agent-a.json` had 36 rows with extremely low average durations, for example tens of milliseconds for some cloud models. This likely reflects wrapper/report timing rather than full generation/runtime timing.

Durable lesson:

> Telemetry fields must define timing boundaries: request latency, generation latency, validation latency, runtime latency, evaluator latency, and total wall time are not interchangeable.

Current relevance:

- DF1/DF2 artifacts should continue separating generation, validation, runtime, evaluator, and total duration fields.
- Any dashboard should avoid comparing timings from old reports unless timing semantics are documented.

### Landing validation found “error artifact” false positives

`landing-validation-report.json` shows examples where generated pages existed and had required wrapper structure, but the actual artifact content was an embedded LLM error such as `LLM API error: 404 Not Found`.

Durable lesson:

> Artifact existence is not success. Gallery/landing validators must detect embedded provider errors and distinguish shell/wrapper validity from generated-content validity.

Current relevance:

- This matches later work around artifact-quality gates and provider provenance.
- Future gallery/landing reports should have explicit fields for `artifactExists`, `containsProviderError`, `contentValid`, and `launchReady`.

### Historical telemetry-analysis.md already identified two problems that remain important as invariants

The old telemetry analysis found:

1. HTML prompts were misclassified/scored as p5.
2. `maxIterations: 1` made low-score generations stop without repair.

Current durable lessons:

- Domain detection/routing must be tested independently from generation quality.
- Iterative dogfood loops must distinguish “one-shot scout” from “repair-capable loop.”

## Carry-forward invariants

1. **Run isolation is part of model validity.** A model score from a dirty/index-conflicted worktree is not reliable evidence.
2. **Artifact existence is not launch readiness.** Wrappers/screenshots/files can exist while generated content is an error placeholder.
3. **Timing fields must be typed.** Do not compare wall time, generation time, runtime time, and report-write time as if they are the same metric.
4. **Domain routing failures are model-evaluation poison.** A p5 scorer on HTML or Strudel requests invalidates the model comparison.
5. **Timeouts are a model-role signal.** Slow models may still be useful as evaluators or fallbacks, but not as default dev-machine generators.
6. **Migration contracts must be versioned.** Remotion-era failures should not be interpreted as current Revideo failures without contract mapping.

## Recommended future mining actions

- Build a small `legacy telemetry normalization` script that labels old records with `evidenceClass`: `model-quality`, `pipeline-failure`, `routing-failure`, `provider-failure`, or `obsolete-contract`.
- Mine only records classified as `model-quality` into future model leaderboards.
- Keep the rest as process failure evidence, not model rankings.

## Decision from this mining pass

No code changes were made. The mined value is a set of evidence-quality rules to prevent future DF/model leaderboards from mixing model quality with pipeline failures.
