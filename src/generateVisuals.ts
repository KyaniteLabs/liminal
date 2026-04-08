/**
 * generateVisuals API
 *
 * Returns Hydra or p5.js code from a prompt, optionally modulated by audioInput (fft/bpm).
 * LLM-powered when available, with template fallback.
 */

import { LLMClient } from './llm/LLMClient.js';
import { PromptLibrary } from './prompts/index.js';
import { validatePrompt } from './utils/validation.js';
import { Logger } from './utils/Logger.js';

export interface GenerateVisualsOptions {
  prompt: string;
  audioInput?: {
    fft?: number[];
    bpm?: number;
  };
  platform?: 'hydra' | 'p5';
  signal?: AbortSignal;
  llm?: LLMClient;
}

export interface GenerateVisualsResult {
  code: string;
}

/**
 * Generate visuals code for Hydra or p5.js.
 *
 * @param options.prompt - Description of the visual
 * @param options.audioInput - Optional fft array and/or bpm for reactive modulation
 * @param options.platform - 'hydra' (default) or 'p5'
 * @returns Promise<{ code: string }>
 */
export async function generateVisuals(
  options: GenerateVisualsOptions
): Promise<GenerateVisualsResult> {
  const { prompt, audioInput, platform = 'hydra', signal, llm } = options;

  validatePrompt(prompt);

  const trimmedPrompt = prompt.trim().toLowerCase();

  // Try LLM generation first
  if (LLMClient.isConfigured()) {
    try {
      const code = await generateVisualsLLM(prompt, platform, audioInput, signal, llm);
      if (code) return { code };
    } catch (err) {
      // Log error but continue to template fallback
      Logger.error('generateVisuals', 'LLM generation failed, using template fallback:', err);
      // Continue to template fallback - don't throw to ensure user gets something
    }
  }

  // Template fallback - always indicate this is a template
  Logger.info('generateVisuals', `Using template fallback for platform: ${platform}`);
  if (platform === 'hydra') {
    return { code: generateHydraCode(trimmedPrompt, !!audioInput, audioInput) };
  }

  if (platform === 'p5') {
    return { code: generateP5Code(trimmedPrompt, !!audioInput, audioInput) };
  }

  throw new Error(`Unsupported platform: ${platform}. Use 'hydra' or 'p5'.`);
}

/**
 * Generate visuals code via LLM. Returns empty string on failure.
 */
async function generateVisualsLLM(
  prompt: string,
  platform: string,
  audioInput?: GenerateVisualsOptions['audioInput'],
  signal?: AbortSignal,
  llm?: LLMClient
): Promise<string> {
  const client = llm ?? new LLMClient({ role: 'generator' });

  let systemPrompt: string;
  let userPrompt: string;

  if (platform === 'hydra') {
    const audioContext = audioInput
      ? `Audio context: BPM=${audioInput.bpm}, FFT length=${audioInput.fft?.length || 0}`
      : '';
    const rendered = PromptLibrary.render('hydra.generate', {
      platform,
      prompt,
      audioContext,
    });
    systemPrompt = rendered.system;
    userPrompt = rendered.user;
  } else {
    const rendered = PromptLibrary.render('p5.generate', { prompt });
    systemPrompt = rendered.system;
    userPrompt = rendered.user;
  }

  const response = await client.generate(systemPrompt, userPrompt, signal);

  if (!response.success || !response.code || response.code.trim().length === 0) {
    return '';
  }

  return response.code.trim();
}

function generateHydraCode(prompt: string, hasAudio: boolean, audioInput?: GenerateVisualsOptions['audioInput']): string {
  const isGlitch = prompt.includes('glitch') || prompt.includes('glitchy') || prompt.includes('pixelate');
  const isReactive = prompt.includes('reactive');

  if (hasAudio && audioInput) {
    const parts: string[] = [];
    if (audioInput.fft != null && audioInput.fft.length > 0) {
      const avg = audioInput.fft.reduce((a, b) => a + b, 0) / audioInput.fft.length;
      parts.push(`// fft modulation\nosc(${0.1 + avg * 2}).out();`);
    }
    if (audioInput.bpm != null) {
      const freq = (audioInput.bpm / 60) * 0.1;
      parts.push(`// bpm=${audioInput.bpm}\nosc(${freq}).out();`);
    }
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  if (isGlitch) {
    return 'noise(4, 0.1).pixelate(20, 30).out();';
  }

  if (isReactive) {
    return 'osc(0.1, 0.01, 1).out();';
  }

  return 'osc().out();';
}

function generateP5Code(prompt: string, hasAudio: boolean, audioInput?: GenerateVisualsOptions['audioInput']): string {
  // Select template based on prompt keywords
  if (prompt.includes('particle')) return particleP5Code(hasAudio, audioInput);
  if (prompt.includes('galax') || prompt.includes('star') || prompt.includes('space')) return galaxyP5Code(hasAudio, audioInput);
  if (prompt.includes('cellular') || prompt.includes('automata')) return cellularP5Code();
  if (prompt.includes('fract') || prompt.includes('fractal')) return fractalP5Code();
  if (prompt.includes('animat') || prompt.includes('moving')) return animatedP5Code(hasAudio, audioInput);
  if (prompt.includes('mouse') || prompt.includes('interact')) return interactiveP5Code();

  // Default
  const base = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  ellipse(width / 2, height / 2, 80, 80);
}`;

  if (!hasAudio || !audioInput) return base;

  const useBpm = audioInput.bpm != null;
  const useFft = audioInput.fft != null && audioInput.fft.length > 0;

  if (useBpm && useFft) {
    return `const bpm = ${audioInput.bpm};
const fft = [${audioInput.fft!.slice(0, 8).join(', ')}];

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  const size = 60 + (fft[0] || 0) * 50;
  ellipse(width / 2, height / 2, size, size);
}`;
  }

  if (useBpm) {
    return `const bpm = ${audioInput.bpm};

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  ellipse(width / 2, height / 2, 80, 80);
}`;
  }

  if (useFft) {
    return `const fft = [${audioInput.fft!.slice(0, 8).join(', ')}];

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  const size = 60 + (fft[0] || 0) * 50;
  ellipse(width / 2, height / 2, size, size);
}`;
  }

  return base;
}

function particleP5Code(hasAudio: boolean, audioInput?: GenerateVisualsOptions['audioInput']): string {
  if (hasAudio && audioInput?.fft) {
    return `const fft = [${audioInput.fft.slice(0, 8).join(', ')}];
