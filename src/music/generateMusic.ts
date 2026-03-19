/**
 * generateMusic - Generate code for Strudel (TidalCycles) or p5.js Web Audio from a prompt.
 * LLM-powered when available, with template fallback.
 */

import { LLMClient } from '../llm/LLMClient.js';

export type GenerateMusicPlatform = 'strudel' | 'p5-webaudio';

export interface GenerateMusicOptions {
  prompt: string;
  bpm?: number;
  duration?: string;
  platform?: GenerateMusicPlatform;
  signal?: AbortSignal;
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
  const { prompt, bpm = 120, platform = 'strudel', signal } = options;
  const p = (prompt || '').trim().toLowerCase();

  // Try LLM generation first
  if (LLMClient.isConfigured()) {
    try {
      const code = await generateMusicLLM(prompt, bpm, platform, signal);
      if (code) return { code };
    } catch {
      // Fall through to template
    }
  }

  // Template fallback
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
async function generateMusicLLM(prompt: string, bpm: number, platform: GenerateMusicPlatform, signal?: AbortSignal): Promise<string> {
  const llm = new LLMClient();

  let systemPrompt: string;
  if (platform === 'strudel') {
    systemPrompt = `You are an expert live-coder specializing in Strudel (TidalCycles).
Generate Strudel mini-notation code based on the user's description.

Rules:
1. Return ONLY runnable Strudel code (no markdown, no explanations)
2. Include setcps() for tempo (BPM ${bpm})
3. Use rich patterns with stack, s, n, sometimes, every, etc.
4. Be creative with sounds, effects, and structure
5. Keep it playable and musical`;
  } else {
    systemPrompt = `You are an expert creative coder specializing in p5.js with Web Audio API.
Generate a p5.js sketch with generative music/audio based on the user's description.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Include setup() and draw() functions
3. Use Web Audio API (AudioContext, createOscillator, createGain) for sound
4. Require user gesture (mousePressed) to start audio (browser policy)
5. BPM: ${bpm}
6. Make it visually and sonically interesting`;
  }

  const userPrompt = `Generate ${platform} music: ${prompt}`;
  const response = await llm.generate(systemPrompt, userPrompt, signal);

  if (!response.success || !response.code || response.code.trim().length === 0) {
    return '';
  }

  return response.code.trim();
}

function getStrudelCode(prompt: string, bpm: number): string {
  const bpmLine = `setcps(${bpm / 60})`;
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
${bpmLine}
n("[c3 e3 g3 c4]").sound("sawtooth").stutter(4).degrade(0.3).lpf(800).gain(0.3)
`;
  }

  if (isReactive) {
    return `// Strudel - reactive (paste at strudel.repl.co)
${bpmLine}
stack(
  n("[c3 e3 g3 c4]").sound("sawtooth").lpf(800).gain(0.3),
  s("~ hh*4").gain(0.2)
).slow(2)
`;
  }

  if (isAmbient) {
    return `// Strudel - ambient (paste at strudel.repl.co)
${bpmLine}
stack(
  s("~ [c3 e3 g3] [e3 g3 c4]").slow(2),
  s("~ [g2 c3 e3]").slow(4)
).slow(0.5)
`;
  }

  if (isPercussion) {
    return `// Strudel - drums (paste at strudel.repl.co)
${bpmLine}
s2("bd sd bd sd, hh*8")
`;
  }

  return `// Strudel (paste at strudel.repl.co)
${bpmLine}
n("[c3 e3 g3 c4]").sound("sawtooth").lpf(800).gain(0.3)
`;
}

function getP5WebAudioCode(prompt: string, bpm: number): string {
  const isBeeps =
    prompt.includes('beep') ||
    prompt.includes('beeps') ||
    prompt.includes('bleep') ||
    prompt.includes('synth');

  if (isBeeps) {
    return `// p5 + Web Audio - beeps (run in p5 with user gesture to start sound)
let ctx;
let gainNode;
const bpm = ${bpm};
const freqs = [261.63, 329.63, 392, 523.25];

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
  const i = floor(random(freqs.length));
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
let ctx;
let gainNode;
const bpm = ${bpm};

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
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 200 + random(400);
  osc.connect(gainNode);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}
`;
}
