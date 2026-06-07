import { describe, expect, it } from 'vitest';
import { detectPromptDomain } from '../../../src/core/detectPromptDomain.js';
import { Domain } from '../../../src/types/domains.js';

describe('detectPromptDomain', () => {
  it('routes a GLSL/shader prompt to GLSL (was misrouted to p5)', async () => {
    expect(await detectPromptDomain('Create a GLSL ES 1.00 fragment shader with gl_FragColor')).toBe(Domain.GLSL);
    expect(await detectPromptDomain('a ray marched SDF shader')).toBe(Domain.GLSL);
  });

  it('routes a Three.js prompt to THREE', async () => {
    expect(await detectPromptDomain('a Three.js 3D scene with orbiting cubes')).toBe(Domain.THREE);
  });

  it('routes a Hydra prompt to HYDRA', async () => {
    expect(await detectPromptDomain('a Hydra video synth patch')).toBe(Domain.HYDRA);
  });

  it('returns undefined for a vague prompt (caller keeps default)', async () => {
    expect(await detectPromptDomain('make something nice')).toBeUndefined();
  });
});
