/**
 * CompositionOrchestrator — the end-to-end "combine outputs" path.
 *
 * Sinter's core is not just generating single-domain pieces; it is *layering*
 * them into mixed works. The pieces existed (per-domain generators + the
 * composition engine/adapters/blendModes) but nothing connected them: there was
 * no way to take a layer spec, generate each layer, and assemble one runnable
 * layered artifact.
 *
 * This orchestrator does exactly that:
 *   1. generate each layer's code via the existing generator registry, and
 *   2. assemble the layers into a single standalone HTML where each layer is an
 *      isolated full-stage iframe stacked by z-order with a CSS blend mode and
 *      opacity (so a shader background, p5 particles, and a Tone.js audio bed
 *      can play together as one work).
 *
 * Iframes give each layer its own global scope (p5/THREE/hydra all define
 * colliding globals) and `mix-blend-mode` on the iframe element blends it with
 * the layers behind it.
 */

import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import { registerAllGenerators } from '../generators/registerGenerators.js';
import { HTMLWrapper, type Domain as WrapDomain } from '../utils/htmlWrapper.js';
import type { DomainType, BlendMode } from './types.js';
import { buildLayerPrompt, paintsOpaqueBackground } from './LayerContract.js';
import { capLayerBrightness, exceedsWashoutBudget } from './BlendBudget.js';
import {
  measureCompositeHtml,
  verdictFromMeasure,
  layersToDemote,
  gateEnabled,
  DEMOTED_OPACITY_FACTOR,
  type CompositeGateReport,
} from './CompositeRenderGate.js';
import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';

/** One requested layer in a composition. */
export interface CompositionLayerSpec {
  /** Creative domain for this layer. */
  domain: DomainType;
  /** Prompt describing what this layer should be. */
  prompt: string;
  /** CSS blend mode used to composite this layer over the ones below it. */
  blendMode?: BlendMode;
  /** Layer opacity, 0..1. */
  opacity?: number;
}

/** A full composition request. */
export interface CompositionSpec {
  title?: string;
  /** CSS background for the stage behind all layers. */
  background?: string;
  layers: CompositionLayerSpec[];
}

export interface ComposedLayer {
  domain: DomainType;
  prompt: string;
  blendMode: BlendMode;
  opacity: number;
  codeLength: number;
  /** True if a generator produced code; false if the layer failed to generate. */
  generated: boolean;
  error?: string;
  /** True if a FOREGROUND layer painted an opaque full-canvas background (seam risk; contract violation). */
  opaqueBackground?: boolean;
  /** True when the seam guard ACTED on an opaqueBackground foreground layer
   *  (forced its blend to a brightening mode so its opaque band no longer
   *  hard-occludes the layers beneath). */
  seamGuarded?: boolean;
}

export interface CompositionResult {
  html: string;
  title: string;
  layers: ComposedLayer[];
  /** Layers that generated successfully. */
  successCount: number;
  /** Measured-frame gate report (washout/crush detection + blend remediation).
   *  Absent when the gate is disabled or no visual layer generated. */
  renderGate?: CompositeGateReport;
}

/** Domains that produce audio rather than a visual — they need a start gesture. */
const AUDIO_DOMAINS = new Set<DomainType>(['tone', 'strudel', 'music']);

/** Map a composition DomainType to its generator-registry entry name. */
const DOMAIN_TO_ENTRY: Record<string, string> = {
  p5: 'p5',
  three: 'three',
  shader: 'shader',
  tone: 'tone',
  music: 'tone',
  strudel: 'strudel',
  hydra: 'hydra',
  ascii: 'ascii',
  html: 'html',
};

/** Map a composition DomainType to the HTMLWrapper Domain. */
const DOMAIN_TO_WRAP: Record<string, WrapDomain> = {
  p5: 'p5',
  three: 'three',
  shader: 'shader',
  tone: 'tone',
  music: 'tone',
  strudel: 'strudel',
  hydra: 'hydra',
  ascii: 'ascii',
  html: 'html',
};

