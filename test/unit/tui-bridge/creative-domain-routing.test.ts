import { describe, expect, it } from 'vitest';

import {
  buildCreativeDomainPlan,
  inferCreativeDomain,
  previewDomainForCode,
} from '../../../src/tui-bridge/CreativeDomainRouting.js';
import { Domain } from '../../../src/types/domains.js';

describe('TuiBridgeService creative domain routing', () => {
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

  it('chooses preview domain from actual output code over requested fallback domain', () => {
    const threeCode = 'const scene = new THREE.Scene(); const renderer = new THREE.WebGLRenderer(); renderer.render(scene, new THREE.PerspectiveCamera());';

    expect(previewDomainForCode(threeCode, Domain.P5)).toBe('three');
  });

  it('does not include unreachable glsl preview branches for shader output', () => {
    const shaderCode = 'precision mediump float; uniform vec2 u_resolution; void main() { gl_FragColor = vec4(1.0); }';

    expect(previewDomainForCode(shaderCode, Domain.GLSL)).toBe('shader');
  });
});
