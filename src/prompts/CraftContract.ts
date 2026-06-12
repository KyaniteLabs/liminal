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
