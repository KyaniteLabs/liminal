import {
  buildLyricPrompt,
  requestPhraseBatch,
  type LyricSidecarInput,
  type PhraseSuggestion,
} from './phrases.js';

export const LFM25_CANDIDATE_MODELS = [
  'LiquidAI/LFM2.5-350M',
  'LiquidAI/LFM2.5-350M-GGUF',
  'LiquidAI/LFM2.5-1.2B-Instruct',
  'LiquidAI/LFM2.5-1.2B-Instruct-GGUF',
  'LiquidAI/LFM2.5-1.2B-Instruct-MLX',
] as const;

export type PhraseBenchmarkBackend = 'mock' | 'http' | 'openai';
export type PhraseBenchmarkStatus = 'ok' | 'timeout' | 'error' | 'invalid_output';
export type PhraseBenchmarkRecommendationStatus = 'selected' | 'rejected' | 'baseline_only' | 'failed';

export interface PhraseBenchmarkInputOptions {
  model: string;
  backend: PhraseBenchmarkBackend;
  samples: number;
  input?: LyricSidecarInput;
  requestTimeoutMs?: number;
  maxNewTokens?: number;
  quantization?: string;
  performerScore?: number;
  endpoint?: string;
  fetchImpl?: FetchLike;
  runner?: PhraseBenchmarkRunner;
  memoryMb?: () => number | null;
  clock?: () => number;
}

export interface PhraseBenchmarkRunnerResult {
  text: string;
  timeToFirstTokenMs?: number;
  timeToFirstPhraseMs?: number;
  tokensGenerated?: number;
}

export type PhraseBenchmarkRunner = (
  prompt: string,
  input: LyricSidecarInput,
  options: {
    sampleIndex: number;
    requestTimeoutMs: number;
    maxNewTokens: number;
  },
) => Promise<PhraseBenchmarkRunnerResult>;

export interface PhraseBenchmarkSample {
  sample_index: number;
  status: PhraseBenchmarkStatus;
  phrase_count: number;
  phrases: string[];
  time_to_first_token_ms: number | null;
  time_to_first_phrase_ms: number | null;
  tokens_generated: number;
  tokens_per_second: number | null;
  error?: string;
}

export interface PhraseBenchmarkMetrics {
  prompt_tokens: number;
  max_new_tokens: number;
  time_to_first_token_ms: number | null;
  time_to_first_phrase_ms: number | null;
  tokens_per_second: number | null;
  peak_memory_mb: number | null;
  cpu_percent: number | null;
  gpu_percent: number | null;
  dropped_render_frames: number;
  audio_glitches: number;
  performer_score: number | null;
}

export interface PhraseBenchmarkReport {
  ok: boolean;
  generated_at: string;
  machine: string;
  backend: PhraseBenchmarkBackend;
  model: string;
  quantization: string | null;
  samples_requested: number;
  samples_completed: number;
  metrics: PhraseBenchmarkMetrics;
  recommendation: {
    status: PhraseBenchmarkRecommendationStatus;
    selected_model: string | null;
    reason: string;
  };
  samples: PhraseBenchmarkSample[];
}

export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchLikeResponse>;

const DEFAULT_SAMPLE_COUNT = 50;
const DEFAULT_REQUEST_TIMEOUT_MS = 2500;
const DEFAULT_MAX_NEW_TOKENS = 48;
const DEFAULT_MACHINE = 'unknown';
const DEFAULT_INPUT: LyricSidecarInput = {
  presetId: 'voice-bloom',
  sceneName: 'Voice Bloom',
  visualTags: ['voice', 'glsl', 'blue'],
  recentAcceptedPhrases: [],
  recentDismissedPhrases: [],
  audioMood: {
    intensity: 'medium',
    pitchMotion: 'wandering',
    brightness: 'balanced',
    onsetDensity: 'sparse',
    vibrato: 'subtle',
  },
};