export class CompositionOrchestrator {
  /**
   * Generate every layer and assemble a standalone layered HTML document.
   * Layers are generated concurrently; failures degrade gracefully (the layer
   * is dropped from the stack but recorded in the result).
   */
  static async compose(spec: CompositionSpec): Promise<CompositionResult> {
    if (!spec.layers || spec.layers.length === 0) {
      throw new Error('CompositionOrchestrator: spec must contain at least one layer');
    }
    await registerAllGenerators();

    const title = spec.title ?? 'Sinter Composition';
    const results = await Promise.all(
      spec.layers.map((layer, index) => this.generateLayer(layer, index, spec.background)),
    );

    const html = this.assemble(title, spec.background ?? '#000', results, results.map(r => r.code));

    // Measured-frame gate: what is actually ON SCREEN decides, not the spec.
    // Washed-out or crushed frames get one blend-demoted re-assembly (same
    // generated art, safer compositing); the better-measuring variant wins.
    let finalHtml = html;
    let renderGate: CompositeGateReport | undefined;
    const hasVisualLayer = results.some(r => r.generated && r.code && !AUDIO_DOMAINS.has(r.spec.domain));
    if (gateEnabled() && hasVisualLayer) {
      const gated = await this.runRenderGate(title, spec.background ?? '#000', results, html);
      finalHtml = gated.html;
      renderGate = gated.report;
    }

    const layers: ComposedLayer[] = results.map((r) => ({
      domain: r.spec.domain,
      prompt: r.spec.prompt,
      blendMode: r.spec.blendMode ?? 'normal',
      opacity: r.spec.opacity ?? 1,
      codeLength: r.code.length,
      generated: r.generated,
      error: r.error,
      opaqueBackground: r.opaqueBackground,
      seamGuarded: r.seamGuarded,
    }));

    return { html: finalHtml, title, layers, successCount: results.filter(r => r.generated).length, renderGate };
  }

  /**
   * Render-measure the assembled composite; on a washout/too-dark verdict,
   * demote the offending non-base blend modes to 'normal' (at reduced
   * opacity), re-assemble, and keep whichever frame measures better. Never
   * throws — a gate failure degrades to the unmeasured composite.
   */
  private static async runRenderGate(
    title: string,
    background: string,
    results: Array<{ spec: CompositionLayerSpec; code: string; generated: boolean; opaqueBackground?: boolean; error?: string }>,
    html: string,
  ): Promise<{ report: CompositeGateReport; html: string }> {
    try {
      const measure = await measureCompositeHtml(html);
      const verdict = verdictFromMeasure(measure);
      if (verdict === 'ok') return { report: { verdict, measure }, html };

      const blendModes = results.map(r => (r.generated ? (r.spec.blendMode ?? 'normal') : 'normal'));
      const demote = layersToDemote(verdict, blendModes);
      if (demote.length === 0) {
        Logger.warn('CompositionOrchestrator', `[render-gate] ${verdict} frame (mean lum ${measure.meanLuminance.toFixed(2)}) but no demotable blend layer — keeping as-is`);
        return { report: { verdict, measure }, html };
      }

      const demoted = results.map((r, i) => (demote.includes(i)
        ? { ...r, spec: { ...r.spec, blendMode: 'normal' as BlendMode, opacity: (r.spec.opacity ?? 1) * DEMOTED_OPACITY_FACTOR } }
        : r));
      const retryHtml = this.assemble(title, background, demoted, demoted.map(r => r.code));
      const measureAfter = await measureCompositeHtml(retryHtml);
      const verdictAfter = verdictFromMeasure(measureAfter);
      // A muddy frame is already mid-luminance, so distance-from-0.5 cannot
      // judge the retry — the spread (brightnessStd) is what mud lacks.
      const applied = verdictAfter === 'ok'
        || (verdict === 'muddy'
          ? (measureAfter.brightnessStd ?? 0) > (measure.brightnessStd ?? 0)
          : Math.abs(measureAfter.meanLuminance - 0.5) < Math.abs(measure.meanLuminance - 0.5));
      Logger.info('CompositionOrchestrator', `[render-gate] ${verdict} (lum ${measure.meanLuminance.toFixed(2)}, std ${(measure.brightnessStd ?? 0).toFixed(1)}) → demoted layers [${demote.join(',')}] → ${verdictAfter} (lum ${measureAfter.meanLuminance.toFixed(2)}, std ${(measureAfter.brightnessStd ?? 0).toFixed(1)}); ${applied ? 'kept demoted variant' : 'kept original'}`);
      return {
        report: { verdict, measure, remediation: { demotedLayers: demote, verdictAfter, measureAfter, applied } },
        html: applied ? retryHtml : html,
      };
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : String(error);
      Logger.warn('CompositionOrchestrator', `[render-gate] skipped: ${message}`);
      return { report: { verdict: 'ok', skipped: message }, html };
    }
  }

