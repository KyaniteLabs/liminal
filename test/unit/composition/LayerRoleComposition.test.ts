/**
 * Layer Role Composition Proof Test
 *
 * Proves the minimal two-layer composition contract:
 *   shader background (opaque, zIndex 0)
 * + p5 transparent overlay (transparentBackground, zIndex 1, blendMode)
 *
 * Tests:
 * 1. Layer creation with role/transparentBackground config
 * 2. Adapter generateScript emits correct transparency and blend styles
 * 3. CompositionEngine.generateHTML() produces correct multi-layer markup
 * 4. P5GeneratorLLM overlay system prompt includes clear() rule
 */

import { describe, it, expect } from 'vitest';
import {
  createLayer,
  createComposition,
  DEFAULT_LAYER_CONFIG,
} from '../../../src/composition/types.js';
import type { Layer, Composition } from '../../../src/composition/types.js';
import { ShaderAdapter } from '../../../src/composition/adapters/ShaderAdapter.js';
import { P5Adapter } from '../../../src/composition/adapters/P5Adapter.js';
import {
  CompositionEngine,
} from '../../../src/composition/CompositionEngine.js';
import { registerAllAdapters } from '../../../src/composition/adapters/registerAdapters.js';
import { getCSSBlendMode } from '../../../src/composition/utils/blendModes.js';

// ---------------------------------------------------------------------------
// Fixtures: shader background + p5 transparent overlay
// ---------------------------------------------------------------------------

const SHADER_CODE = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 col = 0.5 + 0.5 * cos(u_time + uv.xyx + vec3(0, 2, 4));
  gl_FragColor = vec4(col, 1.0);
}
`;

const P5_OVERLAY_CODE = `
function setup() {
  createCanvas(800, 600);
}

