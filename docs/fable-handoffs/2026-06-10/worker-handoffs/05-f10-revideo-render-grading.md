# Handoff 05 — F10: give revideo artifacts a visual-grading path in the quality harness

**Mode:** You may edit `scripts/quality/*.mjs` and add fixtures/tests. No `src/` changes.

## Purpose

Audit finding F10: `scripts/quality/render.mjs:89` skips revideo ("needs the Revideo renderer, not a static screenshot"), so revideo output is never visually graded — a whole launch domain has zero render proof.

## Why this matters

The visual-QA loop (quality:render → vision grading → register findings) is how bad generations get caught. Revideo is the only *visual* domain with no eye on it (strudel is audio — its skip is correct).

## Exact files / areas

- `scripts/quality/render.mjs` (the skip at line ~88-89)
- `scripts/quality/render-gallery.mjs` (same treatment if it skips revideo)
- Revideo renderer entry points: `@revideo/renderer` is an optionalDependency; `~/.sinter/revideo-template/` exists on this machine; check `src/render/` for any existing revideo render helper before writing a new one (Integration-First rule).

## Approach

Smallest honest slice: render ONE representative frame (or a 2-second clip → extract middle frame) from a revideo artifact via the Revideo renderer, save it as PNG beside the other domain renders so the existing vision-grading path picks it up. If `@revideo/*` is not installed (optionalDependency missing), print an explicit `SKIPPED (revideo renderer not installed)` rather than silently passing.

## Exact commands to run

```bash
node scripts/quality/render.mjs            # revideo row must show a render or an explicit reasoned skip
pnpm check:script-targets
```

## Definition of done

`quality:render` output includes a revideo PNG (or the explicit not-installed skip); no other domain's behavior changes; commands exit 0.

## What not to touch

`src/` (generation/composition code), other domains' render branches, `package.json` dependencies (renderer is already optional).

## Final report format

```
DIFF: <stat>
RENDER OUTPUT: <the revideo line from quality:render + path to PNG>
COMMANDS: <each + exit code>
```

Stop and ask if rendering requires a dev server or >30s per artifact — that changes the harness design and needs a decision.
