/**
 * generateVisuals API
 *
 * Returns Hydra or p5.js code from a prompt, optionally modulated by audioInput (fft/bpm).
 */

export interface GenerateVisualsOptions {
  prompt: string;
  audioInput?: {
    fft?: number[];
    bpm?: number;
  };
  platform?: 'hydra' | 'p5';
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
  const { prompt, audioInput, platform = 'hydra' } = options;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('prompt is required and must be a non-empty string');
  }

  if (platform === 'hydra') {
    return { code: generateHydraCode(prompt.trim().toLowerCase(), !!audioInput, audioInput) };
  }

  if (platform === 'p5') {
    return { code: generateP5Code(!!audioInput, audioInput) };
  }

  throw new Error(`Unsupported platform: ${platform}. Use 'hydra' or 'p5'.`);
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

function generateP5Code(hasAudio: boolean, audioInput?: GenerateVisualsOptions['audioInput']): string {
  const base = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(20);
  ellipse(width / 2, height / 2, 80, 80);
}`;

  if (!hasAudio || !audioInput) {
    return base;
  }

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
