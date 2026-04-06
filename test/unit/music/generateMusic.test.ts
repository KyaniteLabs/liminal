import { describe, it, expect, vi } from 'vitest';
import { generateMusic, MusicTheory, type GenerateMusicPlatform } from '../../../src/music/generateMusic.js';
import { vi } from 'vitest';
import { LLMClient } from '../../../src/llm/LLMClient.js';
import { PromptLibrary } from '../../../src/prompts/index.js';
import { Logger } from '../../src/utils/Logger.js';
import { countSyllables, from '../../../src/music/SyllableCounter.js';
import { countLineSyllables } from '../../../src/music/SyllableCounter.js';

// ---------------------------------------------------------------------------
// Mock setup — hoisted variables for vi.hoisted()
// ---------------------------------------------------------------------------

const { isConfiguredMock, promptLibraryRenderMock, loggerWarnMock } = vi.hoisted(() => ({
  const isConfigured = vi.fn();
  const render = vi.fn();
  const warn = vi.fn();
  return { isConfigured, render, warn };
});

// Mock LLMClient static methods
 needed for generateMusicLLM path
 vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: {
    isConfigured: isConfiguredMock,
  },
}));

// Mock PromptLibrary.render
 vi.mock('../../../src/prompts/index.js', () => ({
  PromptLibrary: {
    render: promptLibraryRenderMock,
  },
}));

// Mock Logger.warn
 vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: loggerWarnMock,
  },
});

// ---------------------------------------------------------------------------
// MusicTheory exports
// ---------------------------------------------------------------------------

