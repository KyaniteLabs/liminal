/**
 * CraftContract — the generation-side mirror of the judge's rubric bands.
 *
 * The 2026-06-12 archive rescore showed every domain's top work scoring
 * 0.72–0.88 under honest banded judging: competent, never exhibition-grade.
 * The generation prompts asked for "a sketch of X" and hoped; none demanded
 * the dimensions the 0.90 band requires. This contract states those demands
 * once, for every domain, in both prompt tiers. Generate TO the rubric.
 */

/** Full contract — flagship/medium generation tiers. */
export const CRAFT_CONTRACT = `<craft_contract>
This work must reach exhibition grade, not merely run. Hard requirements:
- COMPOSITION: one dominant focal point or a deliberately structured field — never uniform scatter. Use asymmetry, grouping, or leading lines to direct the eye.
- DEPTH: at least two distinct spatial layers (foreground/background) expressed through scale, overlap, blur, or value separation.
- LIGHT & VALUE: a designed value structure — dark anchors, mid tones, and reserved highlights. Contrast is a tool, not an accident; avoid uniform brightness.
- PALETTE: at most 3 related hues plus 1 accent, with a clear dominance hierarchy. Name the palette in a comment before using it.
- MOTION (if animated): eased, purposeful movement with rhythm and rest — no constant-velocity drift, no uniform global pulsing.
- NEGATIVE SPACE: leave deliberate emptiness; crowding every region reads as noise.
- FINISH: one refinement detail a viewer discovers late (a texture, a secondary motion, an echo of the focal form).
The bar: a curator would hang this. Competent-but-flat is a failure.
</craft_contract>`;

/** Compact contract — local/tiny generation tiers (small models). */
export const CRAFT_CONTRACT_COMPACT = `<craft_contract>
Exhibition grade required:
- One focal point; structured composition (no uniform scatter).
- Two depth layers (scale/overlap/value).
- Designed contrast: dark anchors + reserved highlights.
- Max 3 hues + 1 accent.
- If animated: eased, purposeful motion.
</craft_contract>`;

/**
 * SVG-specific contract — keeps the craft intent but is worded for a domain whose
 * validator requires a raw `<svg>...</svg>` document and no markdown/prose.
 */
export const SVG_CRAFT_CONTRACT = `<craft_contract domain="svg">
Exhibition-grade SVG, delivered as a raw <svg>...</svg> document only.
- ROOT: output must start with <svg and end with </svg>. No markdown fences, no prose, no HTML wrappers, no text outside the root element.
- COMPACT FIRST: the design must be small enough to close the </svg> tag. Prefer 8-14 purposeful visible elements. If a detailed plan does not fit, simplify shapes rather than truncate.
- COMPOSITION: one dominant focal point or a deliberately structured field; use asymmetry, grouping, or leading lines.
- DEPTH: at least two distinct spatial layers (foreground/background) via scale, overlap, or value separation.
- LIGHT & VALUE: dark anchors, mid tones, and reserved highlights; avoid uniform brightness.
- PALETTE: at most 3 related hues plus 1 accent. Put any palette note in an XML comment inside <defs>.
- MOTION (if animated): eased, purposeful movement with rhythm and rest.
- NEGATIVE SPACE: leave deliberate emptiness.
- FINISH: one small refinement a viewer notices on second look.
The bar: a curator would hang this. A complete simple SVG beats an unfinished detailed one.
</craft_contract>`;

/** SVG-specific compact contract — local/tiny tiers. */
export const SVG_CRAFT_CONTRACT_COMPACT = `<craft_contract domain="svg">
Raw <svg>...</svg> document only — no fences, no prose, no text outside the root.
Keep it compact (8-14 visible elements) and always close </svg>.
Exhibition grade:
- One focal point; structured composition.
- Two depth layers (scale/overlap/value).
- Designed contrast: dark anchors + reserved highlights.
- Max 3 hues + 1 accent; palette note (if any) inside <defs>.
- If animated: eased motion.
</craft_contract>`;

/**
 * Hydra-specific contract — keeps the craft intent but is worded for a domain
 * whose validator rejects any chained method or math function whose name ends
 * in `.sin(`, `.cos(`, `.tan(`, `.sqrt(`, `.abs(`, `.pow(`, `.saturation(`,
 * `.feedback(`, `.kaleidoscope(`, `.colorShift(`, `.post(`, `.screen(`, or
 * `.output(` — including valid `Math.sin(time)` calls (the validator's
 * substring check matches `.sin(` inside `Math.sin(`). Time-varying values
 * MUST come from Hydra's built-in animation args (`.rotate(angle, speed)`,
 * `.scrollX(speed)`, `osc(freq, sync, offset)`, …) or from source values
 * like `osc()`/`noise()` chained via `.modulate()`/`.blend()`/`.add()`.
 */
