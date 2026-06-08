import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs helper shared with scripts/quality/render-gallery.mjs
import { detectDomain } from '../../../scripts/quality/detect-domain.mjs';

describe('render-gallery detectDomain', () => {
  it('classifies Strudel/Tidal music (bpm + s/note chains to .out()) as audio, not a visual domain', () => {
    // Real cli-project gallery content (Strudel mini-notation). The decisive
    // signal is bpm()/setcpm() — visual live-coding has no tempo. Previously
    // misrouted to 'hydra' because Strudel's .shape() + .out() tripped the
    // Hydra source check, which rendered it as p5/hydra → `bpm is not defined`.
    const strudel = [
      'bpm(120)',
      's("bd(7,16) ~ [~ cp:2] ~ hh*8").speed("<1.5 0.75 2 0.5>").gain(0.55).out()',
      'note("c4 <e4 g4> b4 a4 <f4 d4> e4 c4").sustain(0.22).decay(0.5).shape(0.18).paper().out()',
    ].join('\n');
    expect(detectDomain(strudel)).toBe('audio');
  });

  it('classifies a minimal Strudel snippet as audio', () => {
    expect(detectDomain('setcpm(0.5)\ns("hh*4").out()')).toBe('audio');
  });

  it('still classifies a real Hydra sketch (osc source) as hydra', () => {
    // Hydra has visual sources (osc/src) and no tempo — must NOT be caught by
    // the audio branch.
    expect(detectDomain('osc(20, 0.1, 0.8).color(1, 0, 0).rotate(0.1).out()')).toBe('hydra');
  });

  it('classifies a p5 sketch as p5', () => {
    expect(detectDomain('function setup(){ createCanvas(400,400); }\nfunction draw(){ background(0); }')).toBe('p5');
  });

  it('classifies a GLSL fragment shader as shader', () => {
    expect(detectDomain('precision highp float;\nvoid main(){ gl_FragColor = vec4(1.0); }')).toBe('shader');
  });

  it('classifies inline SVG as svg', () => {
    expect(detectDomain('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')).toBe('svg');
  });
});
