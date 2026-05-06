import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const { mockLLM } = vi.hoisted(() => ({
  mockLLM: { getConfig: vi.fn(() => ({ model: 'test' })) },
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class { constructor() { return mockLLM; } },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../src/utils/validation.js', () => ({
  validateCode: vi.fn(),
  validateString: vi.fn((_val: string, _label: string) => {}),
}));

vi.mock('../../../src/utils/htmlWrapper.js', () => ({
  HTMLWrapper: {
    wrap: vi.fn((code: string) => `<html><body><canvas></canvas><script>${code}</script></body></html>`),
  },
}));

vi.mock('../../../src/export/VideoExporter.js', () => ({
  VideoExporter: class {
    framesToVideo = vi.fn(async () => {});
  },
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => ({
      newContext: vi.fn(async () => ({
        newPage: vi.fn(async () => ({
          setViewportSize: vi.fn(async () => {}),
          setContent: vi.fn(async () => {}),
          on: vi.fn(),
          waitForFunction: vi.fn(async () => {}),
          waitForTimeout: vi.fn(async () => {}),
          $: vi.fn(async () => null),
          screenshot: vi.fn(async () => Buffer.alloc(100)),
          evaluate: vi.fn(async () => ({ samples: [], sampleRate: 44100, duration: 0.1 })),
          close: vi.fn(async () => {}),
        })),
        close: vi.fn(async () => {}),
      })),
      close: vi.fn(async () => {}),
    })),
  },
}));

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        setViewport: vi.fn(async () => {}),
        setContent: vi.fn(async () => {}),
        waitForSelector: vi.fn(async () => {}),
        $: vi.fn(async () => ({
          screenshot: vi.fn(async () => {}),
        })),
        evaluate: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
      })),
      close: vi.fn(async () => {}),
    })),
  },
}));

import { AudioScorer } from '../../../src/render/AudioScorer.js';
import { VisualScorer } from '../../../src/render/VisualScorer.js';
import { HeadlessRenderer } from '../../../src/render/HeadlessRenderer.js';
import { RenderAndScorePipeline } from '../../../src/render/RenderAndScorePipeline.js';

async function getSharp() {
  const mod = await import('sharp');
  return (mod.default ?? mod) as unknown as {
    (input: unknown, options?: unknown): {
      png(): { toBuffer(): Promise<Buffer> };
    };
  };
}

async function createSolidPng(background: { r: number; g: number; b: number; alpha: number }): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background,
    },
  }).png().toBuffer();
}

