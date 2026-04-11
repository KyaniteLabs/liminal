import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/llm/LLMClient.js', () => {
  const generate = vi.fn().mockResolvedValue({
    code: 'import { makeScene, useTime } from "@revideo/core";\n\nexport default () => {\n  const time = useTime();\n  return <text>Time: {time}</text>;\n};',
    success: true,
  });
  const generateWithToolLoop = vi.fn().mockResolvedValue({
    content: 'import { makeScene, useTime } from "@revideo/core";\n\nexport default () => {\n  const time = useTime();\n  return <text>Time: {time}</text>;\n};',
    success: true,
    error: undefined,
  });
  class MockLLMClient {
    generate = generate;
<<<<<<< Updated upstream
    generateWithToolLoop = generateWithToolLoop;
=======
    generateWithToolLoop = vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true });
>>>>>>> Stashed changes
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

import { RemotionGenerator } from '../../../src/generators/remotion/RemotionGenerator.js';

describe('RemotionGenerator', () => {
  it('canHandle returns 0.95 for remotion/revideo keywords', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('create a remotion video')).toBe(0.95);
    expect(gen.canHandle('create a revideo animation')).toBe(0.95);
    expect(gen.canHandle('animated video with particles')).toBe(0.8);
    expect(gen.canHandle('motion graphics title sequence')).toBe(0.8);
  });

  it('canHandle returns 0 for unrelated prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('draw a circle with p5')).toBe(0);
    expect(gen.canHandle('GLSL shader with ray marching')).toBe(0);
  });

  it('generate returns valid Revideo code via LLM mock', async () => {
    const gen = new RemotionGenerator();
    const code = await gen.generate('particle animation');
    expect(code).toContain('makeScene');
    expect(code).toContain('useTime');
  });
});
