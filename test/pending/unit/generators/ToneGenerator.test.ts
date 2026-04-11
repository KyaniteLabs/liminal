import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: 'const synth = new Tone.Synth().toDestination();\nsynth.triggerAttackRelease("C4", "8n");',
    success: true,
  }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
<<<<<<< Updated upstream
    generateWithToolLoop = vi.fn().mockImplementation(() =>
  mockGenerate().then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
);
=======
    generateWithToolLoop = vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true });
>>>>>>> Stashed changes
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({ baseUrl: '', model: '', apiKey: '' }),
}));

vi.mock('../../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: class {
    build = vi.fn().mockReturnValue({ system: 'sys', user: 'usr', combined: 'combined' });
    static loadContext = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    recordEpisode: vi.fn(),
    getSuccessfulAdaptations: vi.fn().mockReturnValue([]),
    getRecentEpisodes: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn() },
}));

import { ToneGenerator } from '../../../src/generators/tone/ToneGenerator.js';

describe('ToneGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it('generate returns code with markdown fences stripped', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '```javascript\nconst synth = new Tone.Synth();\n```',
      success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('play a chord');
    expect(result).toBe('const synth = new Tone.Synth();');
    expect(result).not.toContain('```');
  });

  it('generate strips thinking tags from output', async () => {
    mockGenerate.mockResolvedValueOnce({
      // Use Chinese <think> (U+8C) which matches the LLM thinking-tag format
      code: '<think> reasoning here</think>\nconst t = new Tone.Synth();',
      success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('synth');
    expect(result).not.toContain('<think>');
    expect(result).toContain('Tone.Synth');
  });

  it('validateOutput rejects code without Tone references', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'console.log("no audio here");',
      success: true,
    });
    const gen = new ToneGenerator();
    await expect(gen.generate('something')).rejects.toThrow('does not use Tone.js');
  });

  it('validateOutput accepts code with Tone reference', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'const synth = new Tone.AMSynth();',
      success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('am synth');
    expect(result).toContain('Tone');
  });

  it('validateOutput accepts lowercase tone reference', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: '// uses tone.js library\nvar player = new tone.Player();',
      success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('player');
    expect(result).toContain('tone');
  });

  it('passes options through to super.generate', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'const t = new Tone.PolySynth();',
      success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('poly synth', { bpm: 120, synth: 'polysynth' });
    expect(result).toContain('Tone');
  });
});

describe('ToneGenerator.wrapForGallery', () => {
  it('returns valid HTML with escaped code content', () => {
    const gen = new ToneGenerator();
    const code = 'new Tone.Synth().triggerAttackRelease("C4", "8n")';
    const wrapped = gen.wrapForGallery(code);

    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('Tone.js');
  });

  it('escapes HTML entities in code', () => {
    const gen = new ToneGenerator();
    const code = 'new Tone.Synth().gain(0.5 && 1.0)';
    const wrapped = gen.wrapForGallery(code);

    expect(wrapped).toContain('&amp;&amp;');
    expect(wrapped).not.toContain('&&');
  });

  it('includes Tone.js styling and message', () => {
    const gen = new ToneGenerator();
    const wrapped = gen.wrapForGallery('const synth = new Tone.Synth();');

    expect(wrapped).toContain('Tone.js');
    expect(wrapped).toContain('audio not available in iframe');
    expect(wrapped).toContain('monospace');
  });
});
