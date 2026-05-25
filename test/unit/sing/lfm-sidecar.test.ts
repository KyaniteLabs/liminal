import { describe, expect, it, vi } from 'vitest';
import { createLfmOpenAiPhraseGenerator, parseLfmPhraseFragments } from '../../../packages/sing/src/teleprompter/lfm.js';
import type { LyricSidecarInput } from '../../../packages/sing/src/teleprompter/phrases.js';

const input: LyricSidecarInput = {
  presetId: 'voice-bloom',
  sceneName: 'violet tide',
  visualTags: ['violet', 'tide'],
  recentAcceptedPhrases: [],
  recentDismissedPhrases: [],
  audioMood: {
    intensity: 'soft',
    pitchMotion: 'wandering',
    brightness: 'balanced',
    onsetDensity: 'sparse',
    vibrato: 'subtle',
  },
};

describe('LFM lyric sidecar', () => {
  it('parses only constrained phrase fragments', () => {
    expect(parseLfmPhraseFragments('1. violet tide\nVerse 1:\nunder the glass moon\nthis line has way too many words for the sidecar')).toEqual([
      'violet tide',
      'under the glass moon',
    ]);
  });

  it('turns OpenAI-compatible responses into expiring phrase suggestions', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'violet tide\nunder the glass moon' } }],
    })));
    const generator = createLfmOpenAiPhraseGenerator({
      endpoint: 'http://127.0.0.1:18081/v1/chat/completions',
      model: 'LiquidAI/LFM2.5-350M-MLX-4bit',
      source: 'lfm2_5_350m',
      requestTimeoutMs: 1200,
      maxNewTokens: 48,
      fetchImpl,
    });

    const suggestions = await generator(input, { count: 2, now: 1000, ttlMs: 15_000 });

    expect(suggestions).toEqual([
      expect.objectContaining({ text: 'violet tide', source: 'lfm2_5_350m', expiresAt: 16_000 }),
      expect.objectContaining({ text: 'under the glass moon', source: 'lfm2_5_350m' }),
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:18081/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('LiquidAI/LFM2.5-350M-MLX-4bit'),
      }),
    );
  });

  it('drops bad model output instead of surfacing verse text', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Verse 1:\\nI will now write a complete song' } }],
    })));
    const generator = createLfmOpenAiPhraseGenerator({
      endpoint: 'http://127.0.0.1:18081/v1/chat/completions',
      model: 'LiquidAI/LFM2.5-350M-MLX-4bit',
      source: 'lfm2_5_350m',
      requestTimeoutMs: 1200,
      maxNewTokens: 48,
      fetchImpl,
    });

    await expect(generator(input, { count: 2, now: 1000, ttlMs: 15_000 })).resolves.toEqual([]);
  });
});
