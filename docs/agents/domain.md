# Domain Docs

How the active engineering skills should consume Liminal's domain documentation when exploring the codebase.

## Layout

Liminal is configured as a **single-context** repo for these skills.

At setup time, the repo did not have root `CONTEXT.md`, root `CONTEXT-MAP.md`, or `docs/adr/`. Proceed silently when those files are absent. Do not create them just to satisfy setup; `/grill-with-docs` should create or update domain docs lazily when terminology or architectural decisions are actually resolved.

## Before exploring, read these when present

- **`CONTEXT.md`** at the repo root for project domain vocabulary.
- **`docs/adr/`** for architectural decisions that touch the area being changed.
- Existing Liminal docs that are directly relevant to the task, especially:
  - `docs/ARCHITECTURE_AND_PHILOSOPHY.md`
  - `docs/ARCHITECTURE_QUICKREF.md`
  - `docs/USER_SURFACE_CONTRACT.md`
  - task-specific files under `docs/plans/`, `docs/internal/`, or `docs/launch/`

If any of these files do not exist or are irrelevant to the task, proceed without flagging their absence.

## Use Liminal's vocabulary

When output names a domain concept, prefer Liminal's established terms: Meta-Harness, generator, evaluator, creative domain, Bubble Tea TUI, workbench, RalphLoop, thinking trace, ledger, compost, and provider/runtime truth. Avoid replacing artist-facing language with internal proof or harness jargon unless the task is explicitly about internals.

If the concept you need is not in the docs yet, note the vocabulary gap for `grill-with-docs` instead of inventing a new taxonomy.

## Flag decision conflicts

If your output contradicts an existing architecture doc or ADR, surface it explicitly rather than silently overriding it.
