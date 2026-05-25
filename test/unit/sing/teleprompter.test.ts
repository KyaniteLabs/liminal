import { describe, expect, it, vi } from 'vitest';
import {
  PhraseRingBuffer,
  PhraseSessionLog,
  TeleprompterController,
  buildLyricSidecarPrompt,
  createMockPhraseGenerator,
  isValidPhraseFragment,
  type LyricSidecarInput,
  type PhraseGenerator,
} from '../../../packages/sing/src/lyrics/Teleprompter.js';

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

describe('Sing teleprompter sidecar', () => {
  it('emits valid mock fragments and keeps the prompt contract fragment-sized', async () => {
    const generated = await createMockPhraseGenerator().generate(input, { count: 4 });
    expect(generated).toHaveLength(4);
    expect(generated.every(isValidPhraseFragment)).toBe(true);

    const prompt = buildLyricSidecarPrompt(input, 3);
    expect(prompt).toContain('short singable phrase fragments');
    expect(prompt).not.toContain('full lyrics');
    expect(prompt).not.toContain('write a song');
  });

  it('skips dismissed phrases without stalling the mock generator', async () => {
    const generator = createMockPhraseGenerator(['blue ash', 'verse one', 'no shore']);
    const generated = await generator.generate(
      {
        ...input,
        recentDismissedPhrases: ['blue ash', 'no shore'],
      },
      { count: 2 },
    );

    expect(generated).toEqual([]);
  });

  it('expires fragments after TTL unless pinned', () => {
    const buffer = new PhraseRingBuffer(5, 1000);
    const [unpinned, pinned] = buffer.add(['blue ash', 'no shore'], 0);

    expect(buffer.visible(500).map((phrase) => phrase.text)).toEqual(['blue ash', 'no shore']);
    buffer.pin(pinned!.id);

    expect(buffer.visible(1500).map((phrase) => phrase.text)).toEqual(['no shore']);
    expect(buffer.dismiss(unpinned!.id)?.text).toBe('blue ash');
  });

  it('dismisses the active phrase and logs feedback', async () => {
    const buffer = new PhraseRingBuffer();
    const log = new PhraseSessionLog();
    const controller = new TeleprompterController(createMockPhraseGenerator(['soft machine']), buffer, log);

    await controller.request(input, 10);
    const current = buffer.current(10);
    expect(current?.text).toBe('soft machine');

    controller.dismiss(current!.id, 20);
    expect(buffer.visible(20)).toHaveLength(0);
    expect(log.all().map((event) => event.type)).toEqual(['suggested', 'dismissed']);
    expect(log.toJsonl()).toContain('"type":"dismissed"');
  });

  it('drops stalled generator requests without blocking render ticks', async () => {
    vi.useFakeTimers();
    const stalledGenerator: PhraseGenerator = {
      generate: vi.fn(() => new Promise<string[]>(() => {})),
    };
    const buffer = new PhraseRingBuffer();
    const log = new PhraseSessionLog();
    const controller = new TeleprompterController(stalledGenerator, buffer, log, {
      suggestionIntervalMs: 4000,
      maxVisibleSuggestions: 5,
      phraseTtlMs: 15000,
      requestTimeoutMs: 25,
    });
    let renderTicks = 0;

    const request = controller.request(input, 100);
    renderTicks += 1;
    await vi.advanceTimersByTimeAsync(25);
    await expect(request).resolves.toEqual([]);

    expect(renderTicks).toBe(1);
    expect(buffer.visible(200)).toHaveLength(0);
    expect(log.all().at(-1)?.type).toBe('request_timeout');
    vi.useRealTimers();
  });

  it('makes hidden sidecar mode skip generator calls', async () => {
    const generator: PhraseGenerator = {
      generate: vi.fn(async () => ['where the light bends']),
    };
    const buffer = new PhraseRingBuffer();
    const log = new PhraseSessionLog();
    const controller = new TeleprompterController(generator, buffer, log);

    controller.hide(0);
    await controller.request(input, 1);

    expect(generator.generate).not.toHaveBeenCalled();
    expect(buffer.visible(1)).toHaveLength(0);
    expect(log.all().map((event) => event.type)).toEqual(['hidden', 'request_skipped']);
  });

  it('makes disabled sidecar mode skip generator calls', async () => {
    const generator: PhraseGenerator = {
      generate: vi.fn(async () => ['where the light bends']),
    };
    const buffer = new PhraseRingBuffer();
    const log = new PhraseSessionLog();
    const controller = new TeleprompterController(generator, buffer, log);

    controller.disable(0);
    await controller.request(input, 1);

    expect(controller.isDisabled()).toBe(true);
    expect(generator.generate).not.toHaveBeenCalled();
    expect(log.all().map((event) => event.type)).toEqual(['disabled', 'request_skipped']);
  });

  it('logs model failures without poisoning the render loop', async () => {
    const generator: PhraseGenerator = {
      generate: vi.fn(async () => {
        throw new Error('local model crashed');
      }),
    };
    const buffer = new PhraseRingBuffer();
    const log = new PhraseSessionLog();
    const controller = new TeleprompterController(generator, buffer, log);

    await expect(controller.request(input, 10)).resolves.toEqual([]);

    expect(buffer.visible(10)).toHaveLength(0);
    expect(log.all().at(-1)).toMatchObject({
      type: 'request_failed',
      reason: 'local model crashed',
    });
  });
});
