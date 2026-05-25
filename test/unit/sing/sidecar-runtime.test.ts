import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOpenAICompatiblePhraseGenerator,
  readLyricSidecarConfig,
} from '../../../packages/sing/src/lyrics/SidecarRuntime.js';
import type { LyricSidecarInput } from '../../../packages/sing/src/lyrics/Teleprompter.js';

const input: LyricSidecarInput = {
  presetId: 'voice-bloom',
  sceneName: 'Voice Bloom',
  visualTags: ['voice', 'shader'],
  recentAcceptedPhrases: [],
  recentDismissedPhrases: [],
  audioMood: {
    intensity: 'soft',
    pitchMotion: 'wandering',
    brightness: 'balanced',
    onsetDensity: 'sparse',
    vibrato: 'none',
  },
};

describe('Sing lyric sidecar runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps local model sidecar optional through URL config', () => {
    expect(readLyricSidecarConfig('')).toMatchObject({
      backend: 'mock',
      disabled: false,
      model: 'LFM2.5-350M',
    });
    expect(readLyricSidecarConfig('?lyricBackend=off')).toMatchObject({
      backend: 'off',
      disabled: true,
    });
    expect(readLyricSidecarConfig('?lyricBackend=openai-compatible&lyricModel=LFM2.5-1.2B-Instruct')).toMatchObject({
      backend: 'openai-compatible',
      source: 'lfm2_5_1_2b',
      disabled: false,
    });
  });

  it('filters local model output down to valid phrase fragments', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '1. blue ash\nwrite a song about birds\nsoft machine\nchorus forever',
          },
        }],
      }),
    } as Response);
    const generator = createOpenAICompatiblePhraseGenerator({
      endpoint: 'http://127.0.0.1:1234/v1',
      model: 'LFM2.5-350M',
    });

    await expect(generator.generate(input, { count: 3 })).resolves.toEqual(['blue ash', 'soft machine']);
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      model: string;
      messages: Array<{ content: string }>;
    };
    expect(request.model).toBe('LFM2.5-350M');
    expect(request.messages.at(-1)?.content).toContain('short singable phrase fragments');
    expect(request.messages.at(-1)?.content).not.toContain('full lyrics');
  });

  it('surfaces local backend failures for the teleprompter controller to log', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    const generator = createOpenAICompatiblePhraseGenerator({
      endpoint: 'http://127.0.0.1:1234/v1',
      model: 'LFM2.5-350M',
    });

    await expect(generator.generate(input, { count: 1 })).rejects.toThrow('lyric sidecar failed: 503');
  });
});
