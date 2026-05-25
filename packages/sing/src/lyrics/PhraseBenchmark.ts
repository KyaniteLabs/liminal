import {
  buildLyricSidecarPrompt,
  createMockPhraseGenerator,
  isValidPhraseFragment,
  type LyricSidecarInput,
  type PhraseGenerator,
} from './Teleprompter.js';

export type PhraseBenchmarkBackend = 'mock' | 'openai-compatible';

export interface PhraseBenchmarkCandidate {
  model: string;
  defaultBackend: PhraseBenchmarkBackend;
  quantization?: string;
  sourceUrl: string;
  notes: string;
}

export interface PhraseBenchmarkMetrics {
  prompt_tokens: number;
  max_new_tokens: number;
  time_to_first_token_ms: number;
  time_to_first_phrase_ms: number;
  tokens_per_second: number;
  memory_mb: number | null;
  peak_memory_mb: number | null;
  cpu_percent: number | null;
  gpu_percent: number | null;
  dropped_render_frames: number;
  dropped_frames: number;
  audio_glitches: number;
  performer_score: number;
}

export interface PhraseBenchmarkSample {
  index: number;
  elapsed_ms: number;
  phrase_count: number;
  valid_phrase_count: number;
  token_count: number;
  first_phrase: string | null;
}

export interface PhraseBenchmarkRecommendation {
  selected_model: string | null;
  accepted: boolean;
  reasons: string[];
}

export interface PhraseBenchmarkReport {
  generated_at: string;
  machine: string;
  backend: PhraseBenchmarkBackend;
  model: string;
  quantization?: string;
  samples_requested: number;
  samples: PhraseBenchmarkSample[];
  metrics: PhraseBenchmarkMetrics;
  recommendation: PhraseBenchmarkRecommendation;
}

export interface RuntimeProbe {
  memoryMb(): number | null;
  cpuPercent(elapsedMs: number): number | null;
  gpuPercent(): number | null;
}

export interface RealtimeImpactMonitor {
  start(): void;
  stop(): RealtimeImpactMetrics;
}

export interface RealtimeImpactMetrics {
  dropped_render_frames: number;
  audio_glitches: number;
}

export interface PhraseBenchmarkOptions {
  backend: PhraseBenchmarkBackend;
  model: string;
  samples: number;
  input: LyricSidecarInput;
  generator?: PhraseGenerator;
  maxNewTokens?: number;
  machine?: string;
  quantization?: string;
  performerScore?: number;
  clock?: () => number;
  runtimeProbe?: RuntimeProbe;
  impactMonitor?: () => RealtimeImpactMonitor;
  generatedAt?: string;
}

export const LFM25_BENCHMARK_CANDIDATES: PhraseBenchmarkCandidate[] = [
  {
    model: 'LFM2.5-350M',
    defaultBackend: 'openai-compatible',
    sourceUrl: 'https://docs.liquid.ai/lfm/models/lfm25-350m',
    notes: '350M dense text model for strict memory and latency budgets.',
  },
  {
    model: 'LFM2.5-350M-GGUF',
    defaultBackend: 'openai-compatible',
    quantization: 'GGUF',
    sourceUrl: 'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF',
    notes: 'llama.cpp-compatible checkpoint for local CPU/GPU tests.',
  },
  {
    model: 'LFM2.5-1.2B-Instruct',
    defaultBackend: 'openai-compatible',
    sourceUrl: 'https://docs.liquid.ai/lfm/models/lfm25-1.2b-instruct',
    notes: 'Instruction-tuned 1.2B model for better prompt following.',
  },
  {
    model: 'LFM2.5-1.2B-Instruct-GGUF',
    defaultBackend: 'openai-compatible',
    quantization: 'GGUF',
    sourceUrl: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF',
    notes: 'llama.cpp-compatible 1.2B instruct checkpoint.',
  },
  {
    model: 'LFM2.5-1.2B-Instruct-MLX',
    defaultBackend: 'openai-compatible',
    quantization: 'MLX',
    sourceUrl: 'https://huggingface.co/collections/LiquidAI/lfm25',
    notes: 'Apple Silicon MLX checkpoint family for local Mac benchmarks.',
  },
];

export const PHRASE_BENCHMARK_TARGETS = {
  maxFirstPhraseMs: 1500,
  maxDroppedRenderFrames: 0,
  maxAudioGlitches: 0,
  minPerformerScore: 3,
};

export function defaultLyricBenchmarkInput(): LyricSidecarInput {
  return {
    presetId: 'sing-benchmark',
    sceneName: 'Sing Benchmark',
    visualTags: ['voice', 'shader', 'benchmark'],
    recentAcceptedPhrases: [],
    recentDismissedPhrases: [],
    audioMood: {
      intensity: 'soft',
      pitchMotion: 'wandering',
      brightness: 'balanced',
      onsetDensity: 'sparse',
      vibrato: 'none',
    },
  };
}