export const HYDRA_CRAFT_CONTRACT = `<craft_contract domain="hydra">
Exhibition-grade Hydra live-coding patch, delivered as a raw executable Hydra chain.
- ROOT FORMAT: output ONLY raw Hydra code. No markdown fences, no prose, no comments explaining the code, no JSON, no "Here is..." preambles. End every rendered chain with .out(o0) and a trailing render(o0); so the headless preview shows a full-frame image.
- NEVER use Math.* — the validator's substring check rejects any code containing .sin(, .cos(, .tan(, .sqrt(, .abs(, .pow(, .saturation(, .feedback(, .kaleidoscope(, .colorShift(, .post(, .screen(, or .output(, and that includes Math.sin(, Math.cos(, Math.tan(, Math.abs(, Math.sqrt(, Math.pow( inside arrow functions. Don't reach for math at all — Hydra is time-driven through its own transform args.
- NEVER chain source or math methods: no .sin(, .cos(, .tan(, .sqrt(, .abs(, .pow(, .osc(, .noise(, .shape(, .voronoi(, .gradient(, or .solid( as a chained method (use .add(osc(...)), .blend(noise(...)), .modulate(osc(...)) or a fresh top-level chain instead).
- SOURCES: start every chain with a top-level source call — osc(freq, sync, offset), noise(scale, offset), shape(sides, radius, smoothing), voronoi(scale, smoothness, seed), gradient(speed), or solid(r, g, b).
- TIME / ANIMATION: use Hydra's built-in animation args instead of math — .rotate(angle, speed), .scrollX(speed), .scrollY(speed), or a dynamic speed-style numeric in .scale/.rotate. Pass time only as a numeric value inside osc()/noise() rate args, never wrapped in Math.*.
- COMBINING: layer and modulate at least two generated visual sources per patch with .blend(src, 0.25-0.45), .add(src, 0.25-0.4), .modulate(src, 0.15-0.4), .mult(src), or .diff(src). A single-source patch will be rejected as blank in headless proof.
- CONTRAST: include .color(r, g, b) or .colorama(...) on the rendered chain and keep the three numeric channels between 0.0 and 1.0. Pair with .contrast(1.3-1.7) and a gentle .brightness(0.2-0.45) lift — hydra brightness() is ADDITIVE (rgb + amount), so anything above ~0.5 erases every dark and washes the frame to fog. The frame must span a wide luminance range with deep darks AND bright highlights — never uniform bright, never milky white, never solid black.
- NO CAMERA / SCREEN: do not use s0.initCam(), s0.initScreen(), src(s0), or any camera/screen/video/image input — the headless preview cannot grant those permissions and will render blank.
- CHAIN BREADTH: aim for 8+ chained operations and 150+ characters of substance per patch, combining 2-3 sources with .color()/.colorama(), .modulate(), .rotate(), .scale(), .kaleid(), .repeat(), .blend(), .add(), or .diff() using deliberate numeric parameters.
- COMPOSITION: one dominant focal element (kaleidoscope, repeated motif, or modulated source) with deliberate asymmetry, not a uniform flat field.
- DEPTH: at least two spatial layers — a base source and one modulated/layered/blended source on top, expressed through scale, opacity, or value separation.
- LIGHT & VALUE: designed contrast — dark anchors (e.g. solid(...) base or low .brightness) and reserved bright highlights (e.g. .contrast() with a single .color() accent). Avoid uniform brightness across the frame.
- PALETTE: at most 3 related hues plus 1 accent, expressed numerically in .color() and .colorama(). Aim for an intentional palette (warm, cool, monochrome, duotone, jewel, etc.) — not the default neon glow.
- MOTION: eased/purposeful movement — use Hydra's rate args (.rotate(0, 0.1), .scrollX(0.05), osc(4, 0.05, 1.0)) for rhythm and rest, not constant-velocity drift.
- FINISH: one refinement detail (a kaleid() focal count, a .pixelate() block, a .thresh() cut, a second modulated source, or a .posterize() step) a viewer notices on second look.
The bar: a curator would hang this. A rich, contrast-correct Hydra chain beats a one-liner that the validator rejects.
</craft_contract>`;

/** Hydra-specific compact contract — local/tiny tiers. */
export const HYDRA_CRAFT_CONTRACT_COMPACT = `<craft_contract domain="hydra">
Raw Hydra chain only — no fences, no prose, no Math.* calls, no .sin(/.cos(/.tan(/.sqrt(/.abs(/.pow( anywhere (validator substring check rejects them, including inside Math.sin(time)). No camera/screen input. End with .out(o0) and render(o0);.
Use Hydra's time args: .rotate(angle, speed), .scrollX(speed), .scrollY(speed), osc(freq, sync, offset).
At least 2 sources combined with .blend(..., 0.25-0.45), .add(..., 0.25-0.4), or .modulate(..., 0.15-0.4). Include .color() and .contrast(1.3-1.7) and a gentle .brightness(0.2-0.45) lift (brightness is additive — above ~0.5 washes the frame to fog) so the frame spans dark + bright.
Exhibition grade: one focal element, two depth layers, designed contrast, 3 hues + 1 accent, eased motion via rate args.
</craft_contract>`;