function setup() { createCanvas(400, 400); }
function draw() {
  background(20);
  for (let i = 0; i < 50; i++) {
    fill(255, 100 + i * 3, 150);
    const size = 2 + (fft[i % fft.length] || 0) * 50;
    ellipse(Math.random() * width, Math.random() * height, size, size);
  }
}`;
  }
  return `function setup() { createCanvas(400, 400); }
function draw() {
  background(20);
  for (let i = 0; i < 100; i++) {
    fill(255, 100 + i * 1.5, 150 + i);
    ellipse(Math.random() * width, Math.random() * height, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
}`;
}

function galaxyP5Code(hasAudio: boolean, audioInput?: GenerateVisualsOptions['audioInput']): string {
  if (hasAudio && audioInput?.bpm) {
    return `const bpm = ${audioInput.bpm};
function setup() { createCanvas(400, 400); }
function draw() {
  background(5, 5, 15);
  translate(width / 2, height / 2);
  const speed = bpm / 60 * 0.01;
  for (let i = 0; i < 200; i++) {
    const angle = i * 0.1 + frameCount * speed;
    const r = i * 1.5;
    fill(255, 255, 200);
    ellipse(cos(angle) * r, sin(angle) * r, 2, 2);
  }
}`;
  }
  return `function setup() { createCanvas(400, 400); }
function draw() {
  background(5, 5, 15);
  translate(width / 2, height / 2);
  for (let i = 0; i < 200; i++) {
    const angle = i * 0.1;
    const r = i * 1.5;
    fill(255, 255, 200);
    ellipse(cos(angle) * r, sin(angle) * r, 2, 2);
  }
}`;
}

function cellularP5Code(): string {
  return `function setup() { createCanvas(400, 400); }
function draw() {
  background(255);
  const cellSize = 10;
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      if (Math.random() > 0.5) { fill(0); rect(x, y, cellSize, cellSize); }
    }
  }
}`;
}

function fractalP5Code(): string {
  return `function setup() { createCanvas(400, 400); }
function draw() {
  background(255);
  drawCircle(width / 2, height / 2, 300);
}
function drawCircle(x, y, r) {
  ellipse(x, y, r);
  if (r > 20) {
    drawCircle(x + r / 2, y, r / 2);
    drawCircle(x - r / 2, y, r / 2);
  }
}`;
}

function animatedP5Code(hasAudio: boolean, audioInput?: GenerateVisualsOptions['audioInput']): string {
  if (hasAudio && audioInput?.fft) {
    return `const fft = [${audioInput.fft.slice(0, 8).join(', ')}];
function setup() { createCanvas(400, 400); }
function draw() {
  background(20);
  const t = frameCount * 0.02 + (fft[0] || 0) * 0.5;
  translate(width / 2, height / 2);
  for (let i = 0; i < 5; i++) {
    push();
    rotate(t + i * TWO_PI / 5);
    translate(50, 0);
    ellipse(0, 0, 30, 30);
    pop();
  }
}`;
  }
  return `function setup() { createCanvas(400, 400); }
function draw() {
  background(20);
  const t = frameCount * 0.02;
  translate(width / 2, height / 2);
  for (let i = 0; i < 5; i++) {
    push();
    rotate(t + i * TWO_PI / 5);
    translate(50, 0);
    ellipse(0, 0, 30, 30);
    pop();
  }
}`;
}

function interactiveP5Code(): string {
  return `function setup() { createCanvas(400, 400); background(220); }
function draw() {
  if (mouseIsPressed) {
    fill(100, 150, 255, 50);
    noStroke();
    ellipse(mouseX, mouseY, 20, 20);
  }
}
function mousePressed() {
  background(random(255), random(255), random(255));
}`;
}
