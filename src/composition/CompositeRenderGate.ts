/**
 * CompositeRenderGate — measured quality gate for assembled compositions.
 *
 * The 2026-06 investor audit quantified a composite failure class that code
 * inspection cannot catch: stacked light-direction blends wash the frame to
 * near-white (dusk-bloom) or mud it toward black (reef-pulse) even when every
 * individual layer is good. The cure the hydra-washout investigation settled
 * on is RENDER MEASUREMENT: screenshot the assembled composite, read the
 * pixels, and act on what is actually on screen.
 *
 * The gate renders the composite headless, computes luminance statistics
 * in-page (a data-URL image drawn to a same-origin canvas — no native image
 * dependency), and when the frame measures washed-out or crushed-dark it
 * re-assembles ONCE with the offending blend modes demoted to 'normal' at
 * slightly reduced opacity — same generated art, safer compositing — keeping
 * whichever variant measures closer to a balanced frame. No regeneration, no
 * LLM calls, bounded wall-clock.
 */

import {
  DARK_LUMINANCE_THRESHOLD,
  BRIGHT_LUMINANCE_THRESHOLD,
  verdictFromMeasure as sharedVerdictFromMeasure,
  type LuminanceMeasure,
} from '../render/LuminanceVerdict.js';

export type CompositeMeasure = LuminanceMeasure;

export type CompositeVerdict = 'ok' | 'washout' | 'too-dark' | 'muddy';

export interface CompositeGateReport {
  verdict: CompositeVerdict;
  /** Absent only when the gate was skipped before measuring. */
  measure?: CompositeMeasure;
  /** Present when a remediation re-assembly was attempted. */
  remediation?: {
    /** Layer indexes whose blend mode was demoted to 'normal'. */
    demotedLayers: number[];
    verdictAfter: CompositeVerdict;
    measureAfter: CompositeMeasure;
    /** True when the demoted variant was kept as the final html. */
    applied: boolean;
  };
  /** Set when the gate could not run (e.g. puppeteer unavailable). */
  skipped?: string;
}

/** Blends that can only brighten the stack — the washout drivers. */
const LIGHTENING_BLENDS = new Set(['screen', 'lighten']);
/** Blends that can only darken the stack — the mud/crush drivers. */
const DARKENING_BLENDS = new Set(['multiply', 'darken']);
/** Direction-dependent blends: demoted for washout only (overlay brightened
 *  dusk-bloom past white; it rarely crushes a frame to black on its own). */
const WASHOUT_ALSO = new Set(['overlay']);

/**
 * Pick the NON-BASE layer indexes whose blend mode drives the failed verdict.
 * The base layer (index 0) is never demoted — it is the scene; remediating it
 * would replace the artwork rather than fix the compositing.
 */
export function layersToDemote(
  verdict: CompositeVerdict,
  blendModes: ReadonlyArray<string>,
): number[] {
  if (verdict === 'ok') return [];
  // Mud (flat mid-grey, no anchors) comes from semi-opaque layers averaging
  // each other toward the middle, not from one blend direction. Squeeze every
  // non-base layer (demote + reduced opacity) so the base layer's value
  // structure shows through; the spread comparison decides if it helped.
  const offending = verdict === 'muddy'
    ? () => true
    : verdict === 'washout'
      ? (mode: string) => LIGHTENING_BLENDS.has(mode) || WASHOUT_ALSO.has(mode)
      : (mode: string) => DARKENING_BLENDS.has(mode);
  const picks: number[] = [];
  for (let i = 1; i < blendModes.length; i++) {
    if (offending(blendModes[i])) picks.push(i);
  }
  return picks;
}

/** Opacity multiplier applied alongside a blend demotion: 'normal' at full
 *  opacity would hide the layers underneath; keep the layer translucent. */
export const DEMOTED_OPACITY_FACTOR = 0.75;

export function verdictFromMeasure(measure: CompositeMeasure): CompositeVerdict {
  const verdict = sharedVerdictFromMeasure(measure, { lowContrast: true });
  return verdict === 'low-contrast' ? 'muddy' : verdict;
}

/**
 * Measure an assembled composite's frame statistics in headless Chrome.
 * Pixel math runs in-page on a same-origin canvas fed by the screenshot's
 * data URL, so no native image library is required.
 */
export async function measureCompositeHtml(
  html: string,
  options: { width?: number; height?: number; settleMs?: number } = {},
): Promise<CompositeMeasure> {
  const { width = 900, height = 600, settleMs = 2500 } = options;
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    const shot = (await page.screenshot({ encoding: 'base64' })) as string;
    // Drift guard for the inlined browser-side copies of these thresholds
    // (page.evaluate cannot close over module scope).
    if (BRIGHT_LUMINANCE_THRESHOLD !== 0.5 || DARK_LUMINANCE_THRESHOLD !== 0.12) {
      throw new Error('CompositeRenderGate: inlined luminance thresholds diverged from LuminanceVerdict constants — update the page.evaluate copies');
    }
    return await page.evaluate(async (b64: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('screenshot decode failed'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2d context unavailable');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      let bright = 0;
      let dark = 0;
      let luma255Sum = 0;
      let luma255SumSq = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        // Inline rec601 luma: page.evaluate serializes this callback, so module
        // imports (luminanceFromRgb8) do not exist in browser scope — the gate
        // silently skipped on every composite from 5a158156 until this fix.
        const luma255 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const lum = luma255 / 255;
        sum += lum;
        luma255Sum += luma255;
        luma255SumSq += luma255 * luma255;
        // Inline thresholds for the same serialization reason (values pinned
        // to BRIGHT_LUMINANCE_THRESHOLD=0.5 / DARK_LUMINANCE_THRESHOLD=0.12 by
        // the assertion below this evaluate call).
        if (lum > 0.5) bright++;
        if (lum < 0.12) dark++;
      }
      const luma255Mean = luma255Sum / pixels;
      const brightnessStd = Math.sqrt(Math.max(0, luma255SumSq / pixels - luma255Mean * luma255Mean));
      return { meanLuminance: sum / pixels, brightFraction: bright / pixels, darkFraction: dark / pixels, brightnessStd };
    }, shot);
  } finally {
    await browser.close();
  }
}

export function gateEnabled(): boolean {
  return process.env.SINTER_COMPOSITE_GATE !== '0';
}
