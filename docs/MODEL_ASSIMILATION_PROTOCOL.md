# Model Assimilation Protocol

Liminal does not promote a model because its name is newer. A model becomes part of the harness only after it proves a role with evidence.

## Roles to Audition

| Role | What the model must prove | Example evidence |
| --- | --- | --- |
| Generator | Can create valid artifacts in target domains | SVG/p5/GLSL/Hydra/Three/Tone/Strudel/Revideo outputs validate and preview/export honestly |
| Evaluator | Can judge actual artifacts without pretending unavailable modalities were scored | Visual/audio/video receipts name what was inspected and what remains unscored |
| Planner | Can produce bounded implementation plans without swallowing provider errors or bloating prompts | Self-improvement planning stays below budget and preserves structured errors |
| Repair Agent | Can patch Liminal itself in an isolated worktree with tests | Diff, focused tests, build/typecheck evidence |
| Dreamer | Can recombine prior artifacts into plausible variants without erasing lineage | Dream task receipts with parents, motifs, and next-run influence |

## Domain Battery

Every candidate model should be tested against SVG, p5.js, GLSL, Hydra, Three.js, Tone.js, Strudel, Revideo, HTML, ASCII, Kinetic Typography, and TextGen.

## Evidence Required Before Promotion

Persist provider identity, endpoint, runtime model name, role, domain/subsystem, task packet, artifact paths, validation results, preview/export result or explicit modality limitation, evaluator evidence, latency/cost if available, failure class, retry count, and fallback/provenance decision.

## Promotion Rules

A candidate can be promoted only when it beats or matches the current baseline for the role/domain, preserves tool contracts, fails visibly instead of producing silent fallback artifacts, has at least one artifact-backed run, and does not regress provider truth in Studio/CLI telemetry.

## Demotion Rules

A model should be demoted or scoped down when it returns empty code/output repeatedly, cannot follow wrapper/output contracts, mislabels modalities, pretends to inspect what it did not inspect, is slower or more expensive without quality gain, or breaks self-improvement planning/repair tasks.

## Finish-Line Requirement

The finish line requires a reproducible model-assimilation report that can say:

> This model is now the preferred generator/evaluator/planner/repair/dreamer for this role/domain because these artifacts and checks beat the prior route.

Until then, a model can be configured, but it is not assimilated.

## Reproducible Report Command

Run:

```bash
pnpm proof:model-assimilation -- --out=.omx/proof/model-assimilation-dev
```

The default report is deterministic fixture evidence. It proves the assignment,
promotion/demotion, and fallback-provenance contract without claiming live
provider quality. Future live auditions should populate the same
`liminal-model-assimilation-v1` report shape with real artifact-backed runs.
