import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/llm/LLMClient.js', () => {
  const generate = vi.fn().mockResolvedValue({
    code: `import {makeScene, useTime} from '@revideo/core';
import {Circle} from '@revideo/2d';

export default makeScene(function* (view) {
  const time = useTime();
  view.add(<Circle width={100} height={100} fill="#ff6b6b" />);
  yield* time(2, 1);
});`,
    success: true,
  });
  class MockLLMClient {
    generate = generate;
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

import { RevideoGenerator } from '../../../src/generators/revideo/RevideoGenerator.js';

describe('RevideoGenerator', () => {
  it('canHandle returns 0.95 for revideo keyword', () => {
    const gen = new RevideoGenerator();
    expect(gen.canHandle('create a revideo animation')).toBe(0.95);
  });

  it('canHandle returns 0.90 for motion canvas keyword', () => {
    const gen = new RevideoGenerator();
    expect(gen.canHandle('motion canvas scene')).toBe(0.90);
  });

  it('canHandle returns 0.75 for video/animation keywords', () => {
    const gen = new RevideoGenerator();
    expect(gen.canHandle('animated video with particles')).toBe(0.75);
    expect(gen.canHandle('programmatic video intro')).toBe(0.75);
  });

  it('canHandle returns 0 for unrelated prompts', () => {
    const gen = new RevideoGenerator();
    expect(gen.canHandle('draw a circle with p5')).toBe(0);
    expect(gen.canHandle('GLSL shader with ray marching')).toBe(0);
  });

  it('generate returns valid Revideo code via LLM mock', async () => {
    const gen = new RevideoGenerator();
    const code = await gen.generate('circle animation');
    expect(code).toContain('makeScene');
    expect(code).toContain('useTime');
  });
});
