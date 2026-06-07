/**
 * CompositionOrchestrator — the end-to-end "combine outputs" path.
 *
 * Liminal's core is not just generating single-domain pieces; it is *layering*
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
}

export interface CompositionResult {
  html: string;
  title: string;
  layers: ComposedLayer[];
  /** Layers that generated successfully. */
  successCount: number;
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

    const title = spec.title ?? 'Liminal Composition';
    const results = await Promise.all(
      spec.layers.map((layer, index) => this.generateLayer(layer, index)),
    );

    const html = this.assemble(title, spec.background ?? '#000', results, results.map(r => r.code));
    const layers: ComposedLayer[] = results.map((r) => ({
      domain: r.spec.domain,
      prompt: r.spec.prompt,
      blendMode: r.spec.blendMode ?? 'normal',
      opacity: r.spec.opacity ?? 1,
      codeLength: r.code.length,
      generated: r.generated,
      error: r.error,
    }));

    return { html, title, layers, successCount: results.filter(r => r.generated).length };
  }

  private static async generateLayer(
    spec: CompositionLayerSpec,
    index: number,
  ): Promise<{ spec: CompositionLayerSpec; code: string; generated: boolean; error?: string }> {
    const entryName = DOMAIN_TO_ENTRY[spec.domain];
    if (!entryName) {
      return { spec, code: '', generated: false, error: `unsupported layer domain: ${spec.domain}` };
    }
    const entry = generatorRegistry.getAll().find((e) => e.name === entryName);
    if (!entry) {
      return { spec, code: '', generated: false, error: `no generator registered for ${entryName}` };
    }
    try {
      const raw = await entry.generate(spec.prompt);
      const code = typeof raw === 'string' ? raw : raw.code;
      Logger.info('CompositionOrchestrator', `Layer ${index} (${spec.domain}) generated ${code.length} chars`);
      return { spec, code, generated: true };
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
      const layerHtml = HTMLWrapper.wrap(r.code, { domain: wrapDomain });
      const dataUri = `data:text/html;base64,${Buffer.from(layerHtml, 'utf-8').toString('base64')}`;
      const blend = r.spec.blendMode ?? 'normal';
      const opacity = r.spec.opacity ?? 1;
      const isAudio = AUDIO_DOMAINS.has(r.spec.domain);
      // Audio layers are invisible but must stay in the DOM to keep playing.
      const visualStyle = isAudio
        ? 'width:1px;height:1px;opacity:0;pointer-events:none;'
        : `width:100%;height:100%;mix-blend-mode:${blend};opacity:${opacity};`;
      frames.push(
        `      <iframe class="liminal-layer" data-domain="${r.spec.domain}" allow="autoplay" ` +
        `style="position:absolute;inset:0;border:0;${visualStyle}z-index:${z};" src="${dataUri}"></iframe>`,
      );
      z++;
    }

    const startOverlay = hasAudio
      ? `  <button id="liminal-start" aria-label="Start composition" style="position:fixed;inset:0;z-index:9999;border:0;background:rgba(0,0,0,0.55);color:#fff;font:600 18px system-ui,sans-serif;cursor:pointer">▶ Click to start (audio)</button>
  <script>
    document.getElementById('liminal-start').addEventListener('click', function () {
      this.remove();
      document.querySelectorAll('iframe.liminal-layer').forEach(function (f) {
        try { f.contentWindow && f.contentWindow.postMessage('liminal:start', '*'); } catch (e) {}
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
    #liminal-stage { position: fixed; inset: 0; }
    a.skip { position: absolute; left: -999px; }
  </style>
</head>
<body>
  <a class="skip" href="#liminal-stage">Skip to content</a>
  <main id="liminal-stage" role="img" aria-label="${safeTitle}">
${frames.join('\n')}
  </main>
${startOverlay}
</body>
</html>
`;
  }
}
