import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/llm/LLMClient.js', () => {
  const generate = vi.fn().mockResolvedValue({
    code: 'import { useCurrentFrame, AbsoluteFill } from "remotion";\n\nexport const MyVideoComponent = () => {\n  const frame = useCurrentFrame();\n  return (\n    <AbsoluteFill>\n      <div style={{ fontSize: 64 }}>Frame {frame}</div>\n    </AbsoluteFill>\n  );\n};',
    success: true,
  });
  class MockLLMClient {
    generate = generate;
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

import { RemotionGenerator } from '../../../src/generators/remotion/RemotionGenerator.js';

describe('RemotionGenerator', () => {
  it('canHandle returns 0 — Remotion is deprecated and disabled', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('create a remotion video')).toBe(0);
    expect(gen.canHandle('animated video with particles')).toBe(0);
    expect(gen.canHandle('motion graphics title sequence')).toBe(0);
  });

  it('canHandle returns 0 for unrelated prompts', () => {
    const gen = new RemotionGenerator();
    expect(gen.canHandle('draw a circle with p5')).toBe(0);
    expect(gen.canHandle('GLSL shader with ray marching')).toBe(0);
  });

  it('generate throws — Remotion is deprecated and removed', async () => {
    const gen = new RemotionGenerator();
    await expect(gen.generate('particle animation')).rejects.toThrow(
      'Remotion has been removed from the active product surface'
    );
  });
});
