/**
 * generateMusic - Generate code for Strudel (TidalCycles) or p5.js Web Audio from a prompt.
 * LLM-powered when available, with template fallback.
 *
 * Integrates music theory engine: scales, chords, euclidean rhythms,
 * arpeggiators, Markov chains, rhyme scoring, and structure templates.
 */

import { LLMClient } from '../llm/LLMClient.js';
import { PromptLibrary } from '../prompts/index.js';
import { generateEuclideanPattern, rotatePattern } from './EuclideanRhythm.js';
import { generateMarkovMelody, buildTransitionMatrix } from './MarkovChain.js';
import {
  noteToMidi,
  midiToNote,
  getScaleNotes,
  quantizeToScale,
  generateProgression,
  SCALE_INTERVALS,
  NOTES,
} from './TheoryEngine.js';
import { generateArpeggio, type ArpMode } from './Arpeggiator.js';
import { classifyRhyme, getRhymeScore } from './RhymeEngine.js';
import { countSyllables, countLineSyllables } from './SyllableCounter.js';
import { listTemplates, buildStructureFromTemplate } from './StructureTemplates.js';
import { Logger } from '../utils/Logger.js';

/**
 * MusicTheoryContext — exposes the music theory engine for use by callers.
 * Consumers can import and use these directly without coupling to generateMusic internals.
 */
export const MusicTheory = {
  generateEuclideanPattern,
  rotatePattern,
  generateMarkovMelody,
  noteToMidi,
  midiToNote,
  getScaleNotes,
  quantizeToScale,
  generateProgression,
  SCALE_INTERVALS,
  NOTES,
  generateArpeggio,
  classifyRhyme,
  getRhymeScore,
  countSyllables,
  countLineSyllables,
  listTemplates,
  buildStructureFromTemplate,
} as const;

export type GenerateMusicPlatform = 'strudel' | 'p5-webaudio';

export interface GenerateMusicOptions {
  prompt: string;
  bpm?: number;
  duration?: string;
  platform?: GenerateMusicPlatform;
  signal?: AbortSignal;
  llm?: LLMClient;
}

export interface GenerateMusicResult {
  code: string;
  path?: string;
}

/**
 * Generate music code for the given platform.
 * - strudel: TidalCycles/Strudel mini-notation or JS runnable on strudel.repl.co
 * - p5-webaudio: p5.js sketch using Web Audio (oscillator, gain) for a simple generative pattern
 *
 * Uses LLM when configured, falls back to template-based generation.
 */
export async function generateMusic(options: GenerateMusicOptions): Promise<GenerateMusicResult> {
  const { prompt, bpm = 120, platform = 'strudel', signal, llm } = options;
  const p = (prompt || '').trim().toLowerCase();

  // Try LLM generation first
  if (LLMClient.isConfigured()) {
    try {
      const code = await generateMusicLLM(prompt, bpm, platform, signal, llm);
      if (code) return { code };
    } catch (err) {
      // Log error but continue to template fallback
      Logger.error('generateMusic', 'LLM generation failed, using template fallback:', err);
      // Continue to template fallback - don't throw to ensure user gets something
    }
  }

  // Template fallback - always indicate this is a template
  Logger.info('generateMusic', `Using template fallback for platform: ${platform}`);
  if (platform === 'strudel') {
    const code = getStrudelCode(p, bpm);
    return { code };
  }

  if (platform === 'p5-webaudio') {
    const code = getP5WebAudioCode(p, bpm);
    return { code };
  }

  const code = getStrudelCode(p, bpm);
  return { code };
}

/**
 * Generate music code via LLM. Returns empty string on failure.
 */
async function generateMusicLLM(prompt: string, bpm: number, platform: GenerateMusicPlatform, signal?: AbortSignal, llm?: LLMClient): Promise<string> {
  const client = llm ?? new LLMClient({ role: 'generator' });

  let systemPrompt: string;
  let userPrompt: string;

  if (platform === 'strudel') {
    const rendered = PromptLibrary.render('music.strudel', { bpm: String(bpm), prompt });
    systemPrompt = rendered.system;
    userPrompt = rendered.user;
  } else {
    const rendered = PromptLibrary.render('music.p5-webaudio', { bpm: String(bpm), prompt });
    systemPrompt = rendered.system;
    userPrompt = rendered.user;
  }

  const response = await client.generate(systemPrompt, userPrompt, signal);

  if (!response.success || !response.code || response.code.trim().length === 0) {
    return '';
  }

  return response.code.trim();
}

// ---------------------------------------------------------------------------
// Music theory wiring — derive concrete musical material from the prompt
// ---------------------------------------------------------------------------

