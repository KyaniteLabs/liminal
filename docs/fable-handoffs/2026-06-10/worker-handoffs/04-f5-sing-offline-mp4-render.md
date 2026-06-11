# Handoff 04 — F5: implement (or honestly relabel) Sing's offline MP4 render

**Mode:** You may edit code + tests inside `packages/sing/` only. Work in an isolated worktree branch.

## Purpose

Audit finding F5: `packages/sing/src/recording/render-cli.ts:25` is a stub — `note: 'Offline MP4 rendering is wired to the Sing session contract; ffmpeg frame synthesis is the next implementation slice.'` The record→MP4 path no-ops while the performance-instrument story implies it works.

## Why this matters

Sing is the voice→visual performance instrument (Phases 1–4 merged, Phase 5 = preset + wiring test, which is `feat/f4-sing-wiring-test` on forge). A recording feature that silently produces nothing is the kind of claim-without-evidence the investor audit exists to kill.

## Exact files / areas

- `packages/sing/src/recording/render-cli.ts` (the stub)
- `packages/sing/src/recording/SessionRecorder.ts` (the session contract you must consume)
- `packages/sing/src/render/pipeline.ts` (uniform mapping — reuse `createSingStabilizer`/`mapSingPresetUniforms`; the wiring test `test/unit/sing/pipeline-wiring.test.ts` pins their behavior, do not change them)

## Two acceptable outcomes (pick by effort)

**A (preferred):** Implement frame synthesis: replay the recorded session frames through the stabilizer/uniform mapping, render frames headlessly, pipe to ffmpeg → MP4. Spawn ffmpeg via argument arrays only (no `shell:true`, no string interpolation of user paths).

**B (honesty fallback, if A exceeds ~a day):** Make the CLI refuse loudly — exit non-zero with "offline MP4 render not yet implemented" — and remove the misleading `note`. Update any doc that implies record→MP4 works. This still closes F5's *audit* dimension (no silent no-op).

## Exact commands to run

```bash
pnpm sing:typecheck
pnpm sing:build
# Outcome A only: render a short fixture session and verify the MP4 exists and has >0 frames
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames <out.mp4>
```

Plus at least one vitest unit test for whichever outcome you build (deterministic; mock ffmpeg at the process boundary if needed — mock contract must match real ffmpeg argv).

## Definition of done

Outcome A: fixture session → playable MP4, frame count asserted in a test, typecheck/build green. Outcome B: loud failure + docs updated + test asserting the non-zero exit and message.

## What not to touch

`packages/sing/src/render/pipeline.ts` exports pinned by the wiring test; `src/` (main package); the wiring test itself.

## Final report format

```
OUTCOME: <A|B>
DIFF: <stat>
COMMANDS: <each + exit code>
EVIDENCE: <ffprobe output or failing-CLI transcript>
```

Stop and ask before adding any new runtime dependency beyond ffmpeg invocation.
