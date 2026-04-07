# TUI Bubble Tea Execution Plan

**Status Date:** 2026-04-06

## Purpose

This document records the current execution reality for TUI remediation and Bubble Tea migration.

It is intentionally concrete:
- what is already partially contained in Ink
- what remains unsafe
- what must be finished before Bubble Tea becomes the default operator shell

---

## Current Ink Containment Gaps

The current Ink TUI is **not yet sufficiently contained**.

The following gaps still exist and must be addressed before it can be treated as a safe interim shell:

1. **No mutation without confirmation**
   - ad hoc task creation now marks tasks unapproved
   - but the agents themselves still do not enforce `approved === true`

2. **No ordinary chat leading to destructive execution**
   - ordinary chat still shares surfaces with action-like flows
   - the containment patch references review/confirm behavior but does not fully implement it

3. **Explicit mode requirement**
   - Bubble Tea target modes are clear (`Chat`, `Inspect`, `Action`, `Confirm`)
   - Ink does not yet enforce an explicit mode model for all action-capable flows

4. **No direct execution from `/run` or `/agent` without review**
   - `/agent` no longer auto-approves
   - `/run` still executes a structured task directly
   - `/confirm` is referenced in user messaging but is not yet implemented

5. **No unreviewed preview/audio subprocess launches**
   - browser/audio launch paths still exist in the TUI preview layer
   - these need explicit command/approval gating and safer path validation

6. **No CWD-based prompt/personality loading in TUI-critical paths**
   - `IntentRouter` no longer loads `SOUL.md` from arbitrary CWD
   - but `PromptBuilder` still reads prompt context from `process.cwd()`

7. **Terminal/debug output still needs hard sanitization**
   - prompt preview telemetry was reduced
   - debug output redaction improved
   - but there is still no central TUI-safe text sanitizer for logs/events/tool output

---

## What has already improved

The following containment work is already present in this worktree:

- `src/tui/NaturalInterface.ts`
  - ad hoc LLM tasks now default to `approved: false`
- `src/tui/commands.ts`
  - `/agent` tasks now default to `approved: false`
- `src/tui/HarnessTUI.tsx`
  - loaded harness tasks are forced to `approved: false`
- `src/llm/LLMClient.ts`
  - prompt preview removed from request telemetry
- `src/tui/TuiDebugger.ts`
  - prompt content redacted from debug summaries
- `src/tui/IntentRouter.ts`
  - removed CWD-based `SOUL.md` loading

These are useful **containment beginnings**, not completion.

---

## Execution priority

### Now

1. enforce approval gates inside both agents
2. implement real pending-action review + `/confirm` + `/cancel`
3. remove remaining CWD trust leaks from prompt loading
4. add terminal/debug sanitization
5. harden preview/audio launch behavior

### Next

1. define Bubble Tea bridge contract
2. build shared TypeScript bridge service
3. scaffold Bubble Tea pane shell
4. connect Bubble Tea shell to bridge status + SSE

### Later

1. separate committed history from active streaming pane
2. add Action / Confirm operator cards
3. render trust and provenance labels
4. retire Ink once safe Bubble Tea happy-path parity exists

---

## Hard rule

Bubble Tea planning must not be used as a reason to leave Ink unsafe.

Ink needs containment now.
Bubble Tea is the permanent direction after containment is real.
