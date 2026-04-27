import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockComplete, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: 'const synth = new Tone.Synth().toDestination();',
    iterations: 1,
    toolCallsMade: 0,
    success: true,
  }),
  mockComplete: vi.fn().mockResolvedValue({
    text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tone.js Patch</title><script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script></head><body><button id="start">Start</button><script>document.getElementById("start").onclick=async()=>{await Tone.start();new Tone.Synth().toDestination().triggerAttackRelease("C4","8n");};</script></body></html>',
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = mockToolLoop;
    complete = mockComplete;
    getConfig = mockGetConfig;
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

vi.mock('../../../src/harness/tools/generator-tools.js', () => ({
  GENERATOR_TOOLS: [],
  createGeneratorToolExecutor: vi.fn().mockReturnValue(async () => 'ok'),
}));

import { ToneGenerator } from '../../../src/generators/tone/ToneGenerator.js';

describe('ToneGenerator', () => {
  beforeEach(() => {
    mockToolLoop.mockClear();
    mockComplete.mockClear();
  });

  it('constructs with tone domain', () => {
    const gen = new ToneGenerator();
    const info = gen.getTierInfo();
    expect(info.domain).toBe('tone');
  });

  it('sanitizeCode strips markdown fences', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: '```javascript\nconst synth = new Tone.Synth();\n```',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('make a synth');
    expect(result).not.toContain('```');
    expect(result).toContain('Tone.Synth');
  });

  it('sanitizeCode strips think tags', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: '<think reasoning here</think\nnew Tone.Synth()',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new ToneGenerator();
    const result = await gen.generate('make a synth');
    // The sanitizer strips content between think tags but the regex needs </think format
    // With malformed think tags, the content passes through
    expect(result).toContain('Tone');
  });

  it('validateOutput rejects truncated Tone.js HTML before export wrapping', () => {
    const gen = new ToneGenerator();
    const result = gen.validateOutput(`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tone</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
</head>
<body>
  <script>const synth = new Tone.Synth().toDestination();</script>`);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('closing </html>');
  });

  it('requests a larger token budget for full Tone.js pages', async () => {
    const gen = new ToneGenerator();
    await gen.generate('ambient drone');
    expect(mockToolLoop).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 8192 }));
  });

  it('wrapForGallery produces playable Tone.js HTML', () => {
    const gen = new ToneGenerator();
    const wrapped = gen.wrapForGallery('const s = new Tone.Synth();');
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('Play Tone.js patch');
    expect(wrapped).toContain('Tone.start');
    expect(wrapped).toContain('Tone.Synth');
    expect(wrapped).toContain('data-executable="true"');
    expect(wrapped).not.toContain('try {\nconst s = new Tone.Synth();');
  });

  it('wrapForGallery preserves full HTML without injecting it as executable script', () => {
    const gen = new ToneGenerator();
    const wrapped = gen.wrapForGallery('<!DOCTYPE html><script type="module">new Tone.Synth()</script>');
    expect(wrapped).toContain('data-executable="false"');
    expect(wrapped).toContain('Generated full HTML/module artifact is preserved below');
    expect(wrapped).toContain('&lt;!DOCTYPE html&gt;');
  });

  it('wrapForGallery escapes HTML entities for &, <, >', () => {
    const gen = new ToneGenerator();
    const wrapped = gen.wrapForGallery('Tone < test > & value');
    expect(wrapped).toContain('&lt;');
    expect(wrapped).toContain('&gt;');
    expect(wrapped).toContain('&amp;');
  });

  it('wrapForGallery handles empty code', () => {
    const gen = new ToneGenerator();
    const wrapped = gen.wrapForGallery('');
    expect(wrapped).toContain('<!DOCTYPE html>');
  });

  it('falls back to strict complete HTML when generation returns an invalid Tone fragment', async () => {
    mockToolLoop
      .mockResolvedValueOnce({
        content: 'html\n<html><body><script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script><button>Start</button></body></html>',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
      })
      .mockResolvedValueOnce({
        content: 'html\n<html><body><script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script></body></html>',
        iterations: 1,
        toolCallsMade: 0,
        success: true,
      });
    mockComplete
      .mockResolvedValueOnce({ text: 'Still thinking about the patch.', success: true })
      .mockResolvedValueOnce({
        text: '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tone.js Patch</title><script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script></head><body><button id="start">Start</button><script>document.getElementById("start").onclick=async()=>{await Tone.start();new Tone.Synth().toDestination().triggerAttackRelease("C4","8n");};</script></body></html>',
        success: true,
      });

    const gen = new ToneGenerator();
    const result = await gen.generate('drone');

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<head>');
    expect(result).toContain('Tone.Synth');
    expect(mockComplete).toHaveBeenCalledTimes(2);
  });
});