export async function runPhraseBenchmark(options: PhraseBenchmarkOptions): Promise<PhraseBenchmarkReport> {
  const samples = Math.max(1, Math.floor(options.samples));
  const clock = options.clock ?? (() => performance.now());
  const maxNewTokens = options.maxNewTokens ?? 24;
  const generator = options.generator ?? createMockPhraseGenerator();
  const prompt = buildLyricSidecarPrompt(options.input, 1);
  const promptTokens = estimateTokenCount(prompt);
  const sampleReports: PhraseBenchmarkSample[] = [];
  const allFragments: string[] = [];
  let totalElapsedMs = 0;
  let totalTokens = 0;
  let droppedFrames = 0;
  let audioGlitches = 0;
  let peakMemoryMb = options.runtimeProbe?.memoryMb() ?? null;
  const started = clock();

  for (let index = 0; index < samples; index += 1) {
    const monitor = options.impactMonitor?.();
    monitor?.start();
    const sampleStart = clock();
    const fragments = await generator.generate(options.input, { count: 1 });
    const elapsedMs = Math.max(0, clock() - sampleStart);
    const impact = monitor?.stop() ?? { dropped_render_frames: 0, audio_glitches: 0 };
    const validFragments = fragments.filter(isValidPhraseFragment);
    const tokenCount = estimateTokenCount(validFragments.join(' '));

    droppedFrames += impact.dropped_render_frames;
    audioGlitches += impact.audio_glitches;
    totalElapsedMs += elapsedMs;
    totalTokens += tokenCount;
    allFragments.push(...validFragments);
    const memoryMb = options.runtimeProbe?.memoryMb() ?? null;
    peakMemoryMb = maxNullable(peakMemoryMb, memoryMb);
    sampleReports.push({
      index,
      elapsed_ms: roundMetric(elapsedMs),
      phrase_count: fragments.length,
      valid_phrase_count: validFragments.length,
      token_count: tokenCount,
      first_phrase: validFragments[0] ?? null,
    });
  }

  const totalWallMs = Math.max(1, clock() - started);
  const firstPhraseMs = average(sampleReports.map((sample) => sample.elapsed_ms));
  const performerScore = options.performerScore ?? scorePerformerUsefulness(allFragments);
  const metrics: PhraseBenchmarkMetrics = {
    prompt_tokens: promptTokens,
    max_new_tokens: maxNewTokens,
    time_to_first_token_ms: firstPhraseMs,
    time_to_first_phrase_ms: firstPhraseMs,
    tokens_per_second: roundMetric(totalTokens / (Math.max(totalElapsedMs, 1) / 1000)),
    memory_mb: peakMemoryMb,
    peak_memory_mb: peakMemoryMb,
    cpu_percent: options.runtimeProbe?.cpuPercent(totalWallMs) ?? null,
    gpu_percent: options.runtimeProbe?.gpuPercent() ?? null,
    dropped_render_frames: droppedFrames,
    dropped_frames: droppedFrames,
    audio_glitches: audioGlitches,
    performer_score: performerScore,
  };

  return {
    generated_at: options.generatedAt ?? new Date().toISOString(),
    machine: options.machine ?? 'unknown',
    backend: options.backend,
    model: options.model,
    quantization: options.quantization,
    samples_requested: samples,
    samples: sampleReports,
    metrics,
    recommendation: recommendPhraseModel(options.model, metrics),
  };
}

export function recommendPhraseModel(model: string, metrics: PhraseBenchmarkMetrics): PhraseBenchmarkRecommendation {
  const reasons: string[] = [];
  if (metrics.time_to_first_phrase_ms > PHRASE_BENCHMARK_TARGETS.maxFirstPhraseMs) {
    reasons.push(`first phrase ${metrics.time_to_first_phrase_ms}ms exceeds ${PHRASE_BENCHMARK_TARGETS.maxFirstPhraseMs}ms`);
  }
  if (metrics.dropped_render_frames > PHRASE_BENCHMARK_TARGETS.maxDroppedRenderFrames) {
    reasons.push(`${metrics.dropped_render_frames} render frames dropped`);
  }
  if (metrics.audio_glitches > PHRASE_BENCHMARK_TARGETS.maxAudioGlitches) {
    reasons.push(`${metrics.audio_glitches} audio glitches detected`);
  }
  if (metrics.performer_score < PHRASE_BENCHMARK_TARGETS.minPerformerScore) {
    reasons.push(`performer score ${metrics.performer_score} is below ${PHRASE_BENCHMARK_TARGETS.minPerformerScore}`);
  }
  return {
    selected_model: reasons.length === 0 ? model : null,
    accepted: reasons.length === 0,
    reasons: reasons.length === 0 ? ['meets phrase latency, realtime, and usefulness targets'] : reasons,
  };
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function scorePerformerUsefulness(fragments: string[]): number {
  if (fragments.length === 0) return 1;
  const unique = new Set(fragments.map((fragment) => fragment.toLowerCase())).size;
  const diversity = unique / fragments.length;
  if (diversity > 0.8) return 4;
  if (diversity > 0.5) return 3;
  return 2;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left == null) return right;
  if (right == null) return left;
  return Math.max(left, right);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}
