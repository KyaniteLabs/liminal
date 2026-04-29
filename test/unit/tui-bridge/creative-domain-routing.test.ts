import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

import {
  buildCreativeDomainPlan,
  inferCreativeDomain,
  previewDomainForCode,
} from '../../../src/tui-bridge/CreativeDomainRouting.js';
import { Domain } from '../../../src/types/domains.js';

describe('TuiBridgeService creative domain routing', () => {
  it('honors explicit p5 prompts even when visual wording sounds three-dimensional', () => {
    const prompt = 'Create a concise p5.js sketch: luminous blue-green particles orbit a dark center, with visible motion, setup(), draw(), and createCanvas().';

    expect(inferCreativeDomain(prompt)).toBe(Domain.P5);
    expect(buildCreativeDomainPlan(prompt).slice(0, 2)).toEqual([Domain.P5, Domain.THREE]);
  });

  it('keeps the p5 generation instruction from accidentally retriggering Three dispatch', () => {
    const source = fs.readFileSync('src/tui-bridge/TuiBridgeService.ts', 'utf8');
    const p5Instruction = source.match(/Return raw p5\.js sketch code only\.[^']+/)?.[0] ?? '';

    expect(p5Instruction).toContain('p5.js sketch code only');
    expect(p5Instruction).not.toContain('SVG');
    expect(p5Instruction).not.toContain('Three.js');
  });

  it('routes explicit Three.js prompts to Three instead of p5 or svg', () => {
    const prompt = 'Generate a Three.js scene: an impossible greenhouse orbiting inside a black hole with glass flowers.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.THREE);
    expect(buildCreativeDomainPlan(prompt).slice(0, 2)).toEqual([Domain.THREE, Domain.P5]);
  });

  it('routes SVG prompts to a visual fallback plan without pretending p5 is the requested domain', () => {
    const prompt = 'single line svg of a flower';

    expect(inferCreativeDomain(prompt)).toBe(Domain.GENERIC);
    expect(buildCreativeDomainPlan(prompt)).toContain(Domain.THREE);
  });

  it('routes explicit Tone oscillator prompts to Tone before generic Hydra oscillator handling', () => {
    const prompt = 'Create a Tone.js oscillator synth with delay and a slow drone.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.TONE);
    expect(buildCreativeDomainPlan(prompt)[0]).toBe(Domain.TONE);
  });

  it('routes explicit Hydra video synth prompts to Hydra before generic Tone synth handling', () => {
    const prompt = 'Create a Hydra video synth sketch. User prompt: make a hydra visual of icebergs dancing in the sky.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.HYDRA);
    expect(buildCreativeDomainPlan(prompt)[0]).toBe(Domain.HYDRA);
  });



  it('routes explicit HyperFrames prompts to the HyperFrames video composition domain', () => {
    const prompt = 'Create a HyperFrames promo slideshow with image clips and GSAP timeline.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.HYPERFRAMES);
    expect(buildCreativeDomainPlan(prompt)[0]).toBe(Domain.HYPERFRAMES);
  });

  it('routes explicit Kinetic typography prompts away from the p5-only instruction path', () => {
    const prompt = 'Create CSS kinetic typography as a complete animated HTML artifact.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.KINETIC);
    expect(buildCreativeDomainPlan(prompt)[0]).toBe(Domain.KINETIC);
  });

  it('routes moving type prompts to Kinetic when no explicit framework is requested', () => {
    const prompt = 'Create moving type with expressive letter spacing as a complete animated HTML artifact.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.KINETIC);
    expect(buildCreativeDomainPlan(prompt)[0]).toBe(Domain.KINETIC);
  });

  it('honors explicit Three.js cues before broad kinetic typography matching', () => {
    const prompt = 'Create a Three.js scene with animated text orbiting the camera.';

    expect(inferCreativeDomain(prompt)).toBe(Domain.THREE);
    expect(buildCreativeDomainPlan(prompt)[0]).toBe(Domain.THREE);
  });

  it('chooses HyperFrames preview shell for generated HyperFrames HTML', () => {
    const hyperframesCode = '<!doctype html><html><body><div data-composition-id="demo"><h1 class="clip" data-start="0" data-duration="3" data-track-index="0">Title</h1></div><script>const tl = gsap.timeline({ paused: true }); window.__timelines = { demo: tl };</script></body></html>';

    expect(previewDomainForCode(hyperframesCode, Domain.P5)).toBe('hyperframes');
  });

  it('chooses preview domain from actual output code over requested fallback domain', () => {
    const threeCode = 'const scene = new THREE.Scene(); const renderer = new THREE.WebGLRenderer(); renderer.render(scene, new THREE.PerspectiveCamera());';

    expect(previewDomainForCode(threeCode, Domain.P5)).toBe('three');
  });

  it('does not include unreachable glsl preview branches for shader output', () => {
    const shaderCode = 'precision mediump float; uniform vec2 u_resolution; void main() { gl_FragColor = vec4(1.0); }';

    expect(previewDomainForCode(shaderCode, Domain.GLSL)).toBe('shader');
  });
});
