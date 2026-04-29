import { describe, expect, it } from 'vitest';
import {
  evaluateAudioPerception,
  evaluateCodePerception,
  evaluateHumanPerception,
  evaluateTextPerception,
  evaluateVideoPerception,
  evaluateVisualPerception,
} from '../../../src/perception/HumanPerceptionGuardrails.js';
import {
  HUMAN_AUDIBLE_RANGE_HZ,
  HUMAN_PERCEPTION_LAYER,
  MAX_SAFE_FLICKER_HZ,
} from '../../../src/perception/types.js';

describe('HumanPerceptionGuardrails', () => {
  it('flags visual outputs that are not visible or flicker faster than human-safe comfort', () => {
    const result = evaluateVisualPerception({ kind: 'visual', hasVisibleContent: false, flickerHz: 12 });

    expect(result.layer).toBe(HUMAN_PERCEPTION_LAYER);
    expect(result.passed).toBe(false);
    expect(result.issues.map(issue => issue.id)).toEqual(
      expect.arrayContaining(['visual.no-visible-content', 'visual.flicker-risk']),
    );
    expect(MAX_SAFE_FLICKER_HZ).toBe(3);
  });

  it('does not turn subjective color taste into a hard failure', () => {
    const result = evaluateVisualPerception({
      kind: 'visual',
      hasVisibleContent: true,
      frameRate: 60,
      userIntent: 'muted gray palette with low drama',
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('keeps audio in human-audible ranges and treats silence as intentional only when allowed', () => {
    expect(HUMAN_AUDIBLE_RANGE_HZ).toEqual({ min: 20, max: 20_000 });

    const outOfRange = evaluateAudioPerception({ kind: 'audio', frequencyHz: 28_000, isSilent: true });
    expect(outOfRange.passed).toBe(false);
    expect(outOfRange.issues.map(issue => issue.id)).toEqual(
      expect.arrayContaining(['audio.frequency-outside-human-range', 'audio.unintended-silence']),
    );

    const intentionalSilence = evaluateAudioPerception({ kind: 'audio', isSilent: true, allowSilence: true });
    expect(intentionalSilence.passed).toBe(true);
  });

  it('treats text legibility and caption timing as ergonomics, not style preference', () => {
    const result = evaluateTextPerception({
      kind: 'text',
      contrastRatio: 1.8,
      fontSizePx: 7,
      captionSeconds: 0.4,
      lineLength: 140,
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map(issue => issue.id)).toEqual(
      expect.arrayContaining([
        'text.low-contrast',
        'text.font-too-small',
        'text.caption-too-fast',
        'text.line-too-long',
      ]),
    );
  });

  it('checks static code clues when runtime evidence is unavailable', () => {
    expect(evaluateCodePerception('frameRate(240); flickerHz = 9;', 'p5').issues.map(issue => issue.id)).toEqual(
      expect.arrayContaining(['visual.frame-rate-outside-useful-range', 'visual.flicker-risk']),
    );
    expect(evaluateCodePerception('const frequency = 28000; const bpm = 999;', 'tone').issues.map(issue => issue.id)).toEqual(
      expect.arrayContaining(['audio.frequency-outside-human-range', 'audio.tempo-outside-human-useful-range']),
    );
    expect(evaluateCodePerception('setcps(1)', 'strudel').passed).toBe(true);
  });

  it('checks video motion/fps/caption ergonomics through the generic dispatcher', () => {
    const result = evaluateHumanPerception({
      kind: 'video',
      hasVisibleFrames: false,
      fps: 240,
      flickerHz: 9,
      captionSeconds: 0.6,
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map(issue => issue.id)).toEqual(
      expect.arrayContaining([
        'video.no-visible-frames',
        'video.fps-outside-useful-range',
        'video.flicker-risk',
        'video.caption-too-fast',
      ]),
    );
    expect(evaluateVideoPerception({ kind: 'video', fps: 24, hasVisibleFrames: true }).passed).toBe(true);
  });
});
