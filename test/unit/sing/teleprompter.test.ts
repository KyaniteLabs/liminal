import { describe, expect, it, vi } from 'vitest';
import {
  buildLyricPrompt,
  createMockPhraseSuggestions,
  PhraseRingBuffer,
  requestPhraseBatch,
  type LyricSidecarInput,
} from '../../../packages/sing/src/teleprompter/phrases.js';
import { SessionRecorder } from '../../../packages/sing/src/recording/SessionRecorder.js';

const input: LyricSidecarInput = {
  presetId: 'voice-bloom',
  sceneName: 'glass moon pool',
  visualTags: ['blue', 'moon', 'water'],
  recentAcceptedPhrases: [],
  recentDismissedPhrases: ['bright forever chorus'],
  audioMood: {
    intensity: 'medium',
    pitchMotion: 'wandering',
    brightness: 'balanced',
    onsetDensity: 'sparse',
    vibrato: 'subtle',
  },
};

describe('Sing mock lyric teleprompter', () => {
  it('emits short mock fragments without verse structure', () => {
    const suggestions = createMockPhraseSuggestions(input, { count: 5, now: 1000, ttlMs: 15_000 });

    expect(suggestions).toHaveLength(5);
    expect(suggestions.every((suggestion) => suggestion.source === 'mock')).toBe(true);
    expect(suggestions.every((suggestion) => suggestion.text.split(/\s+/).length <= 6)).toBe(true);
    expect(suggestions.map((suggestion) => suggestion.text).join('\n')).not.toMatch(/verse|chorus|^\d+\./i);
  });

  it('expires unpinned phrases while pinned phrases stay visible', () => {
    const queue = new PhraseRingBuffer({ maxVisibleSuggestions: 5 });
    queue.add(createMockPhraseSuggestions(input, { count: 2, now: 1000, ttlMs: 500 }), 1000);
    const [first] = queue.visible(1200);
    expect(first).toBeTruthy();

    queue.pin(first.id, 1300);

    expect(queue.visible(2000).map((suggestion) => suggestion.id)).toEqual([first.id]);
  });

  it('dismisses phrases and records feedback events', () => {
    const queue = new PhraseRingBuffer({ maxVisibleSuggestions: 5 });
    const [suggestion] = createMockPhraseSuggestions(input, { count: 1, now: 1000, ttlMs: 15_000 });
    queue.add([suggestion], 1000);

    queue.dismiss(suggestion.id, 'too_literal', 1200);
    queue.moreLikeThis(suggestion.id, 1300);

    expect(queue.visible(1400)).toEqual([]);
    expect(queue.events()).toEqual([
      expect.objectContaining({ type: 'phrase.dismissed', phraseId: suggestion.id, reason: 'too_literal' }),
      expect.objectContaining({ type: 'phrase.more_like_this', phraseId: suggestion.id }),
    ]);
  });

  it('drops stalled requests without waiting for the generator', async () => {
    const generator = vi.fn(() => new Promise<never>(() => {}));
    const started = performance.now();

    await expect(requestPhraseBatch(input, {
      enabled: true,
      count: 2,
      now: 1000,
      requestTimeoutMs: 5,
      generator,
    })).resolves.toEqual([]);

    expect(performance.now() - started).toBeLessThan(250);
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it('does not call a generator when the sidecar is disabled', async () => {
    const generator = vi.fn(() => Promise.resolve(createMockPhraseSuggestions(input, { count: 1, now: 1000, ttlMs: 15_000 })));

    await expect(requestPhraseBatch(input, {
      enabled: false,
      count: 1,
      now: 1000,
      requestTimeoutMs: 25,
      generator,
    })).resolves.toEqual([]);
    expect(generator).not.toHaveBeenCalled();
  });

  it('keeps the future model prompt constrained to phrase fragments', () => {
    const prompt = buildLyricPrompt(input, 4);

    expect(prompt).toContain('Generate 4 short singable phrase fragments.');
    expect(prompt).toContain('Do not write a verse.');
    expect(prompt).toContain('Do not write a chorus.');
    expect(prompt).toContain('Return only newline-separated fragments.');
  });

  it('writes phrase feedback into the session telemetry log', async () => {
    const recorder = new SessionRecorder();
    recorder.appendPhraseEvent({
      type: 'phrase.pinned',
      phraseId: 'mock-1',
      text: 'under the glass moon',
      createdAt: 1234,
    });

    const exported = await recorder.stop();
    await expect(exported.telemetryBlob.text()).resolves.toContain('"type":"phrase.pinned"');
  });

  it('writes movement features into the session telemetry log', async () => {
    const recorder = new SessionRecorder();
    recorder.appendMovementTelemetry(1234, {
      bodyCenterX: 0.4,
      bodyCenterY: 0.6,
      distanceToCamera: 0.2,
      leftHandHeight: 0.7,
      rightHandHeight: 0.3,
      handsApart: 0.5,
      torsoAngle: -0.1,
      headTilt: 0.2,
      movementEnergy: 0.8,
      stillness: 0.2,
      gestureOnset: true,
    });

    const exported = await recorder.stop();
    const text = await exported.telemetryBlob.text();
    expect(text).toContain('"type":"movement.features"');
    expect(text).toContain('"movementEnergy":0.8');
  });
});
