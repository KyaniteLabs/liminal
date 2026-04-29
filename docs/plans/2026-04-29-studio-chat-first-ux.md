# Liminal Studio chat-first UX slice

Date: 2026-04-29  
Branch: `fix/studio-chat-first-ux`  
Baseline: `8712ff0f7cdbf6af9dfe03ef7fc7bcb35d4d33aa`

## Target experience

Liminal Studio should feel like Codex for creative coding: the main surface is a clean conversation with an AI creative coding agent, with generated artifacts easy to preview on the side. Internal proof, harness, observability, and model details remain available, but they are no longer the dominant artist-facing object.

## T3Code reference patterns used

Read-only reference: `pingdotgg/t3code@dbebc387dd458dd7062380ccb862a5cdac7aba66`.

- Chat timeline centered as the product surface (`MessagesTimeline.tsx`).
- Work/tool logs compact and collapsible instead of primary (`MessagesTimeline.logic.ts`).
- Composer placed at the bottom with nearby compact controls (`ChatComposer.tsx`).
- Right-side detail/preview surface for expanded artifacts (`RightPanelSheet.tsx`, `rightPanelLayout.ts`, `DiffPanelShell.tsx`).
- Inline artifact/image affordance that can expand into a larger surface (`ExpandedImageDialog.tsx`).

## Preserved capability map

| Capability/control | New home | Preservation note |
| --- | --- | --- |
| Natural-language prompt | Primary chat composer | Same `workbench-prompt` state and submit path; now labeled `Message Liminal`. |
| Generate action | Primary composer button | Same `onRun` / disabled-state plumbing. |
| Generate vs Polish | Advanced drawer | Existing execution select remains. |
| Domain/run mode selector | Advanced drawer | Existing selector and prompt override copy remain. |
| Max iterations, BPM, Palette | Advanced drawer | Existing controls remain available. |
| Voice/audio Sync | Compact composer control | Existing `audioSlot` remains next to the composer. |
| Stage/live artifact preview | Right preview panel | Same `stageSlot`, now persistent on the right. |
| Artifact affordance | Inline chat card | New card points artists to the preview panel. |
| Work/process timeline | Collapsed work log | Same `timelineSlot`, open while busy and collapsed when idle. |
| Clarifying questions/revision actions | Work log | Existing forms remain in `timelineSlot`. |
| Provider/harness/evaluator truth | Status pills + drawer | Truth stays visible compactly; detailed cards remain available. |
| Manual review / receipts | Advanced drawer + preview overlay | Existing `inspectorSlot` and preview strip remain. |
| Cognitive receipts | Advanced drawer | Existing receipt component remains. |
| Pending action confirm/cancel/stop | Advanced drawer | Existing safety controls remain. |
| Settings/config | Left nav + drawer button | Existing config form remains. |
| Improve proposals | Mode nav + Scan flow | Existing improve lane remains; smoke proof exercises it. |
| Cockpit, Music, Live, Curator, Compost, Activity | Left subnav + supplemental panel | Existing lazy-loaded panels remain. |
| Errors/debug details | Existing alert/detail surfaces | No error surfaces were hidden or removed. |

## Screenshot evidence

Captured locally under `.omx/proof/visual-inspection/`:

- `final-01-chat-first-idle.png`
- `final-02-advanced-drawer-open.png`
- `final-03-prompt-ready.png`
- `final-04-prompt-submitted.png`
- `final-05-preview-result.png`

## Execution verification

Commands run successfully:

- `pnpm --dir gui build`
- `npm run build`
- `npm run lint`
- `pnpm run proof:studio-smoke`
- `pnpm run proof:user-surfaces`
- `pnpm run proof:user-surface-controls`
- `pnpm run proof:user-surface-observability`
- `npx vitest run test/unit/gui-workbench-accessibility.test.ts test/unit/gui-workbench-state.test.ts --coverage=false`
- `git diff --check`

Real Studio prompt run through `http://localhost:5673`:

> Create a concise p5.js sketch: luminous blue-green particles orbit a dark center, with visible motion, setup(), draw(), and createCanvas().

Outcome: `preview-ready` in about 9.1s. Evidence included user prompt bubble, p5 route, mounted preview, and direct object sync.

## Verdict

Aligned for the first high-ROI slice. The default Studio surface now reads as a chat-first creative coding agent with easy preview access, while proof/harness/observability and advanced controls are preserved behind progressive disclosure. Remaining UX work: richer inline artifact thumbnails, click-to-expand preview behavior, and a less dense advanced-detail taxonomy.