export async function runPhraseBenchmark(options: PhraseBenchmarkInputOptions): Promise<PhraseBenchmarkReport> {
  const samples = Math.max(1, Math.floor(options.samples || DEFAULT_SAMPLE_COUNT));
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxNewTokens = options.maxNewTokens ?? DEFAULT_MAX_NEW_TOKENS;
  const input = options.input ?? DEFAULT_INPUT;
  const prompt = buildLyricPrompt(input, 5);
  const runner = options.runner ?? createRunner(options);
  const memoryMb = options.memoryMb ?? (() => null);
  const clock = options.clock ?? (() => globalThis.performance.now());
  const renderProbe = new RenderLoopProbe({ clock });
  const rows: PhraseBenchmarkSample[] = [];
  let peakMemoryMb = memoryMb();

  renderProbe.start();
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    const row = await runSample(runner, prompt, input, {
      sampleIndex,
      requestTimeoutMs,
      maxNewTokens,
      clock,
    });
    rows.push(row);
    const nextMemoryMb = memoryMb();
    peakMemoryMb = maxNullable(peakMemoryMb, nextMemoryMb);
  }
  await waitForTimerTurn();
  const renderLoop = renderProbe.stop();

  return summarizePhraseBenchmark({
    backend: options.backend,
    model: options.model,
    quantization: options.quantization ?? null,
    promptTokens: estimateTokens(prompt),
    maxNewTokens,
    machine: options.endpoint ? `${DEFAULT_MACHINE}:${new URL(options.endpoint).host}` : DEFAULT_MACHINE,
    performerScore: options.performerScore ?? null,
    peakMemoryMb,
    droppedRenderFrames: renderLoop.droppedRenderFrames,
    samples: rows,
  });
}

export function summarizePhraseBenchmark(input: {
  backend: PhraseBenchmarkBackend;
  model: string;
  quantization: string | null;
  promptTokens: number;
  maxNewTokens: number;
  machine: string;
  performerScore: number | null;
  peakMemoryMb: number | null;
  droppedRenderFrames: number;
  samples: PhraseBenchmarkSample[];
}): PhraseBenchmarkReport {
  const completed = input.samples.filter((sample) => sample.status === 'ok');
  const metrics: PhraseBenchmarkMetrics = {
    prompt_tokens: input.promptTokens,
    max_new_tokens: input.maxNewTokens,
    time_to_first_token_ms: averageNullable(completed.map((sample) => sample.time_to_first_token_ms)),
    time_to_first_phrase_ms: averageNullable(completed.map((sample) => sample.time_to_first_phrase_ms)),
    tokens_per_second: averageNullable(completed.map((sample) => sample.tokens_per_second)),
    peak_memory_mb: input.peakMemoryMb,
    cpu_percent: null,
    gpu_percent: null,
    dropped_render_frames: input.droppedRenderFrames,
    audio_glitches: 0,
    performer_score: input.performerScore,
  };
  const recommendation = recommendModel({
    backend: input.backend,
    model: input.model,
    samplesCompleted: completed.length,
    samplesRequested: input.samples.length,
    metrics,
  });

  return {
    ok: recommendation.status === 'selected' || recommendation.status === 'baseline_only',
    generated_at: new Date().toISOString(),
    machine: input.machine,
    backend: input.backend,
    model: input.model,
    quantization: input.quantization,
    samples_requested: input.samples.length,
    samples_completed: completed.length,
    metrics,
    recommendation,
    samples: input.samples,
  };
}

export function parsePhraseFragments(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter((line) => {
      const words = line.split(/\s+/).filter(Boolean);
      return words.length >= 1 && words.length <= 6 && !/verse|chorus/i.test(line);
    });
}

export function extractTextFromHttpResponse(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'string') return parsed;
    if (isRecord(parsed)) {
      if (Array.isArray(parsed.phrases)) return parsed.phrases.filter((item) => typeof item === 'string').join('\n');
      if (typeof parsed.text === 'string') return parsed.text;
      if (typeof parsed.completion === 'string') return parsed.completion;
      const choices = parsed.choices;
      if (Array.isArray(choices) && choices.length > 0 && isRecord(choices[0])) {
        if (typeof choices[0].text === 'string') return choices[0].text;
        const message = choices[0].message;
        if (isRecord(message) && typeof message.content === 'string') return message.content;
      }
    }
  } catch {
    return raw;
  }
  return raw;
}

