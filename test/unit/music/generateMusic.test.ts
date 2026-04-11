import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateMusic,
  MusicTheory,
} from '../../../src/music/generateMusic.js';
import { SCALE_INTERVALS, NOTES } from '../../../src/music/TheoryEngine.js';

// ---------------------------------------------------------------------------
// Hoisted mock variables — must use vi.hoisted() for vars referenced in vi.mock()
// ---------------------------------------------------------------------------

const mockIsConfigured = vi.hoisted(() => vi.fn());
const mockRender = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: Object.assign(vi.fn(), { isConfigured: mockIsConfigured }),
}));

vi.mock('../../../src/prompts/index.js', () => ({
  PromptLibrary: { render: mockRender },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: mockWarn, info: vi.fn(), error: mockError },
}));

// ---------------------------------------------------------------------------
// MusicTheory re-export verification
// ---------------------------------------------------------------------------

describe('MusicTheory re-export object', () => {
  it('exposes all expected functions as properties', () => {
    const functionNames = [
      'generateEuclideanPattern',
      'rotatePattern',
      'generateMarkovMelody',
      'noteToMidi',
      'midiToNote',
      'getScaleNotes',
      'quantizeToScale',
      'generateProgression',
      'generateArpeggio',
      'classifyRhyme',
      'getRhymeScore',
      'countSyllables',
      'countLineSyllables',
      'listTemplates',
      'buildStructureFromTemplate',
    ];
    for (const name of functionNames) {
      expect(typeof (MusicTheory as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('exposes SCALE_INTERVALS and NOTES constants', () => {
    expect(MusicTheory.SCALE_INTERVALS).toEqual(SCALE_INTERVALS);
    expect(MusicTheory.NOTES).toEqual(NOTES);
  });

  it('re-exported functions produce correct results', () => {
    const pattern = MusicTheory.generateEuclideanPattern(8, 3);
    expect(pattern).toEqual([1, 0, 1, 0, 0, 1, 0, 0]);

    const rhyme = MusicTheory.classifyRhyme('cat', 'hat');
    expect(rhyme.type).toBe('perfect');
    expect(rhyme.score).toBe(1.0);

    const midi = MusicTheory.noteToMidi('A', 4);
    expect(midi).toBe(69);
  });
});

// ---------------------------------------------------------------------------
// Strudel template fallback (LLM not configured)
// ---------------------------------------------------------------------------

describe('Strudel template fallback', () => {
  beforeEach(() => {
    mockIsConfigured.mockReturnValue(false);
  });

  it('returns ambient template for "ambient" keyword', async () => {
    const result = await generateMusic({ prompt: 'ambient chill' });
    expect(result.code).toContain('slow');
  });

  it('returns ambient template for "drone" keyword', async () => {
    const result = await generateMusic({ prompt: 'drone pad' });
    expect(result.code).toContain('slow');
  });

  it('returns ambient template for "atmospheric" keyword', async () => {
    const result = await generateMusic({ prompt: 'atmospheric sounds' });
    expect(result.code).toContain('slow');
  });

  it('returns ambient template for "pad" keyword', async () => {
    const result = await generateMusic({ prompt: 'pad sound' });
    expect(result.code).toContain('slow');
  });

  it('returns glitch template for "glitch" keyword', async () => {
    const result = await generateMusic({ prompt: 'glitch noise' });
    expect(result.code).toContain('stutter');
    expect(result.code).toContain('degrade');
  });

  it('returns glitch template for "glitchy" keyword', async () => {
    const result = await generateMusic({ prompt: 'glitchy effect' });
    expect(result.code).toContain('stutter');
  });

  it('returns glitch template for "stutter" keyword', async () => {
    const result = await generateMusic({ prompt: 'stutter effect' });
    expect(result.code).toContain('stutter');
  });

  it('returns glitch template for "degrade" keyword', async () => {
    const result = await generateMusic({ prompt: 'degrade pattern' });
    expect(result.code).toContain('degrade');
  });

  it('returns reactive template for "reactive" keyword', async () => {
    const result = await generateMusic({ prompt: 'reactive visuals' });
    expect(result.code).toContain('stack');
  });

  it('returns percussion template for "beat" keyword', async () => {
    const result = await generateMusic({ prompt: 'beat pattern' });
    expect(result.code).toContain('bd sd');
  });

  it('returns percussion template for "drums" keyword', async () => {
    const result = await generateMusic({ prompt: 'drums loop' });
    expect(result.code).toContain('bd sd');
  });

  it('returns percussion template for "percussion" keyword', async () => {
    const result = await generateMusic({ prompt: 'percussion rhythm' });
    expect(result.code).toContain('bd sd');
  });

  it('returns percussion template for "kick" keyword', async () => {
    const result = await generateMusic({ prompt: 'kick pattern' });
    expect(result.code).toContain('bd sd');
  });

  it('returns default sawtooth template for unrecognized prompt', async () => {
    const result = await generateMusic({ prompt: 'melody in C major' });
    expect(result.code).toContain('sawtooth');
    expect(result.code).toContain('lpf');
  });

  it('uses correct setcps value for bpm=120', async () => {
    const result = await generateMusic({ prompt: 'test', bpm: 120, platform: 'strudel' });
    expect(result.code).toContain('setcps(2)');
  });

  it('uses correct setcps value for bpm=90', async () => {
    const result = await generateMusic({ prompt: 'test', bpm: 90, platform: 'strudel' });
    expect(result.code).toContain('setcps(1.5)');
  });

  it('uses correct setcps value for bpm=60', async () => {
    const result = await generateMusic({ prompt: 'test', bpm: 60, platform: 'strudel' });
    expect(result.code).toContain('setcps(1)');
  });

  it('lowercases and trims prompt for keyword matching', async () => {
    const result = await generateMusic({ prompt: '  AMBIENT  ', platform: 'strudel' });
    expect(result.code).toContain('slow');
  });
});

// ---------------------------------------------------------------------------
// p5-webaudio template fallback
// ---------------------------------------------------------------------------

describe('p5-webaudio template fallback', () => {
  beforeEach(() => {
    mockIsConfigured.mockReturnValue(false);
  });

  it('returns beeps template for "beep" keyword', async () => {
    const result = await generateMusic({ prompt: 'beep sounds', platform: 'p5-webaudio' });
    expect(result.code).toContain('createOscillator');
    expect(result.code).toContain('freqs');
  });

  it('returns beeps template for "beeps" keyword', async () => {
    const result = await generateMusic({ prompt: 'beeps', platform: 'p5-webaudio' });
    expect(result.code).toContain('createOscillator');
  });

  it('returns beeps template for "bleep" keyword', async () => {
    const result = await generateMusic({ prompt: 'bleep bloop', platform: 'p5-webaudio' });
    expect(result.code).toContain('createOscillator');
  });

  it('returns beeps template for "synth" keyword', async () => {
    const result = await generateMusic({ prompt: 'synth melody', platform: 'p5-webaudio' });
    expect(result.code).toContain('createOscillator');
  });

  it('returns default p5 template for unrecognized prompt', async () => {
    const result = await generateMusic({ prompt: 'random noise', platform: 'p5-webaudio' });
    expect(result.code).toContain('createOscillator');
    expect(result.code).toContain('random');
  });

  it('uses default bpm=120 in p5 code', async () => {
    const result = await generateMusic({ prompt: 'test', platform: 'p5-webaudio' });
    expect(result.code).toContain('bpm = 120');
  });

  it('uses custom bpm=80 in p5 code', async () => {
    const result = await generateMusic({ prompt: 'test', platform: 'p5-webaudio', bpm: 80 });
    expect(result.code).toContain('bpm = 80');
  });
});

// ---------------------------------------------------------------------------
// LLM path — successful generation
// ---------------------------------------------------------------------------

describe('LLM generation path', () => {
  let mockGenerate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockIsConfigured.mockReturnValue(true);
    mockGenerate = vi.fn();
    mockRender.mockReturnValue({ system: 'system prompt', user: 'user prompt' });
  });

  afterEach(() => {
    mockRender.mockReset();
  });

  it('returns LLM-generated code for strudel platform', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      code: 's("c3 e3 g3").sound("sawtooth").lpf(800)',
    });

    const result = await generateMusic({
      prompt: 'dreamy pad',
      platform: 'strudel',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toBe('s("c3 e3 g3").sound("sawtooth").lpf(800)');
    expect(mockRender).toHaveBeenCalledWith('music.strudel', {
      bpm: '120',
      prompt: 'dreamy pad',
    });
  });

  it('returns LLM-generated code for p5-webaudio platform', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      code: 'function setup() {\n  createCanvas(400, 400);\n}',
    });

    const result = await generateMusic({
      prompt: 'chiptune',
      platform: 'p5-webaudio',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toContain('createCanvas');
    expect(mockRender).toHaveBeenCalledWith('music.p5-webaudio', {
      bpm: '120',
      prompt: 'chiptune',
    });
  });

  it('uses custom bpm in the rendered prompt', async () => {
    mockGenerate.mockResolvedValue({ success: true, code: 'some code' });

    await generateMusic({
      prompt: 'test',
      bpm: 80,
      platform: 'strudel',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(mockRender).toHaveBeenCalledWith('music.strudel', {
      bpm: '80',
      prompt: 'test',
    });
  });
});

// ---------------------------------------------------------------------------
// LLM fallback to template
// ---------------------------------------------------------------------------

describe('LLM fallback to template', () => {
  let mockGenerate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockIsConfigured.mockReturnValue(true);
    mockGenerate = vi.fn();
    mockRender.mockReturnValue({ system: 'system prompt', user: 'user prompt' });
    mockWarn.mockClear();
  });

  afterEach(() => {
    mockRender.mockReset();
    mockWarn.mockClear();
  });

  it('falls back to template when LLM returns empty code', async () => {
    mockGenerate.mockResolvedValue({ success: true, code: '' });

    const result = await generateMusic({
      prompt: 'empty result',
      platform: 'strudel',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toContain('setcps');
  });

  it('falls back to template when LLM returns whitespace-only code', async () => {
    mockGenerate.mockResolvedValue({ success: true, code: '   \n\t' });

    const result = await generateMusic({
      prompt: 'whitespace',
      platform: 'strudel',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toContain('setcps');
  });

  it('falls back to template when LLM returns success:false', async () => {
    mockGenerate.mockResolvedValue({ success: false, code: null });

    const result = await generateMusic({
      prompt: 'failed',
      platform: 'strudel',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toContain('setcps');
  });

  it('falls back to template when LLM throws an error', async () => {
    mockGenerate.mockRejectedValue(new Error('API timeout'));

    const result = await generateMusic({
      prompt: 'error case',
      platform: 'strudel',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toContain('setcps');
    expect(mockError).toHaveBeenCalled();
  });

  it('falls back to p5 template when LLM fails on p5-webaudio', async () => {
    mockGenerate.mockRejectedValue(new Error('Network error'));

    const result = await generateMusic({
      prompt: 'error',
      platform: 'p5-webaudio',
      llm: { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) } as never,
    });

    expect(result.code).toContain('createOscillator');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  beforeEach(() => {
    mockIsConfigured.mockReturnValue(false);
  });

  it('handles empty prompt string', async () => {
    const result = await generateMusic({ prompt: '', platform: 'strudel' });
    expect(result.code).toContain('setcps');
  });

  it('handles whitespace-only prompt', async () => {
    const result = await generateMusic({ prompt: '   ', platform: 'strudel' });
    expect(result.code).toContain('setcps');
  });

  it('handles undefined prompt (defaults to empty)', async () => {
    const result = await generateMusic({
      prompt: undefined as unknown as string,
      platform: 'strudel',
    });
    expect(result.code).toContain('setcps');
  });

  it('falls back to strudel for unrecognized platform value', async () => {
    const result = await generateMusic({
      prompt: 'test',
      platform: 'foobar' as 'strudel',
    });
    expect(result.code).toContain('setcps');
  });

  it('does not include path property in result', async () => {
    const result = await generateMusic({ prompt: 'test' });
    expect(result).not.toHaveProperty('path');
  });

  it('result always has a code property that is a non-empty string', async () => {
    const result = await generateMusic({ prompt: 'test' });
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
  });
});
