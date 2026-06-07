# Sinter Creative-Quality Pass — 2026-06-07

Goal: stop asserting "it runs" and actually judge whether generated artifacts are **beautiful**, whether quality is consistent across domains, and whether domains **combine** well. Method: render real GLM-generated artifacts to PNG via headless Chrome and **look at them** (vision grading in the main agent — text-only subagents cannot judge images).

Tooling shipped (reusable): `pnpm quality:render` (render every domain artifact to PNG) and `pnpm quality:matrix` (compose & render background×foreground×audio combinations). Requires `npx puppeteer browsers install chrome`.

## Baseline finding (before)

Rendered all 12 domains. Quality was **inconsistent** and dominated by a **dark-background + neon-glow monoculture** with frequent contrast failures:
- **three.js**: dark cube on near-black → barely visible (dark-on-dark).
- p5 / shader / kinetic: pleasant but the same "glow on black" cliché.
- Genuinely good: hyperframes (landing page), svg (logo), textgen (concrete poetry).
- Root cause: **no aesthetic directive existed anywhere in prompt assembly** (`PromptBuilder`).

## WS-A — aesthetic diversity + contrast (verified win)

`src/llm/PromptBuilder.ts` now injects an `<aesthetics>` directive into every domain's prompt (flagship/medium/local tiers), tailored to visual/audio/text:
- **Palette diversity**: a curated palette family chosen stably per-request (warm sunset, cool mint, monochrome ink, terracotta, Bauhaus primaries, editorial, duotone, pastel, B&W+accent, jewel) — explicitly told NOT to default to dark+neon.
- **Bidirectional contrast (mandatory)**: background and subject must sit at opposite ends of the lightness scale — never dark-on-dark **or** light-on-light.
- **Composition**: deliberate focal point + negative space.

Verified by re-render (before → after):
- **three.js**: dark-on-dark cube → **terracotta cube on a cream sky over a lit plane with a soft shadow**. Big jump.
- **shader**: pink/purple cliché → warm sunset terracotta+teal topography.
- **p5**: first pass regressed to light-on-light (blank) → after strengthening the contrast rule to be bidirectional, **legible blue-green particles on a cream ground**.
- **svg**: clean professional "SINTER / CREATIVE CODE" logo (also confirms the prompt rebrand).
- All 54 prompt/generator test files (1631 tests) stay green.

## WS-C — three.js contrast (fixed via WS-A) + hydra render

- **three.js contrast**: fixed by WS-A's bidirectional contrast rule (verified above).
- **hydra**: the artifact code is valid and sophisticated and renders in real browsers; the headless harness quadrant-clips it (hydra-synth canvas sizing under swiftshader) — a **grading-tooling limitation**, not an artifact-quality defect.

## WS-B — combination matrix

`pnpm quality:matrix` composed 5 representative triples and rendered each. **All combined mechanically**; quality is **highly blend-mode dependent**:
- **tide-glass** (three + p5 `screen` + tone): teal glass spheres on a lit plane with glowing current-lines — cohesive and lovely.
- **paper-signal** (shader + ascii `normal`): coherent ASCII-over-field.
- **reef-pulse** (shader + p5 `multiply`): muddy — `multiply` darkened mid-tones into murk.
- **dusk-bloom** (p5 + shader `overlay`): washed out — two pastels + `overlay` = low-contrast (composition-level light-on-light).
- **ink-garden** (three + hydra `lighten`): vivid mandala + pyramid (hydra quadrant-clipped by the harness).

**Lever identified & addressed**: WS-A fixed contrast *within* a layer, but the composition decomposer chose blends without **inter-layer** contrast awareness. `CompositionOrchestrator.decomposePrompt` now instructs: prefer screen/lighten for bright-over-dark, `normal` for an opaque focal element, avoid multiply/overlay/darken unless layers differ clearly in lightness, give each layer a palette that contrasts the ones beneath, and keep one clear focal layer. *(Builds + tests pass; visual re-verification pending — the studio model, MiniMax, hit its 5-hour token limit mid-pass, resets 20:00 UTC.)*

## Honest verdict

- Quality is **materially improved and more diverse** (dark+neon monoculture broken; contrast fixed both directions; three.js fixed). Not yet uniformly "stunning" — it's a real creative tool with good-but-variable output.
- Domains **do combine**; combined beauty depends on blend/contrast discipline, now pushed into the decomposer.
- Beauty is iterative: this establishes the measurement loop (`quality:render`/`quality:matrix`) + the first verified improvement, not a one-shot guarantee.

Evidence renders: `.quality/renders/` (per-domain, before in `.quality/baseline/`) and `.quality/matrix/` (combinations).
