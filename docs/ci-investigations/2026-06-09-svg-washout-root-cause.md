# SVG washout (near-white 0.740) — root cause is the preview wrapper, not the generator

**Date:** 2026-06-09
**Lane:** SVG visual-depth (worker: Ultracode Claude)
**Outcome:** STOP + SURFACE — no change shipped in `src/generators/svg/`. The reported
SVG gauntlet washout is a **false positive from the render wrapper**, confirmed visually,
and is not fixable inside the SVG generator lane.

## Symptom

Fresh post-#654 gauntlet flags `svg` as washed out:

```
[gauntlet] svg: FAIL (render-or-receipt: Render is washed out
  (mean gray: 193.8, color stdev: 104.8, near-white fraction: 0.740))
```

Trips `whiteFraction > WASHOUT_WHITE_FRACTION (0.70)` in
`scripts/quality/luminance.mjs:classifyRenderQuality`. The second washout clause
(`meanGray > thr && colorStdev < thr`) does **not** fire — `colorStdev ≈ 100` is high,
i.e. there *is* real content. Kimi's visual note ("NOT blank; white SVG padding triggers a
false positive") is correct.

## Root cause (visually confirmed)

The generated SVG art is excellent and **already full-bleed dark** — it paints its own
viewBox edge-to-edge (a concentric neon "observatory" on a near-black field). The render is
900×600 (`scripts/domains/gauntlet.mjs:407` viewport, no `fullPage`).

The white comes entirely from the **preview wrapper**, `HTMLWrapper.wrapSVG`
(`src/utils/htmlWrapper.ts`):

- `main { background:#ffffff; width:min(92vw,900px); min-height:min(92vh,900px);
  padding:clamp(28px,5vw,72px) }` — a large **white card** that nearly fills the 900×600 frame.
- `svg { width:min(72vmin,760px); max-height:82vh; height:auto }` — the SVG renders at only
  **~432 px**, centered, with white card padding around it.

So the dark art occupies ~35% of the frame; the surrounding **white card is ~0.74 of the
pixels**, invariant to SVG content. The generic near-white detector measures the white card,
not the art.

## Why no SVG-generator-lane change can fix it

| Attempt (gauntlet, GLM `glm-5v-turbo` @ z.ai, temp 0.7) | generate | render washout |
|---|---|---|
| **Baseline `main`** (×3) | **3/3** | FAIL 0.740 ×1, **PASS ×2** (intermittent) |
| **Verbose depth prompt** (layered bg/mid/fg + shading direction; ×3, +terminal "SVG-only" guard ×4) | **0/7** | never rendered — model returned prose / 1 timeout |
| **Minimal one-line frame-fill** ("paint a background plane filling the viewBox"; ×4) | **3/4** | **0/3 — all exactly 0.740 FAIL** |

Conclusions:
1. **The SVG already fills its own frame** → a generator "fill the frame" instruction has
   *zero* effect (still exactly 0.740). The white is the wrapper card, which the SVG cannot
   touch.
2. **Prompt enrichment regresses generation** on `glm-5v-turbo`: richer art-direction makes
   the model narrate/plan instead of emitting raw `<svg>` (0/7), and a terminal SVG-only
   output guard did not rescue it.
3. The washout is **intermittent on baseline** (PASS 2/3) — not a deterministic generator
   defect; it depends on how light the art happens to render inside the white card.

## Recommended fix (out of the SVG generator lane — owner decision)

The fix belongs to the **preview wrapper**, which is a contracted, tested artifact — changing
it is a presentation decision affecting *every* SVG preview, so it needs the wrapper owner /
orchestrator, not the SVG-depth worker:

- **Enlarge the SVG to fill the card** in `HTMLWrapper.wrapSVG` (`src/utils/htmlWrapper.ts`),
  and/or stop surrounding dark art with a large near-white field. A square SVG filling the
  card height (~528 px) drops near-white from ~0.74 to ~0.33 — comfortably under the 0.70 gate
  — while keeping the white card for light/logo SVGs.
- This also requires updating the two places that **pin the preview-shell dimensions**:
  - `test/utils/html-wrapper-security.test.ts:35` — pins `width: min(72vmin, 760px)`
  - `scripts/proof/visual-output-preview-contract.ts:95` — duplicate preview-shell CSS

Alternative (also out of lane): **SVG-specific** washout measurement that scores the SVG's
content region rather than the framed white page. Must not alter the generic
`classifyRenderQuality` logic or lower global thresholds.

## Explicitly NOT done (anti-slop)

- Did **not** lower the global washout threshold (`WASHOUT_WHITE_FRACTION = 0.70`) or touch
  generic render-quality detection.
- Did **not** inject a background plane / mangle the art to defeat the detector — that games a
  false positive instead of fixing presentation.
- Did **not** ship the prompt-enrichment changes — they regress generation on the configured
  model.

## Verification commands used

```
node scripts/domains/gauntlet.mjs --domain svg     # repeated ×3–4 per variant
# rendered artifact inspected: .quality/gauntlet/<ts>-svg.png (full-bleed dark art, small, on white card)
```
