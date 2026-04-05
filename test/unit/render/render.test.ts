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
  });

  it('returns zero scores for empty buffer', async () => {
    const scorer = new VisualScorer();
    const result = await scorer.score(Buffer.alloc(0));
    expect(result.score).toBe(0);
  });

  it('scores a synthetic buffer with varied content', async () => {
    const scorer = new VisualScorer();
    // Create a buffer > 100 bytes with varied content
    const buf = Buffer.alloc(1000);
    for (let i = 0; i < 1000; i++) buf[i] = i % 256;
    const result = await scorer.score(buf);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.metrics.uniqueColors).toBeGreaterThan(0);
  });

  it('uses custom weights from options', async () => {
    const scorer = new VisualScorer({
      colorWeight: 1.0,
      edgeWeight: 0,
      compositionWeight: 0,
      contrastWeight: 0,
    });
    // Create a buffer with many different byte values for high color variety
    const buf = Buffer.alloc(5000);
    for (let i = 0; i < 5000; i++) buf[i] = (i * 37) % 256;
    const result = await scorer.score(buf);
    expect(result.score).toBeCloseTo(result.colorVariety, 5);
  });

  it('handles NaN in calculations gracefully', async () => {
    const scorer = new VisualScorer();
    // A buffer of all same value should not cause NaN
    const buf = Buffer.alloc(500);
    buf.fill(128);
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
});
