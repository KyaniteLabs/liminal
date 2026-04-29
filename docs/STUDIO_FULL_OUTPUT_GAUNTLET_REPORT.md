# Studio full output gauntlet report

## Target experience

Liminal Studio is a chat-first creative coding agent. Artists should start from the conversation, choose or describe the medium in plain language, and immediately see the generated artifact as a real visual/audio/composition preview. Internal proof, harness, and receipt details remain available, but they are not the main visual object.

## Preserved capability map

| Capability | Artist-facing placement | Preservation proof |
| --- | --- | --- |
| p5.js sketches | Chat/create composer plus polished live preview stage | `data-liminal-p5-preview-shell`; centered canvas; real prompt proof screenshot |
| Three.js scenes | Output preview card/stage | Full visual contract requires a browser-visible canvas |
| SVG vector assets | Artifact preview card with large centered SVG | Full visual contract requires large SVG area |
| GLSL shaders | Artifact preview card/stage | Full visual contract requires a browser-visible canvas |
| Hydra visuals | Artifact preview card/stage | Full visual contract requires a browser-visible canvas |
| Strudel music | Collapsible/compact music preview with visible source and embedded editor | Full visual contract requires visible Strudel source code |
| Tone.js audio | Polished audio shell with tempo-synced visualizer and generated playback control | Full visual contract requires audio shell, tempo sync, and playable control |
| Revideo | Browser-visible rendered timeline shell plus source details | Full visual contract requires rendered timeline preview |
| HyperFrames | Composer mode and rendered composition/timeline preview shell | Studio mode selector includes HyperFrames; visual proof requires composition shell |
| ASCII art | Large monospace artifact stage | Full visual contract requires substantial text block area |
| Kinetic type | Composer mode and CSS animated HTML artifact | Registered generator; visual proof requires CSS animation |
| Text generative art | Large text-art card/stage | Full visual contract requires substantial text block area |
| Organism (Strudel + Hydra) | Dedicated paired music/visual preview | Full visual contract requires browser-visible canvas and source panel |
| Generic HTML backend support | Preserved internally for wrappers/backends, not exposed as a generic artist-facing mode | Studio create selector routes HTML/CSS requests to HyperFrames/Kinetic instead of generic HTML/CSS |

## T3Code patterns applied

- Chat/create surface stays the product center.
- Work logs and advanced settings remain collapsed and secondary.
- Rich artifacts render as inline/side previews instead of raw source-first blocks.
- HyperFrames, Revideo, Tone, Strudel, ASCII, Text, p5, and SVG all have polished preview shells/cards.
- Advanced/internal receipts stay available without dominating the artist-facing flow.

## Visual proof artifacts

- Studio UI screenshot: `.omx/proof/studio-full-output-ui/studio-home.png`
- Real Studio prompt preview: `.omx/proof/studio-real-prompt/preview-p5.png`
- Fixture full-output contact sheet: `.omx/proof/full-output-gauntlet-after/contact-sheet.png`
- Live GLM full-output contact sheet: `.omx/proof/live-full-output-gauntlet-visual/contact-sheet.png`
- Live GLM receipt: `.omx/proof/domain-gauntlet-live.json`

## Changed files

- `gui/server.js`
- `gui/src/gui/createModes.ts`
- `gui/src/gui/syncPreview.ts`
- `scripts/proof/visual-output-preview-contract.ts`
- `src/core/wrappers/GenericWrapper.ts`
- `src/generators/registerGenerators.ts`
- `src/utils/htmlWrapper.ts`
- `test/core/wrappers/GenericWrapper.test.ts`
- `test/integration/gui-security-regression.test.js`
- `test/scripts/visual-output-preview-contract.test.ts`
- `test/unit/generators/confidence-functions.test.ts`
- `test/unit/generators/registerGenerators.test.ts`
- `test/unit/gui-create-modes.test.ts`
- `test/unit/gui-sync-preview.test.ts`
- `test/utils/html-wrapper-security.test.ts`

## Verification evidence

- `npm run build`
- `pnpm --dir gui build`
- `npm run lint`
- Focused Vitest suite: 280 tests passed across GUI modes, generator registration, wrappers, and visual contract tests.
- `test/integration/gui-security-regression.test.js -t "preview HTML strips network APIs"`: 1 passed, 28 skipped by filter.
- `pnpm run proof:studio-smoke`
- `pnpm run proof:user-surfaces`
- `pnpm run proof:user-surface-controls`
- `pnpm run proof:user-surface-observability`
- `pnpm run proof:visual-output-previews -- --out .omx/proof/full-output-gauntlet-after`: 13 checked, 0 failures.
- `LIMINAL_LLM_PROVIDER=glm pnpm run proof:live-creative-domains -- --all --provider glm --timeout-ms 180000 --out .omx/proof/live-full-output-gauntlet`
- `pnpm run proof:visual-output-previews -- --input .omx/proof/domain-gauntlet-live.json --out .omx/proof/live-full-output-gauntlet-visual`: 13 checked, 0 failures.
- Real Studio prompt executed through `/api/run`: generated p5 code with `setup()`, `draw()`, and `createCanvas()`; preview rendered a centered 960×720 canvas with no browser errors.

## Integration note

During implementation, `origin/main` advanced twice. The branch was rebased onto `7d0912ed337b1c9d6c96d49671fe97c4fcae510a` before final verification. The other agent's merged work touched `src/chat/*` and `src/tui-bridge/*`; this branch touches GUI/output wrappers/generator registration/proof tests, so the final diff has no file overlap with that lane.

## Direct verdict

The Studio output surface is now complete for the artist-facing output matrix: every intended output type has a browser-visible proof path, HyperFrames and Kinetic are exposed as first-class creative modes, generic HTML is no longer the artist-facing destination, and proof/receipt details remain available without replacing the creative preview.
