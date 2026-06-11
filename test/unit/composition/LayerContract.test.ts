import { describe, it, expect } from 'vitest';
import {
  buildLayerPrompt,
  paintsOpaqueBackground,
  FOREGROUND_TRANSPARENCY_CONTRACT,
  baseBackgroundContract,
} from '../../../src/composition/LayerContract.js';

describe('composition LayerContract — buildLayerPrompt', () => {
  it('leaves the base layer (z=1) prompt untouched — the base may render an opaque full-stage background', () => {
    const base = 'a dark tundra night sky with pine silhouettes';
    expect(buildLayerPrompt(base, { isBase: true, domain: 'three' })).toBe(base);
  });

  it('appends the spec background contract to the base layer when the composition declares one (audit F18)', () => {
    const base = 'soft paper texture with faint ink veins';
    const out = buildLayerPrompt(base, { isBase: true, domain: 'p5', stageBackground: '#fbfaf7' });
    expect(out).toContain(base);
    expect(out).toContain(baseBackgroundContract('#fbfaf7'));
    expect(out).toContain('#fbfaf7');
  });

  it('does not give the foreground layers the base background contract even when a stage background is declared', () => {
    const out = buildLayerPrompt('drifting ink glyphs', { isBase: false, domain: 'p5', stageBackground: '#fbfaf7' });
    expect(out).not.toContain(baseBackgroundContract('#fbfaf7'));
    expect(out).toContain(FOREGROUND_TRANSPARENCY_CONTRACT);
  });

  it('appends the transparency contract to a foreground layer prompt', () => {
    const out = buildLayerPrompt('drifting snow particles', { isBase: false, domain: 'p5' });
    expect(out).toContain('drifting snow particles');
    expect(out).toContain(FOREGROUND_TRANSPARENCY_CONTRACT);
  });

  it('adds a p5-specific clear() hint for foreground p5 layers', () => {
    const out = buildLayerPrompt('snow', { isBase: false, domain: 'p5' });
    expect(out).toContain('clear()');
  });

  it('adds a shader-specific alpha/discard hint for foreground shader layers', () => {
    const out = buildLayerPrompt('aurora ribbon', { isBase: false, domain: 'shader' });
    expect(out).toMatch(/alpha 0|discard/);
  });
});

describe('composition LayerContract — paintsOpaqueBackground (foreground guard)', () => {
  it('flags an opaque p5 background() with no alpha (1 or 3 args)', () => {
    expect(paintsOpaqueBackground('function draw(){ background(0); circle(10,10,5); }', 'p5')).toBe(true);
    expect(paintsOpaqueBackground('function draw(){ background(10, 20, 30); }', 'p5')).toBe(true);
  });

  it('passes a translucent p5 background() that carries an alpha channel (2 or 4 args)', () => {
    expect(paintsOpaqueBackground('function draw(){ background(0, 0, 0, 20); circle(1,1,1); }', 'p5')).toBe(false);
    expect(paintsOpaqueBackground('function draw(){ background(0, 20); }', 'p5')).toBe(false);
  });

  it('passes a p5 foreground that clears to transparent', () => {
    expect(paintsOpaqueBackground('function draw(){ clear(); circle(10,10,5); }', 'p5')).toBe(false);
  });

  it('flags a full-canvas opaque rect fill', () => {
    expect(paintsOpaqueBackground('function draw(){ fill(0); rect(0, 0, width, height); }', 'p5')).toBe(true);
  });

  it('flags a manual vertical-gradient background (full-width strips/lines — the showpiece seam technique)', () => {
    // How the showpiece p5 layer painted its opaque two-tone sky → the seam.
    const gradient = 'for (let y = 0; y < height; y++){ let c = lerpColor(color(15,35,55), color(30,60,85), y/height); stroke(c); rect(0, y, width, 1); }';
    expect(paintsOpaqueBackground(gradient, 'p5')).toBe(true);
    expect(paintsOpaqueBackground('line(0, height * 0.25, width, height * 0.25);', 'p5')).toBe(true);
  });

  it('passes a sparse transparent foreground (clear + subject shapes only)', () => {
    const sparse = 'function draw(){ clear(); for (let p of glints){ ellipse(p.x, p.y, 4); } }';
    expect(paintsOpaqueBackground(sparse, 'p5')).toBe(false);
  });

  it('does not flag non-p5 domains (source-level opacity is not reliably detectable there)', () => {
    expect(paintsOpaqueBackground('osc(20).out()', 'hydra')).toBe(false);
    expect(paintsOpaqueBackground('gl_FragColor = vec4(0.0,0.0,0.0,1.0);', 'shader')).toBe(false);
  });
});