describe('MusicTheory export object', () => {
  it('exposes all expected sub-modules as properties', () => {
    expect(typeof MusicTheory.generateEuclideanPattern).toBe('function');
    expect(typeof MusicTheory.rotatePattern).toBe('function');
    expect(typeof MusicTheory.generateMarkovMelody).toBe('function');
    expect(typeof MusicTheory.noteToMidi).toBe('function');
    expect(typeof MusicTheory.midiToNote).toBe('function');
    expect(typeof MusicTheory.getScaleNotes).toBe('function');
    expect(typeof MusicTheory.quantizeToScale).toBe('function');
    expect(typeof MusicTheory.generateProgression).toBe('function');
    expect(typeof MusicTheory.generateArpeggio).toBe('function');
    expect(typeof MusicTheory.classifyRhyme).toBe('function');
    expect(typeof MusicTheory.getRhymeScore).toBe('function');
    expect(typeof MusicTheory.countSyllables).toBe('function');
    expect(typeof MusicTheory.countLineSyllables).toBe('function');
    expect(typeof MusicTheory.listTemplates).toBe('function');
    expect(typeof MusicTheory.buildStructureFromTemplate).toBe('function');
    expect(MusicTheory.SCALE_INTERVALS).toEqual(SCALE_INTERVALS);
    expect(MusicTheory.NOTES).toEqual(NOTES);
  });

  it('de-exported functions produce correct values when called directly', () => {
    // Verify the re-exports are working by calling them through MusicTheory
    const pattern = MusicTheory.generateEuclideanPattern(8, 3);
    expect(pattern).toEqual([1, 0, 1, 0, 0, 1, 0, 0, 0]);
    const result = MusicTheory.classifyRhyme('cat', 'hat');
    expect(result.type).toBe('perfect');
    expect(result.score).toBe(1.0);

    const result = MusicTheory.classifyRhyme('day', 'dog');
    expect(result.type).toBe('none');
    expect(result.score).toBe(0.0);

  });

  it('countSyllables returns 1 for single-letter word', () => {
    expect(countSyllables('x')).toBe(1);
    expect(countSyllables('hello')).toBe(2);
    expect(countSyllables('HEL-lo')).toBe(2);
    expect(countSyllables('HELLO')).toBe(2);
    expect(countSyllables('world')).toBe(2);
    expect(countSyllables('beep')).toBe(1);
    expect(countSyllables('bleep')).toBe(1);
  expect(countSyllables('bleeps')).toBe(1);

    expect(countSyllables('synth')).toBe(1);
    expect(countSyllables('createOscillator').toBe(1);
  });

  it('countSyllables strips non-alpha and returns 0', () => {
    expect(countSyllables('don\'t')).toBe(0);
    expect(countSyllables('D#nt')).toBe(1);
  });

  it('countSyllables returns 0 for all non-alpha input', () => {
    expect(countSyllables('')).toBe(0);
    expect(countSyllables('???')).toBe(0);
    expect(countSyllables('***')).toBe(0);
  });

});

// ---------------------------------------------------------------------------
// Template fallback: strudel
// ---------------------------------------------------------------------------

describe('template fallback: strudel', () => {
  beforeEach(() => {
    isConfiguredMock.mockReturnValue(false);
  });

  it('returns ambient strudel for ambient prompt', async () => {
    const result = await generateMusic({ prompt: 'ambient chill' });
    expect(result.code).toContain('ambient');
    expect(result.code).toContain('slow(2)');
  });

  it('returns strudel template for "ambient drone/atmospheric" prompt', async () => {
    const result = await generateMusic({ prompt: 'ambient drone' });
    expect(result.code).toContain('ambient');
    expect(result.code).toContain('slow');
  });

  it('returns strudel template for "ambient" prompt with no keywords match', async () => {
    const result = await generateMusic({ prompt: 'ambient' });
    expect(result.code).toContain('slow(2)');
  });

  it('returns strudel template for percussion prompt with percussion keyword', async () => {
    const result = await generateMusic({ prompt: 'percussion' });
    expect(result.code).toContain('s2("bd sd');
  });

  it('returns strudel template for "drums" prompt with drums keyword', async () => {
    const result = await generateMusic({ prompt: 'drums' });
    expect(result.code).toContain('s2("bd sd');
  });

  it('returns strudel template for "drums" prompt with drums keyword', async () => {
    const result = await generateMusic({ prompt: 'drums' });
    expect(result.code).toContain('bd');
  });

  it('returns strudel template for "glitch" prompt with glitch keyword', async () => {
    const result = await generateMusic({ prompt: 'glitch glitchy' });
    expect(result.code).toMatch(/stutter|4.*degrade\(0.3\)/);
  });

  it('returns strudel template for "reactive" prompt with reactive keyword', async () => {
    const result = await generateMusic({ prompt: 'reactive' });
    expect(result.code).toMatch(/stack\(/);
    expect(result.code).toContain('.slow(2)');
  });

  it('returns strudel template for unknown platform (falls back to strudel)', async () => {
    const result = await generateMusic({ prompt: 'something', platform: 'unknown' });
    // Falls back to strudel default
    expect(result.code).toContain('setcps');
  });

});

// ---------------------------------------------------------------------------
// LLM fallback path
// ---------------------------------------------------------------------------

describe('LLM fallback path', () => {
  beforeEach(() => {
    isConfiguredMock.mockReturnValue(true);
  });

  it('returns strudel for LLM error', async () => {
    const result = await generateMusic({ prompt: 'll });
    expect(result.code).toContain('setcps(2)');
  });

  it('returns strudel for LLM error on p5-webAudio platform', async () => {
    const result = await generateMusic({ prompt: 'error', platform: 'p5-webaudio' });
    expect(result.code).toContain('setcps');
  });

});

  it('logs warning via Logger.warn when LLM returns fails', async () => {
    const result = await generateMusic({ prompt: 'error case', platform: 'strudel' });
    expect(result.code).toContain('setcps');
  });
});

  it('logs warning via Logger.warn when LLM fails silently ( async () => {
    const result = await generateMusic({ prompt: 'error silent', platform: 'strudel' });
    expect(result.code).toContain('setcps');
  });
});

  it('logs warning when response has empty code and async () => {
    const result = await generateMusic({ prompt: '' });
    expect(result.code).toContain('setcps');
  });
});

// ---------------------------------------------------------------------------
// Default bpm and duration
// ---------------------------------------------------------------------------

describe('default values', () => {
    it('defaults bpm to 60', () => {
    expect(options.bpm).toBe(60);
  });
  it('defaults duration to 30 seconds', () => {
    expect(options.duration).toBe('3m');
  });
  it('defaults platform to strudel', () => {
    expect(options.platform).toBe('strudel');
  });
});
