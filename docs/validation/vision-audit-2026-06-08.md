# Vision Audit — 2026-06-08

First vision audit run through the new `pnpm quality:render-gallery` harness (PR #614).
Renders the newest gallery works to PNG and grades them **by looking** — the check
accumulation alone can't provide ("does the output actually get better / is it beautiful").

## Method
- `pnpm quality:render-gallery --count 6` → `.quality/renders/gallery/*.png`.
- Each work wrapped via the product `HTMLWrapper` with domain detection; interaction
  gates ("Click to start (audio)") auto-dismissed before screenshot.
- Graded in the main agent (vision); text-only subagents cannot see images.

## Findings

| Work (newest → oldest) | Render | Grade |
|---|---|---|
| `2026-06-07--tundra-aurora-resonance` (showpiece) | 251 KB | **Good** — layered teal aurora + starfield over a navy gradient; atmospheric, on-theme. Defect: visible **horizontal layer-compositing seam** (~y=100). |
| `2026-05-13--…242594` (shader) | 664 KB | Moody brown vortex/noise — real, but **too dark / low-contrast**, barely legible. |
| `2026-05-13--…283091` (shader) | 209 KB | Faint green radial star on near-black — **thin, underdeveloped, very dark**. |
| `2026-06-0{6,7,8}--cli-project` ×3 | ~7 KB blank | **Broken** — `ReferenceError/TypeError: bpm is not …`; defective gens or trivial test stubs. |

## Read of the "gets better" question
Weak positive signal only (tiny, mixed-domain sample): the newest real piece
(`tundra-aurora-resonance`) is markedly more developed than the older May-13 shader
works, which skew **too dark / low-contrast** — the recurring quality weakness. Not
conclusive proof of a rising trend; needs a larger, same-domain sample over more cron
cycles, re-run periodically.

## Follow-up triage (NOT fixed here — for a future session)
1. **`cli-project` gallery sketches are broken** (`bpm is not defined/a function`).
   Determine if these are real generation defects or test stubs; if real, fix the
   generator path or quarantine them from the gallery.
2. **Low-contrast / too-dark output** on shader works — connects to the existing
   contrast/visibility design rules and the creative-quality program (PromptBuilder
   bidirectional contrast). Candidate for a min-luminance/contrast guard in scoring.
3. **Composition layer seam** on the showpiece — the inter-layer compositing leaves a
   visible horizontal boundary; review the composition decomposer's layer blending.

## Harness notes
`render-gallery.mjs` complements `render.mjs` (fixed proof set). Prereqs: `dist/` built
(`HTMLWrapper`) and puppeteer Chrome installed (`npx puppeteer browsers install chrome`).
Known limitation: domain detection is heuristic; `--dir` can target a specific work.