async function createVariedPng(): Promise<Buffer> {
  const sharp = await getSharp();
  const width = 8;
  const height = 8;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = x * 32;
      data[idx + 1] = y * 32;
      data[idx + 2] = (x + y) * 16;
      data[idx + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ─── AudioScorer ────────────────────────────────────────────────────

describe('AudioScorer', () => {
  it('returns zero scores for empty samples', () => {
    const scorer = new AudioScorer();
    const result = scorer.score(new Float32Array(0), 44100);
    expect(result.score).toBe(0);
    expect(result.frequencyVariety).toBe(0);
    expect(result.dynamics).toBe(0);
    expect(result.rhythm).toBe(0);
    expect(result.harmonic).toBe(0);
    expect(result.metrics.spectralEntropy).toBe(0);
    expect(result.metrics.dynamicRange).toBe(0);
    expect(result.metrics.onsetCount).toBe(0);
    expect(result.metrics.zeroCrossingRate).toBe(0);
    expect(result.warnings).toEqual(['Audio scoring skipped: no samples provided']);
  });

  it('returns valid scores for a sine wave', () => {
    const scorer = new AudioScorer();
    // Generate a 440Hz sine wave at 44100 sample rate, 1 second
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
    }
    const result = scorer.score(samples, sampleRate);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.frequencyVariety).toBeGreaterThanOrEqual(0);
    expect(result.dynamics).toBeGreaterThanOrEqual(0);
    expect(result.harmonic).toBeGreaterThanOrEqual(0);
  });

  it('clamps final score to 0-1 range', () => {
    const scorer = new AudioScorer({
      frequencyWeight: 10,
      dynamicsWeight: 0,
      rhythmWeight: 0,
      harmonicWeight: 0,
    });
    const samples = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) samples[i] = 0.5;
    const result = scorer.score(samples, 44100);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('uses custom weights from options', () => {
    const scorer = new AudioScorer({
      frequencyWeight: 1.0,
      dynamicsWeight: 0,
      rhythmWeight: 0,
      harmonicWeight: 0,
    });
    const samples = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) samples[i] = Math.sin(i * 0.1) * 0.5;
    const result = scorer.score(samples, 44100);
    // With only frequency weight, score should equal frequency variety
    expect(result.score).toBeCloseTo(result.frequencyVariety, 5);
  });

  it('handles single-sample input without error', () => {
    const scorer = new AudioScorer();
    const result = scorer.score(new Float32Array([0.5]), 44100);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('handles all-zero samples', () => {
    const scorer = new AudioScorer();
    const result = scorer.score(new Float32Array(4096), 44100);
    // All zeros → score is clamped to [0, 1]
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.harmonic).toBeGreaterThanOrEqual(0);
    expect(result.harmonic).toBeLessThanOrEqual(1);
  });

  it('detects zero crossing rate for noisy signal', () => {
    const scorer = new AudioScorer();
    const samples = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
    const result = scorer.score(samples, 44100);
    // White noise should have high frequency variety
    expect(result.frequencyVariety).toBeGreaterThan(0.3);
  });

  it('white noise yields low harmonic score', () => {
    const scorer = new AudioScorer();
    const samples = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
    const result = scorer.score(samples, 44100);
    // White noise is broadband/aperiodic → low harmonic content
    expect(result.harmonic).toBeLessThan(0.4);
  });

  it('alternating loud/quiet yields high dynamics score', () => {
    const scorer = new AudioScorer();
    // Alternating loud (0.8) / quiet (0.05) every 1024 samples
    const samples = new Float32Array(8192);
    for (let i = 0; i < 8192; i++) {
      samples[i] = (Math.floor(i / 1024) % 2 === 0) ? 0.8 : 0.05;
    }
    const result = scorer.score(samples, 44100);
    expect(result.dynamics).toBeGreaterThan(0.5);
  });

  it('regular onset pattern yields high rhythm score', () => {
    const scorer = new AudioScorer();
    // Impulse train: a burst of samples every 4410 samples (10 bursts/sec at 44100Hz)
    const samples = new Float32Array(44100);
    for (let burst = 0; burst < 10; burst++) {
      const start = burst * 4410;
      for (let j = 0; j < 200 && start + j < 44100; j++) {
        samples[start + j] = 0.9;
      }
    }
    const result = scorer.score(samples, 44100);
    expect(result.rhythm).toBeGreaterThan(0.5);
  });

  it('all score outputs are clamped to [0, 1]', () => {
    const scorer = new AudioScorer();
    const samples = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) {
      samples[i] = Math.sin(i * 0.3) * 0.5;
    }
    const result = scorer.score(samples, 44100);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.frequencyVariety).toBeGreaterThanOrEqual(0);
    expect(result.frequencyVariety).toBeLessThanOrEqual(1);
    expect(result.dynamics).toBeGreaterThanOrEqual(0);
    expect(result.dynamics).toBeLessThanOrEqual(1);
    expect(result.rhythm).toBeGreaterThanOrEqual(0);
    expect(result.rhythm).toBeLessThanOrEqual(1);
    expect(result.harmonic).toBeGreaterThanOrEqual(0);
    expect(result.harmonic).toBeLessThanOrEqual(1);
  });
});

// ─── VisualScorer ───────────────────────────────────────────────────