function createRunner(options: PhraseBenchmarkInputOptions): PhraseBenchmarkRunner {
  switch (options.backend) {
    case 'mock':
      return createMockRunner(options.clock);
    case 'http':
      return createHttpRunner(options);
    case 'openai':
      return createOpenAiRunner(options);
  }
}

function createMockRunner(clock?: () => number): PhraseBenchmarkRunner {
  return async (_prompt, input, options) => {
    const startedAt = (clock ?? (() => globalThis.performance.now()))();
    const suggestions = await requestPhraseBatch(input, {
      enabled: true,
      count: 5,
      now: Date.now(),
      requestTimeoutMs: options.requestTimeoutMs,
    });
    const elapsedMs = Math.max(0, (clock ?? (() => globalThis.performance.now()))() - startedAt);
    const text = suggestions.map((suggestion: PhraseSuggestion) => suggestion.text).join('\n');
    return {
      text,
      timeToFirstTokenMs: elapsedMs,
      timeToFirstPhraseMs: elapsedMs,
      tokensGenerated: estimateTokens(text),
    };
  };
}

function createHttpRunner(options: PhraseBenchmarkInputOptions): PhraseBenchmarkRunner {
  if (!options.endpoint) throw new Error('HTTP phrase benchmark requires --endpoint');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('HTTP phrase benchmark requires fetch support');
  const endpoint = options.endpoint;

  return async (prompt, input, sampleOptions) => {
    const startedAt = globalThis.performance.now();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        input,
        model: options.model,
        max_new_tokens: sampleOptions.maxNewTokens,
        sample_index: sampleOptions.sampleIndex,
      }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 120)}`);
    const text = extractTextFromHttpResponse(body);
    const elapsedMs = globalThis.performance.now() - startedAt;
    return {
      text,
      timeToFirstTokenMs: elapsedMs,
      timeToFirstPhraseMs: elapsedMs,
      tokensGenerated: estimateTokens(text),
    };
  };
}

function createOpenAiRunner(options: PhraseBenchmarkInputOptions): PhraseBenchmarkRunner {
  const endpoint = options.endpoint ?? 'http://127.0.0.1:8080/v1/chat/completions';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error('OpenAI-compatible phrase benchmark requires fetch support');

  return async (prompt, _input, sampleOptions) => {
    const startedAt = globalThis.performance.now();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: [
          {
            role: 'system',
            content: 'Return only newline-separated 1 to 6 word singable phrase fragments.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: sampleOptions.maxNewTokens,
        temperature: 0.9,
        top_p: 0.9,
        stream: false,
      }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 120)}`);
    const text = extractTextFromHttpResponse(body);
    const elapsedMs = globalThis.performance.now() - startedAt;
    return {
      text,
      timeToFirstTokenMs: elapsedMs,
      timeToFirstPhraseMs: elapsedMs,
      tokensGenerated: estimateTokens(text),
    };
  };
}

