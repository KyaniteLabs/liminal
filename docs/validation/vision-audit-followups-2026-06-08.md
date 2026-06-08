# Vision-Audit Follow-ups — 2026-06-08 (round 2)

Acting on the A–D follow-ups from `docs/validation/vision-audit-2026-06-08.md` (PR #614).
Baseline `main @ 9673b91b`: build 0 TS errors · lint clean · test:quality 0 new warnings
(~781 baseline) · coverage 78.4/68.4/81.8/79.3. Codex active on `fix/global-suite-proof-llm`
(P5GeneratorLLM hermeticity) — slices kept file-disjoint from it.

## A — cli-project gallery sketches render BLANK (`bpm is not defined`) — FIXED

**Root cause (not a generation defect, not test stubs):** the cli-project works are valid
**Strudel/Tidal live-coding MUSIC** (`bpm()`, `s("…").out()`, `note("…").out()`). The gallery
vision-audit renderer misclassified them as a **visual** domain and ran them in an HTML/p5/hydra
context → `bpm is not defined` → blank PNG. Both the renderer's local detector *and* the canonical
`CodeValidator.detectDomain` route them to **`hydra`**, because Strudel's `.shape()` (waveshaping) +
`.out()` trip the Hydra visual-source heuristic. You can't vision-grade music.

**Fix (surgical, in the audit harness only — file-disjoint from Codex):**
- Extracted `detectDomain` into `scripts/quality/detect-domain.mjs` and added an **audio** branch
  (decisive signal `bpm()/setcpm()/cps()`; or `s("..")/note("..")` mini-notation → `.out()` without a
  Hydra source), placed **before** the hydra check so the `.shape()`/`.out()` collision can't win.
- `render-gallery.mjs` now **skips** audio works (`SKIP (audio domain — not visually rendered)`)
  rather than producing false-broken renders. Skips don't count as failures.

**Evidence (`node scripts/quality/render-gallery.mjs --count 8`):**
```
2026-06-08--cli-project   SKIP (audio domain — not visually rendered)
2026-06-07--cli-project   SKIP (audio domain — not visually rendered)
2026-06-06--cli-project   ok 6KB          # a real p5 sketch — correctly NOT skipped
…  6 ok, 0 suspect/failed, 2 skipped (audio)   # 0 `bpm is not defined` errors
```
Regression test: `test/unit/quality/detect-domain.test.ts` (Strudel→audio, real Hydra→hydra,
p5→p5, shader→shader, svg→svg).

## B — too-dark / low-contrast output is invisible to the audit — FIXED (objective flag)

The recurring quality weakness (shader works "too dark / barely legible") was only catchable by the
grader's eyes. Added an **objective mean-luminance flag** to the harness so it's measured and
reproducible — **not** a generation/scoring change (avoids subjectivity + overlap with Codex's lane).

- `scripts/quality/luminance.mjs`: `relativeLuminance(r,g,b)` using the repo's canonical perceptual
  weights (`0.299R+0.587G+0.114B`, per `AccessibilityGuardrails`), and `DARK_LUMINANCE_THRESHOLD`.
- **Threshold 0.12 is calibrated against the rendered PNGs**, not arbitrary: the vision-confirmed
  "too dark" works measured 0.02–0.06; the acceptable showpiece 0.47; mid shader 0.19.
- `render-gallery.mjs` appends `DARK(lum=X.XX)` to a work's status when below threshold (sharp loaded
  lazily; the flag is honestly skipped, not faked, if sharp is unavailable).

**Evidence:** `…283091 ok 209KB DARK(lum=0.02)` · `…242594 ok 664KB DARK(lum=0.06)` flagged;
showpiece (lum 0.47) and `…080591` (lum 0.19) **not** flagged — exactly the calibrated separation.
Regression test: `test/unit/quality/luminance.test.ts`.

## C — composition layer seam (tundra-aurora-resonance) — INVESTIGATED, NOT FIXED

**Confirmed by eye** (rendered PNG): a hard horizontal boundary at ~y=100 where a dark-navy star band
(top) meets the lighter teal aurora region (below). **Root cause:** the showpiece is an
**iframe-layered composition** (`<iframe class="sinter-layer" … mix-blend-mode:normal; opacity:1;
z-index:…>`). With opaque normal-blend layers and no inter-layer feather (`LayerMask.feather` defaults
to 0), a layer whose content has a hard top/bottom edge produces a visible seam. The seam is **baked
into this generated artifact**.

**Why not fixed here (anti-slop):** a verifiable fix requires changing the composition assembler
(`LayerManager`/`CompositionEngine` layer styling/masks) **and** re-rendering compositions to confirm
by eye — composition regeneration is LLM-driven, non-deterministic, and needs a never-before-used
prompt. No clean deterministic test. **Recommendation (own session):** default a small inter-layer
feather/gradient mask at layer boundaries, or guarantee full-canvas base layers; validate by
re-rendering several compositions through `quality:render-gallery`.

## A′ — canonical `CodeValidator.detectDomain` misroutes Strudel→hydra — SURFACED, NOT TOUCHED

Real product bug: `CodeValidator.detectDomain` returns `hydra` for these Strudel works (Strudel
`.shape()` + `.out()` trips the Hydra source check at the `osc|src|…|shape` branch). This means audio
works are misrouted to a visual domain anywhere the product validates/scores them, not just in the
audit. **Deferred** because (1) broad blast radius (detectDomain feeds validation/scoring/generation),
and (2) Codex is actively editing the generator/validation neighborhood (`P5GeneratorLLM`). Proposed
fix once Codex lands: detect Strudel (`bpm()/setcpm()`, `s/note(..).out()` audio form) **before** the
hydra branch in `detectDomain`, mirroring the audit fix, with a full domain-detection test run.

## D — design-debt HIGHs — OUT OF SCOPE

Large refactors (god objects, circular deps, config consolidation) — HIGH blast radius, "no action
until pre-deploy." The one in-scope sliver — a **duplicate `detectDomain`** in `render-gallery.mjs`
vs the canonical one — is reduced by A (extracted to a shared, tested module).

## Escalations (surface + recommend; not mutated)
- **Evaluator offline** (NUCBOX qwen `100.113.174.74:4000`) → honest-degraded scoring. Restore =
  repoint `evaluator`→`glm` in `~/.sinter/config.json` (user).
- **`sinter-self-improve` cron** still absent — leave until evaluator restored.

## Agent-system note
Spawned review subagents (`oh-my-claudecode:*`) resolve to `glm-5.1`, unreachable here (runtime =
Anthropic Opus 4.8) — code review done as a structured in-context pass + the /code-review skill.
