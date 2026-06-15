import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const RESPONSE = JSON.stringify({
  title: 'Bright Stack',
  background: '#000',
  layers: [
    { domain: 'shader', prompt: 'bg', blendMode: 'screen', opacity: 1 },
    { domain: 'p5', prompt: 'fg', blendMode: 'screen', opacity: 1 },
  ],
});

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class MockLLMClient {
    generate = vi.fn().mockResolvedValue({ code: RESPONSE });
  },
}));

import { CompositionOrchestrator } from '../../../src/composition/CompositionOrchestrator.js';
import { Logger } from '../../../src/utils/Logger.js';

describe('CompositionOrchestrator washout log (P2)', () => {
  it('logs opacity cap, not stale blendMode demotion, when bright layers exceed budget', async () => {
    await CompositionOrchestrator.decomposePrompt('bright layers');
    const infoCalls = (Logger.info as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c.join(' '));
    const washoutLog = infoCalls.find((m: string) => m.includes('Washout guard'));
    expect(washoutLog).toBeDefined();
    expect(washoutLog).toContain('capped opacity');
    expect(washoutLog).not.toContain('to normal');
    expect(washoutLog).toMatch(/capped opacity on \d+ over-budget bright layer\(s\)/);
  });
});