  /**
   * Compose from a single natural-language idea: an LLM decomposes it into a
   * layer spec (which domains, what each layer is, blend modes), then the layers
   * are generated and assembled. This is the conversational entry to the
   * "combine outputs" capability.
   */
  static async composeFromPrompt(prompt: string, llm?: LLMClient): Promise<CompositionResult> {
    const spec = await this.decomposePrompt(prompt, llm);
    return this.compose(spec);
  }

  /** Use an LLM to turn a free-form idea into a validated CompositionSpec. */
  static async decomposePrompt(prompt: string, llm?: LLMClient): Promise<CompositionSpec> {
    const client = llm ?? new LLMClient({ role: 'studio' });
    const system =
      'You are a composition planner for a creative-coding studio. Break a creative idea ' +
      'into 2-4 visual/audio layers that stack into one piece. Reply with ONLY strict JSON ' +
      '(no markdown) of shape: {"title": string, "background": string (css color), "layers": ' +
      '[{"domain": one of ["shader","three","p5","hydra","ascii","html","tone","strudel"], ' +
      '"prompt": string, "blendMode": one of ["normal","screen","multiply","overlay","lighten","darken"], ' +
      '"opacity": number 0..1}]}. Order layers back-to-front (first = background). Put a background ' +
      'layer first (shader/three), foreground detail next (p5/ascii) with a "screen" or "lighten" ' +
      'blend so it shows through, and an optional audio layer (tone/strudel) last. ' +
      'CONTRAST BETWEEN LAYERS IS CRITICAL — the composite must stay legible, not muddy: ' +
      'use "screen"/"lighten" for bright detail over a DARK background, and "normal" (opacity ~1) ' +
      'for an opaque focal element; AVOID "multiply"/"overlay"/"darken" unless two layers have ' +
      'clearly different lightness, because they muddy or wash out similar-value layers. ' +
      'Give each layer prompt a deliberate palette that contrasts the layers beneath it, and pick a ' +
      'background color at the opposite lightness end from the foreground. The composite should have ' +
      'ONE clear focal layer with depth — never an even, low-contrast mush. ' +
      'Use a brightening blend ("screen"/"lighten") on AT MOST ONE foreground layer; any additional ' +
      'foreground layers must use "normal" — stacking multiple screen/lighten layers washes the ' +
      'composite out to white.';
    const res = await client.generate(system, `Idea: ${prompt}`);
    const spec = this.parseSpec(res.code ?? '', prompt);
    // Cap cumulative brightening so multiple stacked screen/lighten layers don't wash
    // the composite out to white (#619 caveat). Excess bright layers have opacity capped.
    if (exceedsWashoutBudget(spec.layers)) {
      const before = spec.layers.map((l) => l.opacity);
      spec.layers = capLayerBrightness(spec.layers);
      const capped = spec.layers.filter((l, i) => l.opacity !== before[i]).length;
      Logger.info('CompositionOrchestrator', `Washout guard: capped opacity on ${capped} over-budget bright layer(s)`);
    }
    Logger.info('CompositionOrchestrator', `Decomposed prompt into ${spec.layers.length} layers: ${spec.layers.map(l => l.domain).join(', ')}`);
    return spec;
  }