/** Resolved musical intent for the theory engines, derived from the prompt. */
interface MusicalIntent {
  /** Root note name (e.g. "C", "A"). */
  root: string;
  /** Scale type key into SCALE_INTERVALS. */
  scale: string;
  /** Euclidean rhythm steps. */
  steps: number;
  /** Euclidean rhythm pulses. */
  pulses: number;
  /** Euclidean rhythm rotation. */
  rotation: number;
  /** Arpeggio mode for melodic sequencing. */
  arpMode: ArpMode;
}

/**
 * Map a prompt's musical mood keywords to a concrete intent the theory engines
 * can act on. Distinct moods yield distinct scales/rhythms so that changing the
 * prompt changes the engine-derived output (key/scale/rhythm/melody).
 */
function deriveMusicalIntent(prompt: string): MusicalIntent {
  if (
    prompt.includes('ambient') ||
    prompt.includes('drone') ||
    prompt.includes('pad') ||
    prompt.includes('atmospheric')
  ) {
    // Sparse, open, slow — minor pentatonic, few pulses.
    return { root: 'A', scale: 'pentatonicMinor', steps: 8, pulses: 3, rotation: 0, arpMode: 'up' };
  }
  if (prompt.includes('dark') || prompt.includes('minor') || prompt.includes('sad')) {
    return { root: 'D', scale: 'minor', steps: 8, pulses: 5, rotation: 0, arpMode: 'down' };
  }
  if (prompt.includes('bright') || prompt.includes('happy') || prompt.includes('major')) {
    return { root: 'C', scale: 'major', steps: 8, pulses: 5, rotation: 0, arpMode: 'up' };
  }
  if (prompt.includes('blues') || prompt.includes('jazz')) {
    return { root: 'E', scale: 'blues', steps: 16, pulses: 7, rotation: 0, arpMode: 'upDown' };
  }
  // Default: C major pentatonic, classic tresillo rhythm.
  return { root: 'C', scale: 'pentatonicMajor', steps: 8, pulses: 3, rotation: 0, arpMode: 'up' };
}

/** MIDI note number → Strudel mini-notation note name (e.g. 60 → "c4"). */
function midiToStrudelNote(midi: number): string {
  const { note, octave } = midiToNote(midi);
  // Strudel uses lowercase note names with sharps written as "#".
  return `${note.toLowerCase()}${octave}`;
}

/** MIDI note number → frequency in Hz (A4 = 440, MIDI 69). */
function midiToFreq(midi: number): number {
  return Math.round(440 * Math.pow(2, (midi - 69) / 12) * 100) / 100;
}

/**
 * Render a Euclidean pattern as a Strudel mini-notation rhythm string where
 * pulses fire a sound and rests are written as `~`. E(3,8) → "x ~ x ~ x ~ ~ ~".
 */
function euclideanToStrudelMask(pattern: number[], hit: string): string {
  return pattern.map((step) => (step === 1 ? hit : '~')).join(' ');
}

