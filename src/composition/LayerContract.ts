/**
 * Composition layer contract.
 *
 * Root cause of the showpiece layer seam (docs/validation/composition-seam-
 * investigation-2026-06-08.md): a non-base composition layer drew an OPAQUE
 * full-stage background (a p5 two-tone sky with a hard horizontal band), which
 * its blend then surfaced as a seam in the composite. The layers composite
 * correctly — the defect is that a FOREGROUND layer painted an opaque
 * background instead of drawing only its subject on a transparent canvas.
 *
 * The durable fix for the whole class: only the base layer (z=1) may render an
 * opaque full-stage background; every higher/foreground layer must render on a
 * TRANSPARENT canvas so the layers beneath show through. This module encodes
 * that contract in the per-layer generation prompt and provides a deterministic
 * guard that flags a foreground layer whose generated code violates it.
 */

import type { DomainType } from './types.js';

/** Appended to every NON-base layer's generation prompt. */
export const FOREGROUND_TRANSPARENCY_CONTRACT =
  'COMPOSITION FOREGROUND LAYER: this renders ABOVE other layers, so draw ONLY your subject on a ' +
  'FULLY TRANSPARENT canvas — the layers beneath must show through. Do NOT paint an opaque or ' +
  'full-canvas background: no solid background() fill, no full-size background rectangle, no opaque ' +
  'gradient sky. Any full-canvas fill creates a visible horizontal seam in the composite.';

/** Domain-specific transparency guidance appended after the general contract. */
const DOMAIN_TRANSPARENCY_HINT: Partial<Record<DomainType, string>> = {
  p5: ' For p5: call clear() each frame instead of background(); if you want fading trails use ' +
      'background() WITH a low alpha (e.g. background(0, 0, 0, 20)), never an opaque background().',
  shader: ' For shaders: output alpha 0 (or discard) for non-subject fragments; never write a fully ' +
          'opaque full-screen color.',
  hydra: ' For hydra: keep the output transparent where there is no subject (do not fill the frame ' +
         'with a solid source).',
  three: ' For three.js: use an alpha-enabled renderer with a transparent clear color ' +
         '(renderer.setClearColor(color, 0)); do not add an opaque full-screen background mesh.',
};

/**
 * Background contract for the BASE layer (audit F18): the base is the only
 * layer licensed to paint an opaque full-stage background, but the composition
 * spec already declared what that background should be — without this line the
 * generator never hears it, and the rendered composite inverts the spec
 * (paper-white spec'd → dark base painted, and vice versa).
 */
export function baseBackgroundContract(stageBackground: string): string {
  return 'COMPOSITION BASE LAYER: this is the bottom layer of a layered composite whose declared ' +
    `background color is ${stageBackground}. Paint your full-stage background at or visibly near ` +
    'that color — do not invert its lightness. Draw your subject so it reads against it.';
}

/**
 * Build a layer's generation prompt. The base layer (z=1) is allowed to render
 * an opaque full-stage background; when the composition declares a stage
 * background, the base layer is told to honor it (otherwise it is returned
 * unchanged). Every foreground layer gets the transparency contract (plus a
 * domain-specific hint) appended.
 */
export function buildLayerPrompt(
  basePrompt: string,
  opts: { isBase: boolean; domain: DomainType; stageBackground?: string },
): string {
  if (opts.isBase) {
    if (!opts.stageBackground) return basePrompt;
    return `${basePrompt}\n\n${baseBackgroundContract(opts.stageBackground)}`;
  }
  const hint = DOMAIN_TRANSPARENCY_HINT[opts.domain] ?? '';
  return `${basePrompt}\n\n${FOREGROUND_TRANSPARENCY_CONTRACT}${hint}`;
}

/**
 * Deterministic guard: true if a FOREGROUND layer's generated code paints an
 * opaque full-canvas background (violating the contract). Reliable for p5 (the
 * domain that caused the seam); returns false for domains whose source-level
 * opacity cannot be detected reliably (the prompt contract still applies there).
 */
export function paintsOpaqueBackground(code: string, domain: DomainType): boolean {
  if (domain !== 'p5') return false;

  // An opaque p5 background() has no alpha channel: 1 arg (grayscale/color) or
  // 3 args (r,g,b). 2 args (gray, alpha) or 4 args (r,g,b,a) carry alpha → translucent.
  const bgCalls = code.match(/\bbackground\s*\(([^)]*)\)/g) ?? [];
  const hasOpaqueBackground = bgCalls.some((call) => {
    const inner = call.slice(call.indexOf('(') + 1, call.lastIndexOf(')'));
    const args = inner.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    return args.length === 1 || args.length === 3;
  });

  // Full-width horizontal bands — rect(0, y, width, …) / line(0, y, width, …) —
  // are how a manual vertical-gradient background is painted (a per-row loop of
  // full-width strips). This is exactly how the showpiece seam was drawn (two
  // stacked gradients meeting at a hard line). A foreground layer should draw its
  // subject, not canvas-spanning bands. Subsumes the full-canvas rect(0,0,w,h) case.
  const hasFullWidthBand = /\b(?:rect|line)\s*\(\s*0\s*,[^,)]+,\s*(?:width|windowWidth)\b/.test(code);

  return hasOpaqueBackground || hasFullWidthBand;
}
