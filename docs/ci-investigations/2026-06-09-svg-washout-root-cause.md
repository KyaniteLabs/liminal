# SVG washout (near-white 0.740) — preview-wrapper false positive, fixed in the wrapper

**Date:** 2026-06-09
**Lane:** SVG visual-depth (worker: Ultracode Claude)
**Outcome:** Root-caused as a **preview-wrapper false positive** (not a generator defect) and
**fixed in `HTMLWrapper.wrapSVG`** by making the white preview card hug the SVG instead of
filling the frame. The SVG generator was left unchanged.

## Symptom

Fresh post-#654 gauntlet flagged `svg` as washed out:

```
[gauntlet] svg: FAIL (render-or-receipt: Render is washed out
  (mean gray: 193.8, color stdev: 104.8, near-white fraction: 0.740))
```

Trips `whiteFraction > WASHOUT_WHITE_FRACTION (0.70)` in
`scripts/quality/luminance.mjs:classifyRenderQuality`. The second washout clause
(`meanGray > thr && colorStdev < thr`) does not fire — `colorStdev ≈ 100` is high, i.e. there
*is* real content. Kimi's note ("NOT blank; white SVG padding triggers a false positive") was
correct.

## Root cause (visually confirmed)

The generated SVG is excellent, full-bleed dark art that already fills its own viewBox. The
render is 900×600 (`scripts/domains/gauntlet.mjs:407`). `HTMLWrapper.wrapSVG`
(`src/utils/htmlWrapper.ts`) rendered the SVG at ~432 px **centered inside a white card that
filled most of the frame** (`main { background:#ffffff; width:min(92vw,900px);
min-height:min(92vh,900px); padding:clamp(28px,5vw,72px) }`). The generic near-white detector
measured the **white card** (~0.74 of pixels, invariant to SVG content), not the art.

## Why this is NOT a generator-lane bug (proven, not assumed)

| variant (live gauntlet, GLM `glm-5v-turbo`, temp 0.7) | generate | render washout |
|---|---|---|
| baseline `main` | 3/3 | PASS 2/3 (intermittent FAIL 0.740) |
| richer "visual-depth" prompt (+ terminal SVG-only guard) | **0/7** | never rendered — model returned prose |
| minimal one-line "fill the frame" prompt | 3/4 | **0/3, still exactly 0.740** |

- The SVG already fills its own frame → a generator "fill the frame" instruction had **zero**
  effect (still exactly 0.740). The white was the wrapper card, which the SVG cannot touch.
- Prompt enrichment **regresses generation** on `glm-5v-turbo` (it narrates/plans instead of
  emitting raw `<svg>`); a terminal SVG-only output guard did not rescue it. Keep SVG prompts
  terse for this model.

## Fix applied

`HTMLWrapper.wrapSVG` `main`: oversized card → **hug-content card** (matches the existing
`scripts/proof/visual-output-preview-contract.ts` `.card` design):

```css
main {
  display: inline-grid;          /* was: width:min(92vw,900px); min-height:min(92vh,900px); display:grid */
  place-items: center;
  max-width: 92vw;
  max-height: 92vh;
  padding: clamp(14px, 2.5vw, 32px);   /* was clamp(28px,5vw,72px) */
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
}
```

The card now hugs the SVG; the dark-navy `body` background fills the margins instead of white.
**The SVG element sizing (`width:min(72vmin,760px)`) is unchanged**, so the two pinned preview
contracts stay green with no edits:
`test/utils/html-wrapper-security.test.ts:35` and
`scripts/proof/visual-output-preview-contract.ts:95`.

## Verification

- Wrapper-fix gauntlet ×4: **3/3 PASS** on the runs that generated (run 2 failed at the
  *generate* step — the known intermittent provider-prose flake, not a render issue).
- Exact near-white on the PASS render: **whiteFraction 0.740 → 0.075** (washout gate is 0.70 —
  large margin), colorStdev 64.2 (real content), render PASSED (no too-dark / blank flip).
- Visual: art-forward gallery framing; the dark art now dominates the frame inside a snug white
  card on the dark-navy field.
- `test/utils/html-wrapper-security.test.ts` 9/9 pass (contracts intact, no contract edits).
- `pnpm build` OK; `eslint src/utils/htmlWrapper.ts` clean.

## Explicitly NOT done (anti-slop)

- Did **not** lower the global washout threshold (`WASHOUT_WHITE_FRACTION = 0.70`) or change
  generic `classifyRenderQuality` logic.
- Did **not** inject a background plane / mangle the art to defeat the detector.
- Did **not** ship the prompt-enrichment changes — they regress generation on the configured
  model.
- Did **not** change the SVG element size, so the pinned preview contracts are untouched.

## Verification commands

```
node scripts/domains/gauntlet.mjs --domain svg            # ×4 after the fix → 3/3 generated PASS
pnpm vitest run test/utils/html-wrapper-security.test.ts  # 9/9
# rendered artifact inspected: .quality/gauntlet/<ts>-svg.png (dark art, snug white card, dark-navy field)
```
