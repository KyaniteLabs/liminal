# Liminal Document Pack Completion Matrix - 2026-05-24

## Scope

This matrix tracks the 13-document handoff package plus the execution plan in
`/Users/simongonzalezdecruz/Downloads/liminal-codex-document-pack.zip`.

Status language:

- `complete` means implemented or documented in this branch and verified.
- `partial` means useful evidence exists, but the package acceptance bar is not
  fully met.
- `blocked` means the correct next implementation step is unsafe until a gate
  passes.
- `not started` means no repo change has landed for that phase in this branch.

## Branch Evidence

Current worktree:

```text
/Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/studio-conversation-ux-20260524
branch: codex/studio-conversation-ux-20260524
head before this doc batch: 9eea129d Preserve the local LFM rejection evidence
```

Key landed commits:

| Commit | Phase coverage |
|---|---|
| `35e4164c` | Preserved the Mac mini Sing cadence fix in `gui/public/audio-sing-worklet.js` with a unit test. |
| `3f6d5a5b` | Repaired Studio follow-up routing so artifact messages become revise/variant/inspect/export instead of one-shot prompts. |
| `8209e81c` | Added the mock Sing lyric teleprompter, phrase queue, pin/dismiss/more controls, and session phrase logging. |
| `99d7fc9e` | Added the phrase benchmark harness and CLI. |
| `52e95df3` | Added OpenAI-compatible local backend support for local LFM/MLX servers. |
| `9eea129d` | Preserved the local LFM2.5 MLX benchmark evidence and rejection verdict. |

## Phase Matrix

| Phase | Package goal | Status | Evidence | Remaining work |
|---|---|---:|---|---|
| 0 | Read-only repo and machine audit | partial | Bounded local audit found the main `simongonzalezdc/liminal` checkout, this worktree, the rescue Sing worktree, `/Users/simongonzalezdecruz/workspaces/kyanite-labs/liminal`, `/Users/simongonzalezdecruz/workspaces/personal/liminal-sites`, `/Users/simongonzalezdecruz/Desktop/OMC/liminal`, and the actions-runner checkout. Timeout-bounded retries are documented in `docs/audits/liminal-fragmentation-audit-2026-05-24.md`. | `/Users/simongonzalezdecruz/Desktop/OMC/liminal` remains unreadable for working-tree status because status/diff commands time out. Mac mini was represented by already-rescued commit evidence, not freshly audited over SSH in this branch. |
| 1 | Architecture docs | complete | `docs/adr/0001-liminal-product-shape.md`, `docs/adr/0002-liminal-sites-aesthetic-evolution.md`, `docs/adr/0003-liminal-instrument-performance-shape.md`, `docs/integrations/posthog-aesthetic-sensorium.md`. | Keep these aligned when repos are consolidated. |
| 2 | Studio conversational UX audit | complete | `docs/audits/studio-conversation-ux-audit-2026-05-24.md`. | Broader stop/error visual QA can still be expanded. |
| 3 | Studio conversational UX repair | complete | `3f6d5a5b`, `gui/src/gui/studioConversation.ts`, `test/unit/gui/studio-conversation.test.ts`, plus full repo tests already passed earlier in this branch. | Browser retest before PR/merge if UI changes continue. |
| 4 | Sites aesthetic correction | partial | `docs/adr/0002-liminal-sites-aesthetic-evolution.md`, `docs/integrations/posthog-aesthetic-sensorium.md`, `docs/audits/sites-keyword-audit-2026-05-24.md`. | Existing historical docs still contain business/SEO/growth language outside Sites-specific product docs. A safer follow-up should scope edits to current Sites docs, not archives/factory personas. |
| 5 | Instrument/Sing preservation | partial | `35e4164c`, current tracked `packages/sing`, `packages/audio-core`, `gui/src/gui/audioSing.ts`, `gui/public/audio-sing-worklet.js`, and `docs/audits/instrument-sing-preservation-2026-05-24.md`. | Full local-only commit accounting across every machine is not complete because Phase 0 full scan stalled. |
| 6 | Mock lyric teleprompter | complete | `8209e81c`, `packages/sing/src/teleprompter/phrases.ts`, `packages/sing/src/main.ts`, `packages/sing/src/recording/SessionRecorder.ts`, `test/unit/sing/teleprompter.test.ts`. | Replace mock generation only after Phase 7 selects a model. |
| 7 | LFM2.5 benchmark harness | complete | `99d7fc9e`, `52e95df3`, `9eea129d`, `packages/sing/src/teleprompter/benchmark.ts`, `packages/sing/src/teleprompter/benchmark-cli.ts`, rejected 1.2B report, and selected 350M report in `docs/audits/sing-lfm2_5-350m-mlx-local-benchmark-2026-05-24.md`. | Future quality benchmark should score prompt variety; the realtime gate is satisfied for the optional first sidecar. |
| 8 | Real lyric sidecar integration | complete | `docs/audits/real-lyric-sidecar-integration-2026-05-24.md`, `packages/sing/src/teleprompter/lfm.ts`, optional query-param endpoint/model wiring in `packages/sing/src/main.ts`, and `test/unit/sing/lfm-sidecar.test.ts`. | Keep the sidecar optional. Do not make it the default until a longer creative-quality and browser/audio benchmark passes. |
| 9 | Camera/movement prototype | complete | `docs/audits/camera-movement-prototype-2026-05-24.md`, `packages/sing/src/movement/features.ts`, `packages/sing/src/movement/pose-worker.ts`, movement UI in `packages/sing/index.html`, movement uniforms in `packages/sing/src/render/pipeline.ts`, and focused movement tests. | Future MediaPipe pose detection can replace the coarse pixel-motion worker, but the package v1 acceptance slice is present. |
| 10 | Consolidation proposal | complete | `docs/audits/liminal-consolidation-proposal-2026-05-24.md` recommends keeping `packages/sing` inside this repo for now and keeping Sites as a sibling product. | Revisit only after the stuck OMC checkout is repaired or explicitly excluded. |

## Bottom Line

The branch has completed the safe Studio, Sing, mock teleprompter, benchmark
harness, optional LFM sidecar, camera/movement, and consolidation slices. Phase
0 remains the only partial package acceptance item because one local OMC
checkout times out on working-tree status and needs human repair or exclusion.
