import { describe, it, expect } from 'vitest';
import { composeExpertPrompt, SHARED_CODE_GUIDELINES, notationLegend } from '../../../src/swarm/prompt-fragments.js';

describe('prompt-fragments', () => {
  it('SHARED_CODE_GUIDELINES contains expected entries', () => {
    expect(SHARED_CODE_GUIDELINES.length).toBeGreaterThanOrEqual(3);
    expect(SHARED_CODE_GUIDELINES[0]).toContain('clean');
  });

  it('notationLegend contains notation explanation', () => {
    expect(notationLegend).toContain('~d=domain');
    expect(notationLegend).toContain('expandNotation');
  });

  it('composeExpertPrompt builds a complete prompt', () => {
    const prompt = composeExpertPrompt({
      title: 'Shader Artist',
      tagline: 'a master of GPU-powered visuals',
      philosophy: ['Embrace the fragment', 'Think in parallel'],
      techniques: ['Ray marching', 'Signed distance fields'],
      heroes: 'Inigo Quilez, Shadertoy community',
    });

    expect(prompt).toContain('You are Shader Artist, a master of GPU-powered visuals.');
    expect(prompt).toContain('Philosophy:');
    expect(prompt).toContain('- Embrace the fragment');
    expect(prompt).toContain('- Think in parallel');
    expect(prompt).toContain('Code approach:');
    expect(prompt).toContain('- Ray marching');
    expect(prompt).toContain('- Signed distance fields');
    expect(prompt).toContain('Influences: Inigo Quilez, Shadertoy community');
    expect(prompt).toContain(notationLegend);
  });

  it('composeExpertPrompt handles single-item arrays', () => {
    const prompt = composeExpertPrompt({
      title: 'Minimalist',
      tagline: 'less is more',
      philosophy: ['Simplicity'],
      techniques: ['Restraint'],
      heroes: 'Nobody',
    });

    expect(prompt).toContain('- Simplicity');
    expect(prompt).toContain('- Restraint');
  });

  it('composeExpertPrompt handles empty arrays', () => {
    const prompt = composeExpertPrompt({
      title: 'Blank',
      tagline: 'empty canvas',
      philosophy: [],
      techniques: [],
      heroes: 'None',
    });

    expect(prompt).toContain('You are Blank, empty canvas.');
    expect(prompt).not.toContain('- ');
  });

  it('composeExpertPrompt includes all sections in order', () => {
    const prompt = composeExpertPrompt({
      title: 'Test',
      tagline: 'testing',
      philosophy: ['p1'],
      techniques: ['t1'],
      heroes: 'h1',
    });

    const titleIdx = prompt.indexOf('You are Test');
    const philosophyIdx = prompt.indexOf('Philosophy:');
    const codeIdx = prompt.indexOf('Code approach:');
    const influencesIdx = prompt.indexOf('Influences:');
    const notationIdx = prompt.indexOf(notationLegend);

    expect(titleIdx).toBeLessThan(philosophyIdx);
    expect(philosophyIdx).toBeLessThan(codeIdx);
    expect(codeIdx).toBeLessThan(influencesIdx);
    expect(influencesIdx).toBeLessThan(notationIdx);
  });
});