  /**
   * Parse and sanitize an LLM decomposition into a valid CompositionSpec.
   * Tolerant of markdown fences; clamps opacity, validates domains/blend modes,
   * and falls back to a single p5 layer if nothing usable is found.
   */
  static parseSpec(raw: string, originalPrompt: string): CompositionSpec {
    const validDomains = new Set<DomainType>(Object.keys(DOMAIN_TO_ENTRY) as DomainType[]);
    // The full BlendMode union — 'difference'/'exclusion' are valid CSS mix-blend
    // modes (supported by blendModes.ts + the BlendBudget table) and must NOT be
    // silently dropped to 'normal'; dropping them loses a deliberate creative choice.
    const validBlends = new Set<BlendMode>(['normal', 'screen', 'multiply', 'overlay', 'lighten', 'darken', 'difference', 'exclusion']);
    let parsed: unknown;
    try {
      const json = raw.replace(/^[\s\S]*?```(?:json)?/i, '').replace(/```[\s\S]*$/i, '').trim() || raw.trim();
      const start = json.indexOf('{');
      const end = json.lastIndexOf('}');
      parsed = JSON.parse(start >= 0 && end > start ? json.slice(start, end + 1) : json);
    } catch {
      parsed = null;
    }
    const obj = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
    const rawLayers = Array.isArray(obj.layers) ? obj.layers : [];
    const layers: CompositionLayerSpec[] = [];
    for (const l of rawLayers) {
      if (!l || typeof l !== 'object') continue;
      const r = l as Record<string, unknown>;
      const domain = String(r.domain || '').toLowerCase() as DomainType;
      if (!validDomains.has(domain)) continue;
      const blend = String(r.blendMode || 'normal').toLowerCase() as BlendMode;
      const opacityNum = typeof r.opacity === 'number' ? r.opacity : Number(r.opacity);
      layers.push({
        domain,
        prompt: typeof r.prompt === 'string' && r.prompt.trim() ? r.prompt.trim() : originalPrompt,
        blendMode: validBlends.has(blend) ? blend : 'normal',
        opacity: Number.isFinite(opacityNum) ? Math.min(1, Math.max(0, opacityNum)) : 1,
      });
    }
    if (layers.length === 0) {
      // Decomposition failed — degrade to a single sketch of the whole idea.
      layers.push({ domain: 'p5', prompt: originalPrompt, blendMode: 'normal', opacity: 1 });
    }
    return {
      title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Sinter Composition',
      background: typeof obj.background === 'string' && obj.background.trim() ? obj.background.trim() : '#05070f',
      layers,
    };
  }

  private static async generateLayer(
    spec: CompositionLayerSpec,
    index: number,
    stageBackground?: string,
  ): Promise<{ spec: CompositionLayerSpec; code: string; generated: boolean; error?: string; opaqueBackground?: boolean; seamGuarded?: boolean }> {
    const entryName = DOMAIN_TO_ENTRY[spec.domain];
    if (!entryName) {
      return { spec, code: '', generated: false, error: `unsupported layer domain: ${spec.domain}` };
    }
    const entry = generatorRegistry.getAll().find((e) => e.name === entryName);
    if (!entry) {
      return { spec, code: '', generated: false, error: `no generator registered for ${entryName}` };
    }
    try {
      // Base layer (z=1) may paint an opaque full-stage background — anchored to the
      // spec's declared background when one exists (F18); every foreground layer is
      // told to render on a transparent canvas so lower layers show through.
      const isBase = index === 0;
      const raw = await entry.generate(buildLayerPrompt(spec.prompt, { isBase, domain: spec.domain, stageBackground }));
      const code = typeof raw === 'string' ? raw : raw.code;
      Logger.info('CompositionOrchestrator', `Layer ${index} (${spec.domain}) generated ${code.length} chars`);
      // Deterministic guard: flag a foreground layer that violated the contract.
      const opaqueBackground = !isBase && paintsOpaqueBackground(code, spec.domain);
      let actedSpec = spec;
      let seamGuarded = false;
      if (opaqueBackground) {
        // ACT on the detected seam (do not just observe): a foreground layer's
        // opaque full-canvas band hard-occludes everything beneath it under a
        // 'normal'/'multiply'/'darken'/'overlay' blend, producing the visible
        // seam. Force a brightening blend ('screen') so the opaque band adds
        // light instead of occluding — the seam disappears without regenerating
        // the art. Brightening blends ('screen'/'lighten') already let lower
        // layers through, so leave those untouched.
        const blend = spec.blendMode ?? 'normal';
        if (blend !== 'screen' && blend !== 'lighten') {
          actedSpec = { ...spec, blendMode: 'screen' };
          seamGuarded = true;
          Logger.warn('CompositionOrchestrator', `Layer ${index} (${spec.domain}) paints an opaque full-canvas background — seam guard forced blend '${blend}' → 'screen' so it no longer occludes lower layers`);
        } else {
          Logger.warn('CompositionOrchestrator', `Layer ${index} (${spec.domain}) paints an opaque full-canvas background under a brightening blend ('${blend}') — already non-occluding, seam guard left it as-is`);
        }
      }
      return { spec: actedSpec, code, generated: true, opaqueBackground, seamGuarded };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.warn('CompositionOrchestrator', `Layer ${index} (${spec.domain}) failed: ${message}`);
      return { spec, code: '', generated: false, error: message };
    }
  }

