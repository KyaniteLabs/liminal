# Visual Domain Quality (M3) — glsl / hydra / three — 2026-06-08

Drove three visual domains from broken/mediocre to gauntlet-PASS with genuine quality. Branch
`fix/visual-domain-quality`. Lane: `src/generators/{glsl,hydra,three}` + `src/core/validators/{GLSL,Three}*`
+ tests only.

## Gauntlet before → after (`node scripts/domains/gauntlet.mjs --domain <d>`)

| Domain | Before | After |
|--------|--------|-------|
| glsl | `PASS | PASS | FAIL` — render: `Shader compile error: 'endif' unexpected #endif without a matching #if` | **`PASS | PASS | PASS`** |
| hydra | `FAIL` — validate: `code too small (103B < 150B)` | **`PASS | PASS | PASS`** |
| three | `PASS` but mediocre render (debug axis-cross + dark/murky) | **`PASS`**, improved render |

## glsl — orphan `#endif` at render (FIXED)
**Root cause (reproduced + traced):** the *generated* shader was valid (`#ifdef GL_ES`/`precision`/`#endif`
balanced), but the WebGL1 render harness (`GenericWrapper`, out of lane) **strips the `#ifdef GL_ES`
opener and leaves the `#endif`**, orphaning it (`precision mediump float;\n#endif` → compile error).
**In-lane fix:** `ShaderGenerator.sanitizeShaderCode` now collapses any `#ifdef GL_ES … precision …; …
#endif` guard to a bare `precision` line, so no guard survives for the harness to mangle. Also added a
defensive `GLSLValidator.validatePreprocessor` (depth-counter) that rejects unbalanced `#if/#endif`
(catches genuinely-malformed generated preprocessor at the validate step).
**Vision:** compiles to a clean kaleidoscopic mandala — intentional, not blank/error.

## hydra — too-thin patch (FIXED, generator-side)
**Root cause:** the generator emitted a 103B one-liner that passed structural validation but failed the
(reasonable) 150B `HydraValidator` size floor at the gauntlet's validate step. **In-lane fix:**
strengthened the `HydraGenerator` prompt to demand a rich, layered patch (2-3 sources + several
transforms + 8+ chained ops, 150+ chars). (The 150B `HydraValidator.getMinSize()` floor is reasonable
and left unchanged. A `validateOutput` size-floor was tried but reverted — it broke 21 existing tests
asserting short structurally-valid patches; the prompt is the correct lever, the CodeValidator gate is
the enforcement.)
**Result:** the generated patch is now substantial and well-formed (e.g. `osc(8,0.15,2).kaleid(5)
.modulate(voronoi(4,0.3,0.25),0.6).rotate(…).scale(1.08).color(…).brightness(1.15).saturate(1.3).out(o0)`),
gauntlet PASS.
**Honest caveat (out of lane):** the headless RENDER shows a canvas-sizing/timing artifact (a blown
white box top-left) originating in the hydra render harness (`canvas.width=1280` in a smaller viewport
+ regl/DPR/screenshot-timing) — NOT the patch and NOT `src/generators/hydra`. Flagged for the harness
owner; the substance fix this lane owns is delivered.

## three — debug axis-cross + dark/murky (IMPROVED)
**In-lane fixes:** (1) `ThreeGenerator` prompt forbids debug helpers/gizmos and demands strong, well-
exposed lighting (AmbientLight + DirectionalLight/PointLight, intensity ~1.0-2.5); (2)
`ThreeGenerator.validateOutput` rejects any `THREE.*Helper` (debug gizmo) so the retry loop regenerates
without an axis-cross; (3) `ThreeValidator` flags the guaranteed-dark case — a lit material
(MeshStandard/Physical/Phong/Lambert/Toon) with no light added (precise: unlit MeshBasic scenes are not
flagged).
**Vision:** a glossy copper torus-knot, clearly lit with specular highlights (no longer dark/murky),
orbiting spheres + ring on dark navy. No 3-axis debug cross (a single diagonal element is intentional
geometry; an `AxesHelper` would now be rejected + regenerated).

## Verification (evidence)
- Domain unit tests: GLSL/Hydra/Three validators + Shader/Hydra/Three generators — **129 pass** (incl.
  new: GLSL preprocessor balance, ShaderGenerator GL_ES collapse, ThreeValidator lit-no-light,
  ThreeGenerator `*Helper` reject).
- Regression (CodeValidator + composition + all validators): **939 pass**, no regression.
- `pnpm build` 0 TS errors · `pnpm lint` clean · `pnpm test:quality` 0 new warnings from touched files
  (10 reported are pre-existing main drift in gallery/loop tests, other lanes).
- All three gauntlets PASS; renders inspected by eye (glsl + three genuinely good; hydra patch
  substantial, render-harness artifact flagged).

## Lane
Touched only `src/generators/{glsl,hydra,three}` + `src/core/validators/{GLSL,Three}*` + their tests.
Did NOT touch `src/generators/{tone,strudel,kinetic,svg,html,textgen}`, `CodeValidator`,
`TextGenValidator`, `src/config`, `scripts/domains`, CI, or `bin/sinter`.
