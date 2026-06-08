/**
 * Blend brightness budget — prevents multi-layer composites from washing out to
 * near-white.
 *
 * Surfaced by the #619 caveat: the decomposer is told to put a "screen"/"lighten"
 * blend on every foreground layer "so it shows through", so a 3-4 layer work stacks
 * multiple additive (brightening) layers whose cumulative brightening blows the
 * composite out to white. Layers composite correctly — the defect is the blend
 * SELECTION stacking too many brightening layers.
 *
 * Fix: cap cumulative brightening across the layer stack. Each blend mode has a
 * brightening weight (per unit opacity); the cumulative budget allows roughly one
 * dominant brightening layer. Excess brightening layers are demoted to "normal" —
 * which is safe now that the transparent-layer contract (#619) makes foreground
 * layers draw only their (transparent) subject, so "normal" composites the subject
 * over the layers below WITHOUT adding brightness.
 */

import type { BlendMode, DomainType } from './types.js';

/** Minimal shape this module reasons about; extra fields are preserved by capLayerBrightness. */
export interface BudgetLayer {
  domain: DomainType;
  blendMode?: BlendMode;
  opacity?: number;
}

/**
 * Relative brightening contribution of each blend mode per unit opacity. Additive
 * modes push toward white; normal/multiply/darken do not. Difference/exclusion
 * invert rather than brighten toward white, so they score 0 for washout purposes.
 */
export const BLEND_BRIGHTNESS: Record<BlendMode, number> = {
  normal: 0,
  multiply: 0,
  screen: 1.0,
  overlay: 0.35,
  darken: 0,
  lighten: 0.85,
  difference: 0,
  exclusion: 0,
};

/**
 * Maximum cumulative brightening before a composite is at washout risk. ~1.0 is one
 * full-strength screen layer (the intended single glow over a dark base); the small
 * headroom (0.3) tolerates one extra faint brightening layer before capping.
 */
export const CUMULATIVE_BRIGHTNESS_BUDGET = 1.3;

/** Audio domains render invisibly (assembled at opacity 0) — they add no visual brightness. */
const AUDIO_DOMAINS = new Set<DomainType>(['tone', 'strudel', 'music']);

function brightnessOf(layer: BudgetLayer): number {
  if (AUDIO_DOMAINS.has(layer.domain)) return 0;
  const weight = BLEND_BRIGHTNESS[layer.blendMode ?? 'normal'] ?? 0;
  const opacity = layer.opacity ?? 1;
  return weight * opacity;
}

/** Total brightening contribution of a layer stack (audio layers excluded). */
export function cumulativeBrightness(layers: BudgetLayer[]): number {
  return layers.reduce((sum, layer) => sum + brightnessOf(layer), 0);
}

/** Guard: true if the stack's cumulative brightening exceeds the washout budget. */
export function exceedsWashoutBudget(layers: BudgetLayer[]): boolean {
  return cumulativeBrightness(layers) > CUMULATIVE_BRIGHTNESS_BUDGET;
}

/**
 * Cap cumulative brightening: walk layers in z-order (back-to-front); keep each
 * brightening layer while the running total stays within budget, and REDUCE the
 * opacity of any brightening layer that would exceed it so its contribution fits
 * the remaining budget. The additive blend (screen/lighten) is kept, not demoted:
 * additive blends never occlude (dark pixels stay transparent), whereas demoting to
 * "normal" would let an opaque layer black out everything beneath it. Non-brightening
 * and audio layers pass through untouched. Returns a new array (inputs not mutated).
 */
export function capLayerBrightness<T extends BudgetLayer>(layers: T[]): T[] {
  let running = 0;
  return layers.map((layer) => {
    if (AUDIO_DOMAINS.has(layer.domain)) return layer;
    const weight = BLEND_BRIGHTNESS[layer.blendMode ?? 'normal'] ?? 0;
    if (weight <= 0) return layer; // normal/darkening — unaffected
    const opacity = layer.opacity ?? 1;
    const contribution = weight * opacity;
    if (running + contribution <= CUMULATIVE_BRIGHTNESS_BUDGET) {
      running += contribution;
      return layer;
    }
    // Over budget: scale this layer's opacity down so its brightening fits the
    // remaining budget; keep the (non-occluding) additive blend.
    const remaining = Math.max(0, CUMULATIVE_BRIGHTNESS_BUDGET - running);
    // Floor (not round) to 3dp so the capped contribution can never round UP past the
    // remaining budget — guarantees cumulativeBrightness(result) <= the budget.
    const cappedOpacity = Math.floor(Math.min(opacity, remaining / weight) * 1000) / 1000;
    running = CUMULATIVE_BRIGHTNESS_BUDGET;
    return { ...layer, opacity: cappedOpacity };
  });
}
