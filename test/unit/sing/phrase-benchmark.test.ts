import { describe, expect, it } from 'vitest';
import {
  LFM25_BENCHMARK_CANDIDATES,
  defaultLyricBenchmarkInput,
  recommendPhraseModel,
  runPhraseBenchmark,
  type PhraseBenchmarkMetrics,
  type RealtimeImpactMonitor,
} from '../../../packages/sing/src/lyrics/PhraseBenchmark.js';
import { parseArgs } from '../../../packages/sing/src/lyrics/bench-phrases.js';
import { createMockPhraseGenerator } from '../../../packages/sing/src/lyrics/Teleprompter.js';

describe('Sing phrase benchmark harness', () => {
  it('tracks the LFM2.5 candidates from the model research handoff', () => {
    expect(LFM25_BENCHMARK_CANDIDATES.map((candidate) => candidate.model)).toEqual([
      'LFM2.5-350M',
      'LFM2.5-350M-GGUF',
      'LFM2.5-1.2B-Instruct',
      'LFM2.5-1.2B-Instruct-GGUF',
      'LFM2.5-1.2B-Instruct-MLX',
    ]);
    expect(LFM25_BENCHMARK_CANDIDATES.every((candidate) => candidate.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('generates a recommendation report for a mock local phrase run', async () => {
    let now = 1000;
    const report = await runPhraseBenchmark({
      backend: 'mock',
      model: 'LFM2.5-350M',
      samples: 3,
      input: defaultLyricBenchmarkInput(),
      generator: createMockPhraseGenerator(['blue ash', 'no shore', 'bright dust']),
      machine: 'test-machine',
      generatedAt: '2026-05-25T00:00:00.000Z',
      clock: () => {
        now += 120;
        return now;
      },
      runtimeProbe: {
        memoryMb: () => 128,
        cpuPercent: () => 12,
        gpuPercent: () => null,
      },
    });

    expect(report.generated_at).toBe('2026-05-25T00:00:00.000Z');
    expect(report.metrics.time_to_first_phrase_ms).toBe(120);
    expect(report.metrics.prompt_tokens).toBeGreaterThan(0);
    expect(report.metrics.dropped_render_frames).toBe(0);
    expect(report.metrics.audio_glitches).toBe(0);
    expect(report.recommendation).toMatchObject({
      selected_model: 'LFM2.5-350M',
      accepted: true,
    });
  });

  it('rejects a candidate when realtime impact is attributable to the sidecar', async () => {
    const impactMonitor = (): RealtimeImpactMonitor => ({
      start() {},
      stop() {
        return { dropped_render_frames: 2, audio_glitches: 1 };
      },
    });

    const report = await runPhraseBenchmark({
      backend: 'mock',
      model: 'LFM2.5-1.2B-Instruct',
      samples: 1,
      input: defaultLyricBenchmarkInput(),
      generator: createMockPhraseGenerator(['where the light bends']),
      clock: () => 10,
      impactMonitor,
      performerScore: 5,
    });

    expect(report.recommendation.accepted).toBe(false);
    expect(report.recommendation.selected_model).toBeNull();
    expect(report.recommendation.reasons.join(' ')).toContain('render frames dropped');
    expect(report.recommendation.reasons.join(' ')).toContain('audio glitches');
  });

  it('rejects low usefulness even when machine metrics pass', () => {
    const metrics: PhraseBenchmarkMetrics = {
      prompt_tokens: 30,
      max_new_tokens: 24,
      time_to_first_token_ms: 100,
      time_to_first_phrase_ms: 100,
      tokens_per_second: 20,
      memory_mb: 128,
      peak_memory_mb: 128,
      cpu_percent: 10,
      gpu_percent: null,
      dropped_render_frames: 0,
      dropped_frames: 0,
      audio_glitches: 0,
      performer_score: 2,
    };

    expect(recommendPhraseModel('LFM2.5-350M', metrics)).toMatchObject({
      selected_model: null,
      accepted: false,
    });
  });

  it('parses pnpm forwarded script separators', () => {
    const args = parseArgs(['--', '--backend', 'mock', '--samples', '2', '--out', 'bench.json']);

    expect(args.backend).toBe('mock');
    expect(args.samples).toBe(2);
    expect(args.out.endsWith('bench.json')).toBe(true);
  });
});