describe('VisualScorer', () => {
  it('returns zero scores for tiny buffer', async () => {
    const scorer = new VisualScorer();
    const result = await scorer.score(Buffer.alloc(10));
    expect(result.score).toBe(0);
    expect(result.colorVariety).toBe(0);
    expect(result.edgeComplexity).toBe(0);
    expect(result.composition).toBe(0);
    expect(result.contrast).toBe(0);
    expect(result.metrics.uniqueColors).toBe(0);
    expect(result.warnings).toEqual(['Visual scoring skipped: screenshot buffer too small']);
  });

  it('returns zero scores for empty buffer', async () => {
    const scorer = new VisualScorer();
    const result = await scorer.score(Buffer.alloc(0));
    expect(result.score).toBe(0);
  });

  it('rejects non-decodable buffers instead of synthetic visual scoring', async () => {
    const scorer = new VisualScorer();
    const buf = Buffer.alloc(1000);
    for (let i = 0; i < 1000; i++) buf[i] = i % 256;
    const result = await scorer.score(buf);
    expect(result.score).toBe(0);
    expect(result.metrics.uniqueColors).toBe(0);
    expect(result.warnings?.join(' ')).toMatch(/decoded image data unavailable|Visual scoring failed/);
  });

  it('rejects a decoded transparent PNG', async () => {
    const scorer = new VisualScorer();
    const result = await scorer.score(await createSolidPng({ r: 0, g: 0, b: 0, alpha: 0 }));
    expect(result.score).toBe(0);
    expect(result.warnings?.join(' ')).toContain('transparent');
  });

  it('rejects a decoded solid PNG', async () => {
    const scorer = new VisualScorer();
    const result = await scorer.score(await createSolidPng({ r: 255, g: 255, b: 255, alpha: 1 }));
    expect(result.score).toBe(0);
    expect(result.warnings?.join(' ')).toMatch(/blank|solid/);
  });

  it('scores a decoded PNG with visible pixel variation', async () => {
    const scorer = new VisualScorer();
    const result = await scorer.score(await createVariedPng());
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.metrics.uniqueColors).toBeGreaterThan(1);
    expect(result.warnings).toBeUndefined();
  });

  it('uses custom weights from options', async () => {
    const scorer = new VisualScorer({
      colorWeight: 1.0,
      edgeWeight: 0,
      compositionWeight: 0,
      contrastWeight: 0,
    });
    const buf = await createVariedPng();
    const result = await scorer.score(buf);
    expect(result.score).toBeCloseTo(result.colorVariety, 5);
  });

  it('handles NaN in calculations gracefully', async () => {
    const scorer = new VisualScorer();
    const buf = await createSolidPng({ r: 128, g: 128, b: 128, alpha: 1 });
    const result = await scorer.score(buf);
    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ─── HeadlessRenderer ───────────────────────────────────────────────

describe('HeadlessRenderer', () => {
  it('detects p5 domain from code', () => {
    expect(HeadlessRenderer.detectDomain('function setup() { createCanvas(400,400); }')).toBe('p5');
  });

  it('detects three domain from code', () => {
    expect(HeadlessRenderer.detectDomain('const scene = new THREE.Scene();')).toBe('three');
  });

  it('detects glsl domain from code', () => {
    expect(HeadlessRenderer.detectDomain('void main() { gl_FragColor = vec4(1.0); }')).toBe('glsl');
  });

  it('detects hydra domain from code', () => {
    expect(HeadlessRenderer.detectDomain('osc(10).out(o0)')).toBe('hydra');
  });

  it('detects strudel domain from code with $.s( and $note(', () => {
    expect(HeadlessRenderer.detectDomain('note("c3").s("bd sd").slow(0.5)')).toBe('strudel');
  });

  it('detects tone domain from code', () => {
    expect(HeadlessRenderer.detectDomain('const synth = new Tone.Synth();')).toBe('tone');
  });

  it('returns unknown for unrecognized code', () => {
    expect(HeadlessRenderer.detectDomain('console.log("hello")')).toBe('unknown');
  });

  it('getInstance returns singleton', () => {
    // Reset singleton first
    HeadlessRenderer.instance = null;
    const a = HeadlessRenderer.getInstance();
    const b = HeadlessRenderer.getInstance();
    expect(a).toBe(b);
    // Clean up
    HeadlessRenderer.instance = null;
  });

  it('isInitialized returns false before init', () => {
    HeadlessRenderer.instance = null;
    const renderer = HeadlessRenderer.getInstance();
    expect(renderer.isInitialized()).toBe(false);
    HeadlessRenderer.instance = null;
  });

  it('recreates browser context when browser exists but context is missing', async () => {
    HeadlessRenderer.instance = null;
    const renderer = HeadlessRenderer.getInstance() as HeadlessRenderer & {
      browser: { newContext: () => Promise<unknown> };
      context: unknown;
    };

    const newContext = { close: vi.fn().mockResolvedValue(undefined) };
    renderer.browser = {
      newContext: vi.fn().mockResolvedValue(newContext),
    } as unknown as { newContext: () => Promise<unknown> };
    renderer.context = null;

    await renderer.initialize();

    expect(renderer.browser.newContext).toHaveBeenCalled();
    expect(renderer.context).toBe(newContext);
    HeadlessRenderer.instance = null;
  });

  it('surfaces missing canvas warnings for visual domains without failing the render outright', async () => {
    const renderer = new HeadlessRenderer() as HeadlessRenderer & {
      context: { newPage: () => Promise<unknown> };
      initialize: () => Promise<void>;
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<{
        buffer: Buffer;
        width: number;
        height: number;
        success: boolean;
      }>;
    };

    const fakePage = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.initialize = vi.fn().mockResolvedValue(undefined);
    renderer.waitForCanvas = vi.fn().mockResolvedValue(false);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      buffer: Buffer.from([1]),
      width: 100,
      height: 100,
      success: true,
    });

    const result = await renderer.render('const scene = new THREE.Scene();', {
      domain: 'three',
      waitForStabilization: false,
    });

    expect(result.success).toBe(true);
    expect(result.logs).toContain('[warn] Canvas not found or timed out for three render');
    expect(result.errors).toContain('Canvas not found or timed out for three render');
  });

  it('closes render pages by default after capture', async () => {
    const fakePage = {
      setViewportSize: vi.fn(async () => {}),
      setContent: vi.fn(async () => {}),
      on: vi.fn(),
      waitForFunction: vi.fn(async () => {}),
      waitForTimeout: vi.fn(async () => {}),
      $: vi.fn(async () => null),
      screenshot: vi.fn(async () => Buffer.alloc(100)),
      evaluate: vi.fn(async () => ({ samples: [], sampleRate: 44100, duration: 0.1, hasAudio: false, warnings: [] })),
      close: vi.fn(async () => {}),
    };

    const renderer = HeadlessRenderer.getInstance() as unknown as {
      browser: Record<string, unknown>;
      context: { newPage: () => Promise<unknown> };
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<unknown>;
    };

    renderer.browser = {} as never;
    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.waitForCanvas = vi.fn().mockResolvedValue(true);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      success: true,
      buffer: Buffer.alloc(100),
      width: 100,
      height: 100,
    });

    const result = await HeadlessRenderer.getInstance().render('function setup(){createCanvas(100,100)}', { domain: 'p5' });

    expect(result.success).toBe(true);
    expect(result.page).toBeUndefined();
    expect(fakePage.close).toHaveBeenCalledTimes(1);
  });

  it('keeps render pages open when explicitly requested', async () => {
    const fakePage = {
      setViewportSize: vi.fn(async () => {}),
      setContent: vi.fn(async () => {}),
      on: vi.fn(),
      waitForFunction: vi.fn(async () => {}),
      waitForTimeout: vi.fn(async () => {}),
      $: vi.fn(async () => null),
      screenshot: vi.fn(async () => Buffer.alloc(100)),
      evaluate: vi.fn(async () => ({ samples: [], sampleRate: 44100, duration: 0.1, hasAudio: false, warnings: [] })),
      close: vi.fn(async () => {}),
    };

    const renderer = HeadlessRenderer.getInstance() as unknown as {
      browser: Record<string, unknown>;
      context: { newPage: () => Promise<unknown> };
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<unknown>;
    };

    renderer.browser = {} as never;
    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.waitForCanvas = vi.fn().mockResolvedValue(true);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      success: true,
      buffer: Buffer.alloc(100),
      width: 100,
      height: 100,
    });

    const result = await HeadlessRenderer.getInstance().render('function setup(){createCanvas(100,100)}', {
      domain: 'p5',
      keepPageOpen: true,
    });

    expect(result.success).toBe(true);
    expect(result.page).toBe(fakePage);
    expect(fakePage.close).not.toHaveBeenCalled();
  });

  it('propagates screenshot failure reasons to the top-level render result', async () => {
    const renderer = new HeadlessRenderer() as HeadlessRenderer & {
      context: { newPage: () => Promise<unknown> };
      initialize: () => Promise<void>;
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<{
        buffer: Buffer;
        width: number;
        height: number;
        success: boolean;
        error: string;
      }>;
    };

    const fakePage = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.initialize = vi.fn().mockResolvedValue(undefined);
    renderer.waitForCanvas = vi.fn().mockResolvedValue(true);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      buffer: Buffer.alloc(0),
      width: 0,
      height: 0,
      success: false,
      error: 'Screenshot failed: target page closed',
    });

    const result = await renderer.render('function setup(){createCanvas(10,10)}', {
      domain: 'p5',
      waitForStabilization: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Screenshot failed: target page closed');
    expect(result.logs).toContain('[warn] Screenshot failed: target page closed');
    expect(result.errors).toContain('Screenshot failed: target page closed');
  });

  it('surfaces missing audio captures for audio domains', async () => {
    const renderer = new HeadlessRenderer() as HeadlessRenderer & {
      context: { newPage: () => Promise<unknown> };
      initialize: () => Promise<void>;
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<{
        buffer: Buffer;
        width: number;
        height: number;
        success: boolean;
      }>;
      captureAudio: () => Promise<{
        samples: Float32Array;
        sampleRate: number;
        duration: number;
        success: boolean;
        error: string;
      }>;
      injectAudioCapture: () => Promise<void>;
      triggerAudioPlayback: () => Promise<void>;
    };

    const fakePage = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.initialize = vi.fn().mockResolvedValue(undefined);
    renderer.waitForCanvas = vi.fn().mockResolvedValue(false);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      buffer: Buffer.from([1]),
      width: 100,
      height: 100,
      success: true,
    });
    renderer.captureAudio = vi.fn().mockResolvedValue({
      samples: new Float32Array(0),
      sampleRate: 44100,
      duration: 1,
      success: false,
      error: 'No audio captured during render window',
      warnings: [],
    });
    renderer.injectAudioCapture = vi.fn().mockResolvedValue(undefined);
    renderer.triggerAudioPlayback = vi.fn().mockResolvedValue(undefined);

    const result = await renderer.render('const synth = new Tone.Synth();', {
      domain: 'tone',
      waitForStabilization: false,
    });

    expect(result.success).toBe(true);
    expect(result.audio?.success).toBe(false);
    expect(result.logs).toContain('[warn] No audio captured during render window');
    expect(result.errors).toContain('No audio captured during render window');
  });

  it('surfaces audio playback trigger failures for audio domains', async () => {
    const renderer = new HeadlessRenderer() as HeadlessRenderer & {
      context: { newPage: () => Promise<unknown> };
      initialize: () => Promise<void>;
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<{
        buffer: Buffer;
        width: number;
        height: number;
        success: boolean;
      }>;
      captureAudio: () => Promise<{
        samples: Float32Array;
        sampleRate: number;
        duration: number;
        success: boolean;
      }>;
      injectAudioCapture: () => Promise<void>;
      triggerAudioPlayback: () => Promise<string>;
    };

    const fakePage = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.initialize = vi.fn().mockResolvedValue(undefined);
    renderer.waitForCanvas = vi.fn().mockResolvedValue(false);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      buffer: Buffer.from([1]),
      width: 100,
      height: 100,
      success: true,
    });
    renderer.captureAudio = vi.fn().mockResolvedValue({
      samples: new Float32Array([0.1]),
      sampleRate: 44100,
      duration: 1,
      success: true,
      warnings: [],
    });
    renderer.injectAudioCapture = vi.fn().mockResolvedValue(undefined);
    renderer.triggerAudioPlayback = vi.fn().mockResolvedValue('Audio playback trigger failed for tone: user gesture required');

    const result = await renderer.render('const synth = new Tone.Synth();', {
      domain: 'tone',
      waitForStabilization: false,
    });

    expect(result.success).toBe(true);
    expect(result.logs).toContain('[warn] Audio playback trigger failed for tone: user gesture required');
    expect(result.errors).toContain('Audio playback trigger failed for tone: user gesture required');
  });

  it('surfaces browser-side audio capture instrumentation warnings', async () => {
    const renderer = new HeadlessRenderer() as HeadlessRenderer & {
      context: { newPage: () => Promise<unknown> };
      initialize: () => Promise<void>;
      waitForCanvas: () => Promise<boolean>;
      captureScreenshot: () => Promise<{
        buffer: Buffer;
        width: number;
        height: number;
        success: boolean;
      }>;
      captureAudio: () => Promise<{
        samples: Float32Array;
        sampleRate: number;
        duration: number;
        success: boolean;
        warnings: string[];
      }>;
      injectAudioCapture: () => Promise<void>;
      triggerAudioPlayback: () => Promise<null>;
    };

    const fakePage = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
    };

    renderer.context = {
      newPage: vi.fn().mockResolvedValue(fakePage),
    };
    renderer.initialize = vi.fn().mockResolvedValue(undefined);
    renderer.waitForCanvas = vi.fn().mockResolvedValue(false);
    renderer.captureScreenshot = vi.fn().mockResolvedValue({
      buffer: Buffer.from([1]),
      width: 100,
      height: 100,
      success: true,
    });
    renderer.captureAudio = vi.fn().mockResolvedValue({
      samples: new Float32Array([0.1]),
      sampleRate: 44100,
      duration: 1,
      success: true,
      warnings: ['Audio capture setup failed: NotSupportedError'],
    });
    renderer.injectAudioCapture = vi.fn().mockResolvedValue(undefined);
    renderer.triggerAudioPlayback = vi.fn().mockResolvedValue(null);

    const result = await renderer.render('const synth = new Tone.Synth();', {
      domain: 'tone',
      waitForStabilization: false,
    });

    expect(result.success).toBe(true);
    expect(result.logs).toContain('[warn] Audio capture setup failed: NotSupportedError');
    expect(result.errors).toContain('Audio capture setup failed: NotSupportedError');
  });
});