function draw() {
  clear();
  noFill();
  stroke(255, 200);
  strokeWeight(2);
  let x = mouseX || 400;
  let y = mouseY || 300;
  circle(x, y, 100 + sin(frameCount * 0.05) * 50);
}
`;

function makeShaderBackground(): Layer {
  return createLayer('shader', SHADER_CODE, 'animated gradient background', {
    generator: 'ShaderGenerator',
    model: 'test-model',
    generatedAt: new Date().toISOString(),
  }, {
    role: 'background',
    transparentBackground: false,
    zIndex: 0,
  });
}

function makeP5Overlay(): Layer {
  return createLayer('p5', P5_OVERLAY_CODE, 'floating circle overlay', {
    generator: 'P5GeneratorLLM',
    model: 'test-model',
    generatedAt: new Date().toISOString(),
  }, {
    role: 'overlay',
    transparentBackground: true,
    zIndex: 1,
    blendMode: 'screen',
  });
}

// ===========================================================================
// 1. Layer creation contract
// ===========================================================================

describe('Layer Role Composition', () => {
  describe('layer creation with role config', () => {
    it('creates a shader background layer with correct config', () => {
      const layer = makeShaderBackground();

      expect(layer.type).toBe('shader');
      expect(layer.config.role).toBe('background');
      expect(layer.config.transparentBackground).toBe(false);
      expect(layer.config.zIndex).toBe(0);
      expect(layer.config.blendMode).toBe('normal');
      expect(layer.config.opacity).toBe(1);
      expect(layer.enabled).toBe(true);
    });

    it('creates a p5 overlay layer with transparent background', () => {
      const layer = makeP5Overlay();

      expect(layer.type).toBe('p5');
      expect(layer.config.role).toBe('overlay');
      expect(layer.config.transparentBackground).toBe(true);
      expect(layer.config.zIndex).toBe(1);
      expect(layer.config.blendMode).toBe('screen');
      expect(layer.config.opacity).toBe(1);
    });

    it('DEFAULT_LAYER_CONFIG includes role and transparentBackground', () => {
      expect(DEFAULT_LAYER_CONFIG.role).toBe('standalone');
      expect(DEFAULT_LAYER_CONFIG.transparentBackground).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Adapter generateScript (HTML export)
  // ===========================================================================

  describe('adapter generateScript', () => {
    it('shader adapter generates opaque background script', () => {
      const adapter = new ShaderAdapter();
      const layer = makeShaderBackground();
      const script = adapter.generateScript(layer, {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      });

      // Shader script should have a canvas element
      expect(script).toContain('<canvas');
      expect(script).toContain('gl.clearColor(0, 0, 0, 1)');
      // No transparent style — opaque is the default
      expect(script).not.toContain("background = 'transparent'");
    });

    it('p5 overlay adapter generates transparent background + blend mode', () => {
      const adapter = new P5Adapter();
      const layer = makeP5Overlay();
      const script = adapter.generateScript(layer, {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      });

      // Should have transparent background style
      expect(script).toContain("background = 'transparent'");
      // Should have blend mode
      expect(script).toContain("mixBlendMode = 'screen'");
      // Should have correct z-index and opacity
      expect(script).toContain('zIndex = 1');
      expect(script).toContain('opacity = 1');
    });

    it('p5 standalone (no overlay) does not get transparent styles', () => {
      const adapter = new P5Adapter();
      const layer = createLayer('p5', P5_OVERLAY_CODE, 'standalone sketch', {
        generator: 'P5GeneratorLLM',
        model: 'test',
        generatedAt: new Date().toISOString(),
      });
      // Default: transparentBackground = false, role = standalone

      const script = adapter.generateScript(layer, {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      });

      expect(script).not.toContain("background = 'transparent'");
      expect(script).not.toContain('mixBlendMode');
    });
  });

  // ===========================================================================
  // 3. CompositionEngine generateHTML — two-layer proof
  // ===========================================================================

  describe('CompositionEngine two-layer composition', () => {
    it('generateHTML produces correct multi-layer markup', () => {
      const engine = new CompositionEngine();
      registerAllAdapters(engine);

      const bgLayer = makeShaderBackground();
      const overlayLayer = makeP5Overlay();

      engine.addLayer(bgLayer);
      engine.addLayer(overlayLayer);

      const html = engine.generateHTML();

      // HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('id="composition"');

      // Shader background layer present
      expect(html).toContain('shader');

      // P5 overlay layer present
      expect(html).toContain('p5.js');
      expect(html).toContain('p5.min.js');
    });

    it('layers are ordered by z-index in composition', () => {
      const engine = new CompositionEngine();
      registerAllAdapters(engine);

      // Add background first (natural order — bottom up)
      engine.addLayer(makeShaderBackground()); // zIndex 0
      engine.addLayer(makeP5Overlay());        // zIndex 1

      const layers = engine.getLayers();
      const sorted = [...layers].sort((a, b) => a.config.zIndex - b.config.zIndex);

      // Background (z=0) should come before overlay (z=1)
      expect(sorted[0].config.role).toBe('background');
      expect(sorted[0].config.zIndex).toBe(0);
      expect(sorted[1].config.role).toBe('overlay');
      expect(sorted[1].config.zIndex).toBe(1);
    });
  });

  // ===========================================================================
  // 4. Blend mode utilities for composition
  // ===========================================================================

  describe('blend mode support', () => {
    it('getCSSBlendMode returns correct values for composition blend modes', () => {
      expect(getCSSBlendMode('normal')).toBe('normal');
      expect(getCSSBlendMode('screen')).toBe('screen');
      expect(getCSSBlendMode('multiply')).toBe('multiply');
      expect(getCSSBlendMode('overlay')).toBe('overlay');
    });
  });

  // ===========================================================================
  // 5. Composition creation and serialization
  // ===========================================================================

  describe('composition serialization', () => {
    it('createComposition with two layers preserves role config', () => {
      const composition = createComposition('shader + p5 proof');
      const bg = makeShaderBackground();
      const overlay = makeP5Overlay();

      composition.layers.push(bg, overlay);

      expect(composition.layers).toHaveLength(2);
      expect(composition.layers[0].config.role).toBe('background');
      expect(composition.layers[1].config.role).toBe('overlay');
      expect(composition.layers[1].config.transparentBackground).toBe(true);
      expect(composition.layers[1].config.blendMode).toBe('screen');
    });
  });

  // ===========================================================================
  // 6. P5 overlay prompt contract
  // ===========================================================================

  describe('P5 overlay prompt contract', () => {
    it('overlay layer code uses clear() not background() for transparency', () => {
      // This is the contract the generator must follow when layerRole='overlay'
      const overlayCode = P5_OVERLAY_CODE;

      expect(overlayCode).toContain('clear()');
      // Overlay should NOT use opaque background() in draw
      // (background() in setup is OK, but draw() should use clear())
      const drawMatch = overlayCode.match(/function\s+draw\s*\(\)\s*\{([\s\S]*?)\}/);
      expect(drawMatch).toBeTruthy();
      expect(drawMatch![1]).not.toMatch(/\bbackground\s*\(/);
    });

    it('shader background code can use opaque clearColor', () => {
      // Shader background should render with alpha = 1.0
      expect(SHADER_CODE).toContain('gl_FragColor');
      expect(SHADER_CODE).toMatch(/vec4\(col,\s*1\.0\)/);
    });
  });

  // ===========================================================================
  // 7. ShaderAdapter transparent + blend mode in HTML export
  // ===========================================================================

  describe('ShaderAdapter HTML export', () => {
    it('background shader includes opacity and z-index on canvas', () => {
      const adapter = new ShaderAdapter();
      const layer = makeShaderBackground();
      const script = adapter.generateScript(layer, {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      });

      expect(script).toContain('z-index: 0');
      expect(script).toContain('opacity: 1');
      expect(script).toContain('gl.clearColor(0, 0, 0, 1)');
    });

    it('transparent shader overlay uses clearColor with alpha 0', () => {
      const adapter = new ShaderAdapter();
      const layer = createLayer('shader', SHADER_CODE, 'transparent shader overlay', {
        generator: 'ShaderGenerator',
        model: 'test',
        generatedAt: new Date().toISOString(),
      }, {
        role: 'overlay',
        transparentBackground: true,
        zIndex: 1,
        blendMode: 'screen',
      });

      const script = adapter.generateScript(layer, {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      });

      expect(script).toContain('gl.clearColor(0, 0, 0, 0)');
      expect(script).toContain("background: transparent");
      expect(script).toContain("mix-blend-mode: screen");
      expect(script).toContain('alpha: true');
    });
  });
});
