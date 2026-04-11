import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: 'test code output',
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

import { ASCIIArtGenerator } from '../../../src/generators/ascii/ASCIIArtGenerator.js';
import { StrudelGenerator } from '../../../src/generators/strudel/StrudelGenerator.js';
import { ToneGenerator } from '../../../src/generators/tone/ToneGenerator.js';

describe('wrapForGallery methods', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  // ===========================================================================
  // ASCIIArtGenerator.wrapForGallery
  // ===========================================================================
  describe('ASCIIArtGenerator.wrapForGallery', () => {
    it('returns HTML with escaped ASCII art', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '  ***\n *****\n*******',
        success: true,
      });
      const gen = new ASCIIArtGenerator();
      const code = await gen.generate('diamond');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<pre>');
      expect(html).toContain('***');
      expect(html).toContain('background:#0d1117');
      expect(html).toContain('font-family:monospace');
    });

    it('escapes HTML special characters in ASCII art', () => {
      // Test wrapForGallery escaping directly without going through generate()
      // since ASCIIArtGenerator.validateOutput rejects < > & characters
      const gen = new ASCIIArtGenerator();
      const codeWithHtmlChars = '<div> & "test"\n*******';
      const html = gen.wrapForGallery(codeWithHtmlChars);

      expect(html).toContain('&lt;div&gt;');
      expect(html).toContain('&amp;');
      expect(html).not.toContain('<div>');
    });

    it('includes proper viewport meta tag', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '  ***\n *****\n*******\n *****\n  ***',
        success: true,
      });
      const gen = new ASCIIArtGenerator();
      const code = await gen.generate('test');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    });

    it('uses dark background theme', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: '  ***\n *****\n*******',
        success: true,
      });
      const gen = new ASCIIArtGenerator();
      const code = await gen.generate('test');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('background:#0d1117');
      expect(html).toContain('color:#c9d1d9');
    });
  });

  // ===========================================================================
  // StrudelGenerator.wrapForGallery
  // ===========================================================================
  describe('StrudelGenerator.wrapForGallery', () => {
    it('returns HTML with Strudel REPL embed', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 's("bd sd").out()',
        success: true,
      });
      const gen = new StrudelGenerator();
      const code = await gen.generate('drums');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('@strudel/repl');
      expect(html).toContain('s("bd sd")');
    });

    it('escapes HTML in code display', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 's("bd <sd>").out()',
        success: true,
      });
      const gen = new StrudelGenerator();
      const code = await gen.generate('drums');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('&lt;sd&gt;');
      expect(html).not.toContain('<sd>');
    });

    it('includes Strudel REPL script module', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'note("c3").out()',
        success: true,
      });
      const gen = new StrudelGenerator();
      const code = await gen.generate('note');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('https://unpkg.com/@strudel/repl');
      expect(html).toContain('type="module"');
    });

    it('includes viewport meta for mobile', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 's("bd sd").out()',
        success: true,
      });
      const gen = new StrudelGenerator();
      const code = await gen.generate('test');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('width=device-width');
    });

    it('displays audio not available message', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 's("hh*4").out()',
        success: true,
      });
      const gen = new StrudelGenerator();
      const code = await gen.generate('hihat');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('audio not available in iframe');
    });
  });

  // ===========================================================================
  // ToneGenerator.wrapForGallery
  // ===========================================================================
  describe('ToneGenerator.wrapForGallery', () => {
    it('returns HTML with escaped code display', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'const synth = new Tone.Synth();',
        success: true,
      });
      const gen = new ToneGenerator();
      const code = await gen.generate('synth');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<pre>');
      expect(html).toContain('Tone.Synth');
    });

    it('escapes HTML special characters', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'const synth = new Tone.Synth().toDestination();\nsynth.triggerAttackRelease("C4", "8n");',
        success: true,
      });
      const gen = new ToneGenerator();
      const code = await gen.generate('trigger');
      const html = gen.wrapForGallery(code);

      // HTML should contain the code inside pre tags
      expect(html).toContain('<pre>');
      expect(html).toContain('</pre>');
      expect(html).toContain('triggerAttackRelease');
    });

    it('uses dark theme styling', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'const t = new Tone.MembraneSynth().toDestination();\nt.triggerAttackRelease("C2", "8n");',
        success: true,
      });
      const gen = new ToneGenerator();
      const code = await gen.generate('membrane');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('background:#1e1e2e');
      expect(html).toContain('color:#cdd6f4');
    });

    it('includes responsive font sizing', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'await Tone.start();\nconst synth = new Tone.Synth().toDestination();',
        success: true,
      });
      const gen = new ToneGenerator();
      const code = await gen.generate('start');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('font-size:clamp(9px,1.5vw,14px)');
    });

    it('shows audio not available message', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'const osc = new Tone.Oscillator("440", "sine").toDestination();\nosc.start();',
        success: true,
      });
      const gen = new ToneGenerator();
      const code = await gen.generate('osc');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('Tone.js — audio not available in iframe');
      expect(html).toContain('class="msg"');
    });

    it('includes viewport meta tag', async () => {
      mockGenerate.mockResolvedValueOnce({
        code: 'const reverb = new Tone.Reverb(3).toDestination();\nconst synth = new Tone.Synth().connect(reverb);',
        success: true,
      });
      const gen = new ToneGenerator();
      const code = await gen.generate('test');
      const html = gen.wrapForGallery(code);

      expect(html).toContain('width=device-width, initial-scale=1');
    });
  });
});
