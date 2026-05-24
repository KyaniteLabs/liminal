import { describe, expect, it, vi } from 'vitest';
import {
  extractTextFromHttpResponse,
  parsePhraseFragments,
  runPhraseBenchmark,
  summarizePhraseBenchmark,
  type PhraseBenchmarkSample,
} from '../../../packages/sing/src/teleprompter/benchmark.js';

describe('Sing phrase benchmark harness', () => {
  it('runs the mock backend and reports the required realtime metrics', async () => {
    const report = await runPhraseBenchmark({
      model: 'LiquidAI/LFM2.5-350M',
      backend: 'mock',
      samples: 2,
      requestTimeoutMs: 50,
      memoryMb: () => 128,
    });

    expect(report.ok).toBe(true);
    expect(report.samples_completed).toBe(2);
    expect(report.metrics).toEqual(expect.objectContaining({
      max_new_tokens: 48,
      peak_memory_mb: 128,
      dropped_render_frames: 0,
      audio_glitches: 0,
    }));
    expect(report.recommendation).toEqual(expect.objectContaining({
      status: 'baseline_only',
      selected_model: null,
    }));
  });

  it('selects an HTTP/local model only when latency, output, and stability gates pass', () => {
    const sample = okSample({ sample_index: 0, time_to_first_phrase_ms: 740 });
    const report = summarizePhraseBenchmark({
      backend: 'http',
      model: 'LiquidAI/LFM2.5-1.2B-Instruct-MLX',
      quantization: null,
      promptTokens: 74,
      maxNewTokens: 48,
      machine: 'mac-mini',
      performerScore: 4,
      peakMemoryMb: 512,
      droppedRenderFrames: 0,
      samples: [sample],
    });

    expect(report.recommendation).toEqual({
      status: 'selected',
      selected_model: 'LiquidAI/LFM2.5-1.2B-Instruct-MLX',
      reason: 'Model meets latency, output, render stability, and usefulness gates.',
    });
  });

  it('rejects a local model when the render probe sees dropped frames', () => {
    const report = summarizePhraseBenchmark({
      backend: 'http',
      model: 'LiquidAI/LFM2.5-350M-GGUF',
      quantization: 'q4',
      promptTokens: 74,
      maxNewTokens: 48,
      machine: 'macbook',
      performerScore: 5,
      peakMemoryMb: 256,
      droppedRenderFrames: 1,
      samples: [okSample({ sample_index: 0, time_to_first_phrase_ms: 500 })],
    });

    expect(report.ok).toBe(false);
    expect(report.recommendation.status).toBe('rejected');
    expect(report.recommendation.reason).toContain('render frame drops');
  });

  it('parses common local inference server response shapes', () => {
    expect(extractTextFromHttpResponse(JSON.stringify({ phrases: ['blue ash', 'no shore'] }))).toBe('blue ash\nno shore');
    expect(extractTextFromHttpResponse(JSON.stringify({ text: 'under the glass moon' }))).toBe('under the glass moon');
    expect(extractTextFromHttpResponse(JSON.stringify({ choices: [{ message: { content: 'soft machine' } }] }))).toBe('soft machine');
  });

  it('filters full-lyric or numbered output before scoring samples', () => {
    expect(parsePhraseFragments('1. blue ash\nVerse 1:\nunder the glass moon\nthis line has too many words to be a valid fragment')).toEqual([
      'blue ash',
      'under the glass moon',
    ]);
  });

  it('times out stalled runners instead of waiting on them', async () => {
    const runner = vi.fn(() => new Promise<never>(() => {}));

    const report = await runPhraseBenchmark({
      model: 'LiquidAI/LFM2.5-350M',
      backend: 'http',
      samples: 1,
      requestTimeoutMs: 5,
      runner,
    });

    expect(report.ok).toBe(false);
    expect(report.samples[0]).toEqual(expect.objectContaining({ status: 'timeout' }));
  });
});

function okSample(overrides: Partial<PhraseBenchmarkSample>): PhraseBenchmarkSample {
  return {
    sample_index: 0,
    status: 'ok',
    phrase_count: 2,
    phrases: ['blue ash', 'under the glass moon'],
    time_to_first_token_ms: 300,
    time_to_first_phrase_ms: 500,
    tokens_generated: 6,
    tokens_per_second: 20,
    ...overrides,
  };
}
