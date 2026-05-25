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
| 0 | Read-only repo and machine audit | partial | Bounded local audit found the main `simongonzalezdc/liminal` checkout, this worktree, the rescue Sing worktree, `/Users/simongonzalezdecruz/workspaces/kyanite-labs/liminal`, `/Users/simongonzalezdecruz/workspaces/personal/liminal-sites`, and `/Users/simongonzalezdecruz/Desktop/OMC/liminal`. | Full-home audit and the package script both hung on `/Users/simongonzalezdecruz/Desktop/OMC/liminal` during status collection. Mac mini was represented by already-rescued commit evidence, not freshly audited in this branch. |
| 1 | Architecture docs | complete | `docs/adr/0001-liminal-product-shape.md`, `docs/adr/0002-liminal-sites-aesthetic-evolution.md`, `docs/adr/0003-liminal-instrument-performance-shape.md`, `docs/integrations/posthog-aesthetic-sensorium.md`. | Keep these aligned when repos are consolidated. |
| 2 | Studio conversational UX audit | complete | `docs/audits/studio-conversation-ux-audit-2026-05-24.md`. | Broader stop/error visual QA can still be expanded. |
| 3 | Studio conversational UX repair | complete | `3f6d5a5b`, `gui/src/gui/studioConversation.ts`, `test/unit/gui/studio-conversation.test.ts`, plus full repo tests already passed earlier in this branch. | Browser retest before PR/merge if UI changes continue. |
| 4 | Sites aesthetic correction | partial | `docs/adr/0002-liminal-sites-aesthetic-evolution.md`, `docs/integrations/posthog-aesthetic-sensorium.md`, `docs/audits/sites-keyword-audit-2026-05-24.md`. | Existing historical docs still contain business/SEO/growth language outside Sites-specific product docs. A safer follow-up should scope edits to current Sites docs, not archives/factory personas. |
| 5 | Instrument/Sing preservation | partial | `35e4164c`, current tracked `packages/sing`, `packages/audio-core`, `gui/src/gui/audioSing.ts`, `gui/public/audio-sing-worklet.js`, and `docs/audits/instrument-sing-preservation-2026-05-24.md`. | Full local-only commit accounting across every machine is not complete because Phase 0 full scan stalled. |
| 6 | Mock lyric teleprompter | complete | `8209e81c`, `packages/sing/src/teleprompter/phrases.ts`, `packages/sing/src/main.ts`, `packages/sing/src/recording/SessionRecorder.ts`, `test/unit/sing/teleprompter.test.ts`. | Replace mock generation only after Phase 7 selects a model. |
| 7 | LFM2.5 benchmark harness | partial | `99d7fc9e`, `52e95df3`, `9eea129d`, `packages/sing/src/teleprompter/benchmark.ts`, `packages/sing/src/teleprompter/benchmark-cli.ts`, `docs/audits/sing-lfm2_5-mlx-local-benchmark-2026-05-24.md`. | Harness exists, but no model was selected. The local `LFM2.5-1.2B-Instruct-MLX-8bit` run was rejected. |
| 8 | Real lyric sidecar integration | blocked | Blocked by Phase 7 rejection. Wiring an unselected model would violate the package gate. | Run a sustained browser/audio benchmark and select a model with zero attributable render/audio degradation. |
| 9 | Camera/movement prototype | not started | Design captured in `docs/adr/0003-liminal-instrument-performance-shape.md`. | Implement camera permission UI, pose worker, reducer, mappings, privacy indicator, and worker stall tests. |
| 10 | Consolidation proposal | partial | Current recommendation captured in `docs/audits/instrument-sing-preservation-2026-05-24.md`: keep Instrument/Sing inside this repo for now. | Final repo-shape proposal requires a completed Phase 0 audit and Phase 9 prototype evidence. |

## Bottom Line

The plan is not fully finished. The branch has completed the safe Studio and
Sing slices, created the missing architectural handoff artifacts, and preserved
the LFM rejection evidence. The next implementation work should be Phase 9
camera/movement or a stronger Phase 7 benchmark, not Phase 8 model wiring.