async function runSample(
  runner: PhraseBenchmarkRunner,
  prompt: string,
  input: LyricSidecarInput,
  options: {
    sampleIndex: number;
    requestTimeoutMs: number;
    maxNewTokens: number;
    clock: () => number;
  },
): Promise<PhraseBenchmarkSample> {
  const startedAt = options.clock();
  try {
    const result = await withTimeout(
      runner(prompt, input, {
        sampleIndex: options.sampleIndex,
        requestTimeoutMs: options.requestTimeoutMs,
        maxNewTokens: options.maxNewTokens,
      }),
      options.requestTimeoutMs,
    );
    const elapsedMs = Math.max(0, options.clock() - startedAt);
    const phrases = parsePhraseFragments(result.text);
    if (phrases.length === 0) {
      return errorSample(options.sampleIndex, 'invalid_output', 'No valid 1-6 word phrase fragments returned');
    }
    const tokensGenerated = result.tokensGenerated ?? estimateTokens(result.text);
    const phraseMs = result.timeToFirstPhraseMs ?? elapsedMs;
    return {
      sample_index: options.sampleIndex,
      status: 'ok',
      phrase_count: phrases.length,
      phrases,
      time_to_first_token_ms: result.timeToFirstTokenMs ?? phraseMs,
      time_to_first_phrase_ms: phraseMs,
      tokens_generated: tokensGenerated,
      tokens_per_second: elapsedMs > 0 ? tokensGenerated / (elapsedMs / 1000) : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorSample(options.sampleIndex, message === 'phrase benchmark timeout' ? 'timeout' : 'error', message);
  }
}

function errorSample(sampleIndex: number, status: Exclude<PhraseBenchmarkStatus, 'ok'>, error: string): PhraseBenchmarkSample {
  return {
    sample_index: sampleIndex,
    status,
    phrase_count: 0,
    phrases: [],
    time_to_first_token_ms: null,
    time_to_first_phrase_ms: null,
    tokens_generated: 0,
    tokens_per_second: null,
    error,
  };
}

function recommendModel(input: {
  backend: PhraseBenchmarkBackend;
  model: string;
  samplesCompleted: number;
  samplesRequested: number;
  metrics: PhraseBenchmarkMetrics;
}): PhraseBenchmarkReport['recommendation'] {
  if (input.samplesCompleted === 0) {
    return {
      status: 'failed',
      selected_model: null,
      reason: 'No benchmark samples completed with valid phrase fragments.',
    };
  }
  if (input.backend === 'mock') {
    return {
      status: 'baseline_only',
      selected_model: null,
      reason: 'Mock backend validates the benchmark harness; run an LFM2.5 local backend before selecting a real model.',
    };
  }
  if (input.samplesCompleted < input.samplesRequested) {
    return {
      status: 'rejected',
      selected_model: null,
      reason: 'One or more samples failed, timed out, or returned invalid phrase output.',
    };
  }
  if ((input.metrics.time_to_first_phrase_ms ?? Number.POSITIVE_INFINITY) > 1500) {
    return {
      status: 'rejected',
      selected_model: null,
      reason: 'Average first phrase latency is above the 1500ms target.',
    };
  }
  if (input.metrics.dropped_render_frames > 0 || input.metrics.audio_glitches > 0) {
    return {
      status: 'rejected',
      selected_model: null,
      reason: 'Benchmark detected render frame drops or audio glitches.',
    };
  }
  if (input.metrics.performer_score !== null && input.metrics.performer_score < 3) {
    return {
      status: 'rejected',
      selected_model: null,
      reason: 'Performer usefulness score is below 3/5.',
    };
  }
  return {
    status: 'selected',
    selected_model: input.model,
    reason: 'Model meets latency, output, render stability, and usefulness gates.',
  };
}

function estimateTokens(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function averageNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (present.length === 0) return null;
  return round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.max(left, right);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('phrase benchmark timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function waitForTimerTurn(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

class RenderLoopProbe {
  private readonly frameBudgetMs: number;
  private readonly clock: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private droppedRenderFrames = 0;

  constructor(options: { frameBudgetMs?: number; clock: () => number }) {
    this.frameBudgetMs = options.frameBudgetMs ?? 1000 / 60;
    this.clock = options.clock;
  }

  start(): void {
    if (this.timer) return;
    this.lastTick = this.clock();
    this.timer = setInterval(() => this.tick(), this.frameBudgetMs);
  }

  stop(): { droppedRenderFrames: number } {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return { droppedRenderFrames: this.droppedRenderFrames };
  }

  private tick(): void {
    const now = this.clock();
    const gap = now - this.lastTick;
    if (gap > this.frameBudgetMs * 1.5) {
      this.droppedRenderFrames += Math.max(1, Math.floor(gap / this.frameBudgetMs) - 1);
    }
    this.lastTick = now;
  }
}