  /** Build the composite HTML: stacked, blended iframes — one per generated layer. */
  private static assemble(
    title: string,
    background: string,
    results: Array<{ spec: CompositionLayerSpec; code: string; generated: boolean }>,
    _codes: string[],
  ): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeTitle = esc(title);
    const hasAudio = results.some((r) => r.generated && AUDIO_DOMAINS.has(r.spec.domain));
    const frames: string[] = [];

    let z = 1;
    for (const r of results) {
      if (!r.generated || !r.code) continue;
      const wrapDomain = DOMAIN_TO_WRAP[r.spec.domain] ?? 'p5';
      const blend = r.spec.blendMode ?? 'normal';
      const opacity = r.spec.opacity ?? 1;
      const isAudio = AUDIO_DOMAINS.has(r.spec.domain);
      const layerHtml = HTMLWrapper.wrap(r.code, { domain: wrapDomain, compositionForeground: z > 1 && !isAudio });
      const dataUri = `data:text/html;base64,${Buffer.from(layerHtml, 'utf-8').toString('base64')}`;
      // Audio layers are invisible but must stay in the DOM to keep playing.
      const visualStyle = isAudio
        ? 'width:1px;height:1px;opacity:0;pointer-events:none;'
        : `width:100%;height:100%;mix-blend-mode:${blend};opacity:${opacity};`;
      frames.push(
        `      <iframe class="sinter-layer" data-domain="${r.spec.domain}" allow="autoplay" ` +
        `style="position:absolute;inset:0;border:0;${visualStyle}z-index:${z};" src="${dataUri}"></iframe>`,
      );
      z++;
    }

    const startOverlay = hasAudio
      ? `  <button id="sinter-start" aria-label="Start composition" style="position:fixed;inset:0;z-index:9999;border:0;background:rgba(0,0,0,0.55);color:#fff;font:600 18px system-ui,sans-serif;cursor:pointer">▶ Click to start (audio)</button>
  <script>
    document.getElementById('sinter-start').addEventListener('click', function () {
      this.remove();
      document.querySelectorAll('iframe.sinter-layer').forEach(function (f) {
        try { f.contentWindow && f.contentWindow.postMessage('sinter:start', '*'); } catch (e) {}
        // Re-poke the iframe so any deferred audio context can resume on this gesture.
        var s = f.getAttribute('src'); f.setAttribute('src', s);
      });
    });
  </script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; height: 100%; background: ${background}; overflow: hidden; }
    #sinter-stage { position: fixed; inset: 0; }
    a.skip { position: absolute; left: -999px; }
  </style>
</head>
<body>
  <a class="skip" href="#sinter-stage">Skip to content</a>
  <main id="sinter-stage" role="img" aria-label="${safeTitle}">
${frames.join('\n')}
  </main>
${startOverlay}
</body>
</html>
`;
  }
}
