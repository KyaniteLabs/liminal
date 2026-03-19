/**
 * generateMusic - Generate code for Strudel (TidalCycles) or p5.js Web Audio from a prompt.
 * Minimal rule-based implementation; no LLM.
 */

export type GenerateMusicPlatform = 'strudel' | 'p5-webaudio';

export interface GenerateMusicOptions {
  prompt: string;
  bpm?: number;
  duration?: string;
  platform?: GenerateMusicPlatform;
}

export interface GenerateMusicResult {
  code: string;
  path?: string;
}

/**
 * Generate music code for the given platform.
 * - strudel: TidalCycles/Strudel mini-notation or JS runnable on strudel.repl.co
 * - p5-webaudio: p5.js sketch using Web Audio (oscillator, gain) for a simple generative pattern
 */
export async function generateMusic(options: GenerateMusicOptions): Promise<GenerateMusicResult> {
  const { prompt, bpm = 120, platform = 'strudel' } = options;
  const p = (prompt || '').trim().toLowerCase();

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