function getStrudelCode(prompt: string, bpm: number): string {
  const bpmLine = `setcps(${bpm / 60})`;
  const intent = deriveMusicalIntent(prompt);

  // --- Wire EuclideanRhythm: build the actual onset pattern ---
  const euclid = rotatePattern(
    generateEuclideanPattern(intent.steps, intent.pulses),
    intent.rotation,
  );

  // --- Wire TheoryEngine: select real scale notes for the melody ---
  const scaleNotes = getScaleNotes(intent.root, intent.scale, 3, 4);
  // Keep an octave's worth of scale tones for the melodic line.
  const palette = scaleNotes.slice(0, Math.min(scaleNotes.length, 8));

  // --- Wire Arpeggiator: sequence the scale notes into a melodic line ---
  const arp = generateArpeggio(
    { mode: intent.arpMode, octaveRange: 1, notesPerBeat: 4, baseNotes: palette },
    intent.pulses,
    0.25,
  );
  const melodyNotes = arp.map((n) => midiToStrudelNote(n.pitch)).join(' ');

  const isAmbient =
    prompt.includes('ambient') ||
    prompt.includes('drone') ||
    prompt.includes('pad') ||
    prompt.includes('atmospheric');
  const isPercussion =
    prompt.includes('beat') ||
    prompt.includes('drums') ||
    prompt.includes('percussion') ||
    prompt.includes('kick');
  const isGlitch =
    prompt.includes('glitch') ||
    prompt.includes('glitchy') ||
    prompt.includes('stutter') ||
    prompt.includes('degrade');
  const isReactive = prompt.includes('reactive');

  if (isGlitch) {
    return `// Strudel - glitch (paste at strudel.repl.co)
// scale ${intent.root} ${intent.scale}, euclid E(${intent.pulses},${intent.steps})
${bpmLine}
note("[${melodyNotes}]").sound("sawtooth").stutter(4).degrade(0.3).lpf(800).gain(0.3)
`;
  }

  if (isReactive) {
    return `// Strudel - reactive (paste at strudel.repl.co)
// scale ${intent.root} ${intent.scale}, euclid E(${intent.pulses},${intent.steps})
${bpmLine}
stack(
  note("[${melodyNotes}]").sound("sawtooth").lpf(800).gain(0.3),
  s("${euclideanToStrudelMask(euclid, 'hh')}").gain(0.2)
).slow(2)
`;
  }

  if (isAmbient) {
    return `// Strudel - ambient (paste at strudel.repl.co)
// scale ${intent.root} ${intent.scale}, euclid E(${intent.pulses},${intent.steps})
${bpmLine}
stack(
  note("[${melodyNotes}]").sound("sine").slow(2),
  s("${euclideanToStrudelMask(euclid, 'bd')}").slow(4)
).slow(0.5)
`;
  }

  if (isPercussion) {
    return `// Strudel - drums (paste at strudel.repl.co)
// euclid E(${intent.pulses},${intent.steps})
${bpmLine}
s2("${euclideanToStrudelMask(euclid, 'bd')}, hh*8")
`;
  }

  return `// Strudel (paste at strudel.repl.co)
// scale ${intent.root} ${intent.scale}, euclid E(${intent.pulses},${intent.steps})
${bpmLine}
note("[${melodyNotes}]").sound("sawtooth").lpf(800).gain(0.3)
`;
}

function getP5WebAudioCode(prompt: string, bpm: number): string {
  const intent = deriveMusicalIntent(prompt);

  // --- Wire TheoryEngine: real scale notes drive the playable frequencies ---
  const scaleNotes = getScaleNotes(intent.root, intent.scale, 4, 5);
  const palette = scaleNotes.slice(0, Math.min(scaleNotes.length, 8));
  const freqs = palette.map(midiToFreq);

  // --- Wire MarkovChain: walk a chain seeded by the scale for the melody ---
  const order = 1;
  const seed = palette.length >= order + 1 ? palette : [...palette, ...palette];
  const matrix = buildTransitionMatrix(seed, order);
  // Deterministic walk so the emitted code is stable for a given prompt.
  let counter = 0;
  const det = () => {
    const x = (Math.sin(counter++ * 12.9898) * 43758.5453) % 1;
    return x < 0 ? x + 1 : x;
  };
  const melodyMidi = generateMarkovMelody(seed, matrix, 8, order, det);
  // Map melody MIDI notes to indices into the freqs table for the p5 sketch.
  const melodyIdx = melodyMidi.map((m) => Math.max(0, palette.indexOf(m)));

  const isBeeps =
    prompt.includes('beep') ||
    prompt.includes('beeps') ||
    prompt.includes('bleep') ||
    prompt.includes('synth');

  if (isBeeps) {
    return `// p5 + Web Audio - beeps (run in p5 with user gesture to start sound)
// scale ${intent.root} ${intent.scale}
let ctx;
let gainNode;
const bpm = ${bpm};
const freqs = [${freqs.join(', ')}];
const melody = [${melodyIdx.join(', ')}];
let step = 0;

function setup() {
  createCanvas(400, 400);
  noLoop();
}

function draw() {
  background(20);
  textAlign(CENTER, CENTER);
  text('click to start beeps', width/2, height/2);
}

function mousePressed() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ctx.createGain();
    gainNode.gain.value = 0.2;
    gainNode.connect(ctx.destination);
    loop();
  }
  const i = melody[step % melody.length];
  step++;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freqs[i];
  osc.connect(gainNode);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}
`;
  }

  return `// p5 + Web Audio - generative pattern (click to start)
// scale ${intent.root} ${intent.scale}
let ctx;
let gainNode;
const bpm = ${bpm};
const freqs = [${freqs.join(', ')}];
const melody = [${melodyIdx.join(', ')}];
let step = 0;

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(30);
  text('click to start', width/2, height/2);
}

function mousePressed() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ctx.createGain();
    gainNode.gain.value = 0.15;
    gainNode.connect(ctx.destination);
  }
  const i = melody[step % melody.length];
  step = (step + 1) % melody.length;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freqs[i] + random(4);
  osc.connect(gainNode);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}
`;
}