// ─── RenderAndScorePipeline ─────────────────────────────────────────

describe('RenderAndScorePipeline', () => {
  it('blendScores with linear mode computes weighted average', () => {
    const result = RenderAndScorePipeline.blendScores({
      baseScore: 0.6,
      renderScore: 0.8,
      renderWeight: 0.5,
      mode: 'linear',
    });
    // 0.6 * 0.5 + 0.8 * 0.5 = 0.7
    expect(result).toBeCloseTo(0.7, 5);
  });

  it('blendScores with linear mode and 0 weight returns base score', () => {
    const result = RenderAndScorePipeline.blendScores({
      baseScore: 0.6,
      renderScore: 0.8,
      renderWeight: 0,
      mode: 'linear',
    });
    expect(result).toBeCloseTo(0.6, 5);
  });

  it('blendScores with adaptive mode adjusts weight based on base score', () => {
    const result = RenderAndScorePipeline.blendScores({
      baseScore: 0.8,
      renderScore: 0.4,
      renderWeight: 0.5,
      mode: 'adaptive',
    });
    // adaptive weight = 0.5 * (0.5 + 0.8 * 0.5) = 0.5 * 0.9 = 0.45
    // result = 0.8 * (1 - 0.45) + 0.4 * 0.45 = 0.8 * 0.55 + 0.18 = 0.44 + 0.18 = 0.62
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(0.8);
  });

  it('blendScores defaults to linear mode', () => {
    const result = RenderAndScorePipeline.blendScores({
      baseScore: 0.5,
      renderScore: 0.9,
      renderWeight: 0.5,
    });
    expect(result).toBeCloseTo(0.7, 5);
  });

  it('blendScores with renderWeight 1 returns render score in linear mode', () => {
    const result = RenderAndScorePipeline.blendScores({
      baseScore: 0.0,
      renderScore: 0.9,
      renderWeight: 1.0,
      mode: 'linear',
    });
    expect(result).toBeCloseTo(0.9, 5);
  });

  it('propagates non-fatal render degradation warnings to pipeline callers', async () => {
    const pipeline = new RenderAndScorePipeline({
      scoreVisual: false,
      scoreAudio: false,
    }) as RenderAndScorePipeline & {
      renderer: { render: (code: string, options?: unknown) => Promise<unknown> };
    };

    pipeline.renderer = {
      render: vi.fn().mockResolvedValue({
        success: true,
        logs: ['[warn] Canvas not found or timed out for three render'],
        errors: ['Canvas not found or timed out for three render'],
      }),
    };

    const result = await pipeline.process('const scene = new THREE.Scene();', 'three');

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(['Canvas not found or timed out for three render']);
  });

  it('propagates non-fatal scoring failures to pipeline callers', async () => {
    const pipeline = new RenderAndScorePipeline({
      scoreVisual: true,
      scoreAudio: false,
    }) as RenderAndScorePipeline & {
      renderer: { render: (code: string, options?: unknown) => Promise<unknown> };
      visualScorer: { score: (buffer: Buffer) => Promise<unknown> };
    };

    pipeline.renderer = {
      render: vi.fn().mockResolvedValue({
        success: true,
        logs: [],
        errors: [],
        screenshot: {
          success: true,
          buffer: Buffer.from([1, 2, 3]),
        },
      }),
    };
    pipeline.visualScorer = {
      score: vi.fn().mockRejectedValue(new Error('sharp decode failed')),
    };

    const result = await pipeline.process('function setup(){createCanvas(10,10)}', 'p5');

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(['Visual scoring failed: sharp decode failed']);
  });

  it('reports when expected visual scoring is skipped because screenshot capture is unavailable', async () => {
    const pipeline = new RenderAndScorePipeline({
      scoreVisual: true,
      scoreAudio: false,
    }) as RenderAndScorePipeline & {
      renderer: { render: (code: string, options?: unknown) => Promise<unknown> };
    };

    pipeline.renderer = {
      render: vi.fn().mockResolvedValue({
        success: true,
        logs: [],
        errors: [],
        screenshot: {
          success: false,
          error: 'Screenshot failed: target page closed',
        },
      }),
    };

    const result = await pipeline.process('function setup(){createCanvas(10,10)}', 'p5');

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(['Visual scoring skipped: Screenshot failed: target page closed']);
  });

  it('propagates scorer-provided warnings to pipeline callers', async () => {
    const pipeline = new RenderAndScorePipeline({
      scoreVisual: true,
      scoreAudio: false,
    }) as RenderAndScorePipeline & {
      renderer: { render: (code: string, options?: unknown) => Promise<unknown> };
      visualScorer: { score: (buffer: Buffer) => Promise<unknown> };
    };

    pipeline.renderer = {
      render: vi.fn().mockResolvedValue({
        success: true,
        logs: [],
        errors: [],
        screenshot: {
          success: true,
          buffer: Buffer.from([1, 2, 3]),
        },
      }),
    };
    pipeline.visualScorer = {
      score: vi.fn().mockResolvedValue({
        score: 0,
        colorVariety: 0,
        edgeComplexity: 0,
        composition: 0,
        contrast: 0,
        metrics: { uniqueColors: 0, edgeDensity: 0, brightnessMean: 0, brightnessStd: 0 },
        warnings: ['Visual scoring skipped: screenshot buffer too small'],
      }),
    };

    const result = await pipeline.process('function setup(){createCanvas(10,10)}', 'p5');

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual(['Visual scoring skipped: screenshot buffer too small']);
  });

  it('prefers fewer warnings when batch scores tie', async () => {
    const pipeline = new RenderAndScorePipeline() as RenderAndScorePipeline & {
      process: (code: string, domainHint?: unknown) => Promise<unknown>;
    };

    pipeline.process = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        score: 0.8,
        domain: 'p5',
        duration: 10,
        warnings: ['Visual scoring skipped: screenshot buffer too small'],
      })
      .mockResolvedValueOnce({
        success: true,
        score: 0.8,
        domain: 'p5',
        duration: 12,
      });

    const result = await pipeline.processBatch(['first', 'second'], 'p5');

    expect(result.bestIndex).toBe(1);
    expect(result.bestResult.warnings).toBeUndefined();
  });
});
