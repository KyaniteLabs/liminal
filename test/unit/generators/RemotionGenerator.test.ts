import { describe, it, expect } from 'vitest';
import { RemotionGenerator } from '../../../src/generators/remotion/RemotionGenerator.js';

describe('RemotionGenerator', () => {
  it('canHandle returns 0.9 for remotion/video keywords', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('create a remotion video')).toBe(0.9);
    expect(gen.canHandle('animated video with particles')).toBe(0.8);
    expect(gen.canHandle('motion graphics title sequence')).toBe(0.8);
  });

  it('canHandle returns 0 for unrelated prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('draw a circle with p5')).toBe(0);
    expect(gen.canHandle('GLSL shader with ray marching')).toBe(0);
  });

  it('generate returns template when no LLM configured', async () => {
    const gen = new RemotionGenerator();
    const code = await gen.generate('particle animation');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('AbsoluteFill');
  });
});
