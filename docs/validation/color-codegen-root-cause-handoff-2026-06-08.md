# Root-Cause + Handoff: "[object Arguments] is not a valid color" — 2026-06-08

**Worker U investigation. Verdict: NOT composition — it is a generated-code / validation gap in
Worker C's lane (`src/generators/p5`, `src/core/validators`, `src/core/CodeValidator`). No composition
fix made; this is a handoff to Worker C.** Branch `fix/composition-color-codegen` (no `src/` change).

## Symptom
Some composed works render with a console error `Error: [object Arguments] is not a valid color
representation.` (first seen in the #619 indigo-glacier composite; it compounded the screen-blend
washout). `[object Arguments]` is exactly `String(<JS arguments object>)`, so a p5 **color function**
(`fill`/`stroke`/`background`/`color`/`colorMode`/`tint`/`lerpColor`) is being called with the JS
`arguments` object instead of spread values — the classic LLM codegen mistake of a color helper:
```js
function paint(){ fill(arguments); /* bug: should be fill(...arguments) */ }
paint(255, 80, 200);
```

## Reproduction
- **Deterministic (confirmed):** wrapping a p5 sketch containing `fill(arguments)` via the product's
  `HTMLWrapper.wrap(code,{domain:'p5'})` and rendering it reproduces the exact error
  `[object Arguments]is not a valid color representation`. The wrapper injects **no** color shim
  (verified: `WRAP injects color shim? NO`) — composition/wrapping is transparent to it.
- **Intermittent in the wild:** 3 fresh `sinter compose` runs (never-before-used prompts:
  neon-mandala, bioluminescent-drift, generative-watercolor-garden) did **not** emit the pattern this
  session — it depends on the LLM occasionally writing a color helper that forwards `arguments`. So it
  is a real but non-deterministic codegen defect, not a fixed template.

## Root cause (with file:line)
The invalid call originates in **LLM-generated p5 layer code**, and it slips through because the p5
validation never flags a color fn called with `arguments`:

1. **Origin (emit):** `src/generators/p5/P5GeneratorLLM.ts` — the LLM occasionally emits p5 code where a
   color fn receives the `arguments` object (directly, or via a variable/`apply` that holds it).
2. **Validate → retry loop exists but is blind to it:** `src/generators/p5/P5GeneratorLLM.ts:175`
   runs `P5Validator.validate(llmResponse.code)` and **retries on failure** (`:186`). If the validator
   flagged this pattern, the generator would already self-repair via that retry.
3. **The gap:** `src/core/validators/P5Validator.ts` validates syntax / referenced identifiers /
   structure and only **allow-lists** `fill`/`color`/`background`/`stroke` as known function names — it
   has **no check** that a color fn's argument is valid (it never rejects `colorFn(arguments)`).
   `src/core/CodeValidator.ts:146 validateNoGuaranteedRuntimeThrow()` catches only an explicit
   `throw`, not this guaranteed-runtime-throw pattern.

**Why it is NOT composition (my lane):** `CompositionOrchestrator` delegates per-layer codegen to the
generator (`generateLayer` → `entry.generate(prompt)`) and wraps the result via `HTMLWrapper` →
`P5Wrapper`. None of `src/composition/*`, `src/utils/htmlWrapper.ts`, or
`src/core/wrappers/P5Wrapper.ts` inject, transform, or validate color calls (read all three; the only
`arguments` use in the wrapper is PostHog's correct `Array.prototype.slice.call(arguments)`). The
deterministic repro confirms the wrapper passes the generated code through unchanged.

## Recommended fix (Worker C — `src/core/validators/P5Validator.ts`, retry loop does the rest)
Add a guaranteed-runtime-throw check for a p5 color fn called with the bare `arguments` object so the
existing `P5GeneratorLLM` validate→retry loop regenerates:
```
/\b(fill|stroke|background|color|colorMode|tint|ambientLight|specularColor|lerpColor)\s*\(\s*arguments\s*\)/
```
Consider broadening to a value provably equal to `arguments` (a var assigned `= arguments`, or
`colorFn.apply(_, ...)`), and/or an auto-repair rewriting `fill(arguments)` → `fill(...arguments)`.
Add the matching `P5Validator` unit test. (Could also live in
`CodeValidator.validateNoGuaranteedRuntimeThrow`, but `P5Validator` is the natural home and is already
in the generator's retry path.)

## Handoff
Owner: **Worker C** (`src/generators` / `src/core`). No code changed by Worker U; `src/composition`
remains settled. This doc is the handoff record — do not merge as a fix.
