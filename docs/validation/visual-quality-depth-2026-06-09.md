# Visual Quality Depth — three / glsl / hydra — 2026-06-09

Verify-and-deepen pass on the three visual domains (Worker U). Branch `fix/visual-quality-depth`.
Each was rendered via `node scripts/domains/gauntlet.mjs --domain <d>` and **graded by eye** (gauntlet
PASS is not enough). Lane: `src/generators/{shader,hydra,three}` + `src/core/validators/{GLSL,Hydra,Three}*`
+ tests only.

## three — partial-frame regression → FIXED
**Found by eye:** the scene rendered only in the top-left ~⅔ with black margins (not full-frame).
**Root cause:** the generated code hard-coded `renderer.setSize(600, 400)` → a fixed 600×400 canvas in
the larger viewport.
**Fix (in-lane):** `ThreeGenerator` prompt now requires full-viewport sizing
(`renderer.setSize(window.innerWidth, window.innerHeight)` + camera aspect + resize handler), and
`validateOutput` rejects a fixed-pixel `setSize(N, M)` when no viewport dims are used (forces the retry
loop to regenerate full-frame). Unit-tested (rejects fixed, accepts viewport).
**Verified:** fresh render is full-frame — glossy pink torus-knot + gold orbital rings + pastel spheres
on light lavender, well-lit, no axis-cross, fills the entire frame.

## glsl — deepen attempt REGRESSED → REVERTED (no net change)
Attempted to deepen the shader (structure/contrast/composition via a prepended art prompt). It
**regressed**: the richer prompt pushed the LLM into a GLSL ES 1.00 violation — `ERROR: 'i' : Loop
index cannot be compared with non-constant expression` (non-constant `for` bounds) — failing the render.
Per "no regressions / don't churn," the deepening was **reverted**; glsl is back to its compiling
baseline (an acceptable marbled nebula with a focal center + vignette). **Recommendation:** deepening
glsl safely requires a constant-loop-bound guard (reject `for(...; i < <non-const>; ...)` → retry) in a
separate focused pass; the bare deepening prompt is unsafe.

## hydra — full-frame already fixed; washout NOT reliably fixable in-lane
The earlier top-left-quadrant bug is already resolved (#633 — renders full-frame). The real issue is
**washout / overbright** (near-white frames). **Prompt-tuning is proven insufficient** — objective mean
luminance across renders this session (washed ≥ ~0.8):

| prompt state | mean luminance of renders |
|---|---|
| baseline | 0.99 |
| + contrast prompt | 0.68, 0.89, 0.32, 0.99 |
| + rebalanced (mid-range) prompt | 0.94, 0.82, 0.89 |

The distribution stays wildly variable (0.32–0.99) regardless of prompt wording. Washout is a property
of the *rendered* output (osc/colour/blend luminance), which the generator cannot measure at codegen
time — so no in-lane (generator/validator) lever reliably clamps it.

**Shipped (partial mitigation, in-lane):** removed the prompt line that *forced* brightness ("at least
one .color() channel ≥ 0.8, avoid values below 0.3" — which actively caused washout) and replaced it
with a mid-range full-tonal-range instruction + an explicit contrast/darks requirement. This is genuine
better guidance and produced some good high-contrast renders (luminance 0.32, 0.68), but does NOT
guarantee non-washed output.

**Handoff (the real fix, out of lane):** a **rendered-luminance "too-bright" reject** — measure the
render's mean luminance and fail/regenerate when it exceeds a washout threshold (e.g. > ~0.85),
analogous to the #616 too-dark flag. This belongs in the gauntlet render path
(`scripts/domains/gauntlet.mjs`) or the render harness (`src/core/wrappers`) — both explicitly outside
this lane. Filed as a separate task. (Decision: user chose to ship the prompt mitigation + hand off the
deterministic reject.)

## Verification
- All three gauntlets PASS (`glsl | hydra | three` → PASS).
- Domain + validator unit tests: 1070 pass (incl. new three setSize-guard tests).
- `pnpm build` 0 TS errors · `pnpm lint` clean · `pnpm test:quality` 0 new warnings from touched files
  (10 reported are pre-existing main drift in gallery/loop tests, other lanes).
- Renders inspected by eye: three full-frame & good; glsl compiling nebula; hydra full-frame, washout
  intermittent (honest — handed off).

## Lane
Touched only `src/generators/{hydra,three}` + `test/unit/generators/ThreeGenerator.test.ts`. glsl
change reverted (no net diff). Did NOT touch `src/generators/{svg,kinetic,html}`, `scripts/domains`, or
`passing-domains.json`.
