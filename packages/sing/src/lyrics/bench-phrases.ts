import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  LFM25_BENCHMARK_CANDIDATES,
  defaultLyricBenchmarkInput,
  runPhraseBenchmark,
  type PhraseBenchmarkBackend,
  type PhraseBenchmarkReport,
  type RuntimeProbe,
} from './PhraseBenchmark.js';
import { buildLyricSidecarPrompt, createMockPhraseGenerator, isValidPhraseFragment, type PhraseGenerator } from './Teleprompter.js';

interface PhraseBenchCliArgs {
  backend: PhraseBenchmarkBackend;
  model: string;
  samples: number;
  maxNewTokens: number;
  out: string;
  endpoint: string;
  apiKeyEnv: string;
  performerScore?: number;
  allCandidates: boolean;
}

interface PhraseBenchmarkSuiteReport {
  generated_at: string;
  backend: PhraseBenchmarkBackend;
  reports: PhraseBenchmarkReport[];
  recommendation: {
    selected_model: string | null;
    accepted: boolean;
    reasons: string[];
  };
}

const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234/v1';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const reports: PhraseBenchmarkReport[] = [];
  const models = args.allCandidates ? LFM25_BENCHMARK_CANDIDATES.map((candidate) => candidate.model) : [args.model];

  for (const model of models) {
    const candidate = LFM25_BENCHMARK_CANDIDATES.find((item) => item.model === model);
    const generator = createGenerator(args, model);
    reports.push(await runPhraseBenchmark({
      backend: args.backend,
      model,
      samples: args.samples,
      maxNewTokens: args.maxNewTokens,
      input: defaultLyricBenchmarkInput(),
      generator,
      machine: machineLabel(),
      quantization: candidate?.quantization,
      performerScore: args.performerScore,
      runtimeProbe: createNodeRuntimeProbe(),
      impactMonitor: createIntervalImpactMonitor,
    }));
  }

  const output = reports.length === 1 ? reports[0] : buildSuiteReport(args.backend, reports);
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  printSummary(output, args.out);
}

export function parseArgs(argv: string[]): PhraseBenchCliArgs {
  const args: PhraseBenchCliArgs = {
    backend: 'mock',
    model: 'LFM2.5-350M',
    samples: 50,
    maxNewTokens: 24,
    out: path.join(initialCwd(), '.omx/proof/sing-phrase-benchmark.json'),
    endpoint: process.env.LIMINAL_SING_OPENAI_BASE_URL ?? DEFAULT_ENDPOINT,
    apiKeyEnv: 'LIMINAL_SING_OPENAI_API_KEY',
    allCandidates: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--') continue;
    if (key === '--all-candidates') {
      args.allCandidates = true;
      continue;
    }
    if (value == null) throw new Error(`Missing value for ${key}`);
    if (key === '--backend') args.backend = parseBackend(value);
    else if (key === '--model') args.model = value;
    else if (key === '--samples') args.samples = parsePositiveInteger(value, key);
    else if (key === '--max-new-tokens') args.maxNewTokens = parsePositiveInteger(value, key);
    else if (key === '--out') args.out = path.resolve(initialCwd(), value);
    else if (key === '--endpoint') args.endpoint = value;
    else if (key === '--api-key-env') args.apiKeyEnv = value;
    else if (key === '--performer-score') args.performerScore = parseScore(value);
    else throw new Error(`Unknown argument: ${key}`);
    index += 1;
  }

  return args;
}

function createGenerator(args: PhraseBenchCliArgs, model: string): PhraseGenerator {
  if (args.backend === 'mock') return createMockPhraseGenerator();
  return createOpenAICompatibleGenerator({
    endpoint: args.endpoint,
    apiKey: process.env[args.apiKeyEnv],
    model,
    maxNewTokens: args.maxNewTokens,
  });
}

function createOpenAICompatibleGenerator(params: {
  endpoint: string;
  apiKey?: string;
  model: string;
  maxNewTokens: number;
}): PhraseGenerator {
  return {
    async generate(input, options) {
      const url = new URL('chat/completions', withTrailingSlash(params.endpoint));
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(params.apiKey ? { authorization: `Bearer ${params.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: params.model,
          messages: [
            { role: 'system', content: 'Return only short live-performance phrase fragments.' },
            { role: 'user', content: buildLyricSidecarPrompt(input, options.count) },
          ],
          temperature: 0.8,
          max_tokens: params.maxNewTokens,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`OpenAI-compatible backend failed: ${response.status} ${response.statusText}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? '';
      return content
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(isValidPhraseFragment)
        .slice(0, options.count);
    },
  };
}

function createNodeRuntimeProbe(): RuntimeProbe {
  const startedCpu = process.cpuUsage();
  return {
    memoryMb() {
      return Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;
    },
    cpuPercent(elapsedMs) {
      const cpu = process.cpuUsage(startedCpu);
      const usedMs = (cpu.user + cpu.system) / 1000;
      return Math.round((usedMs / Math.max(elapsedMs, 1)) * 10000) / 100;
    },
    gpuPercent() {
      return null;
    },
  };
}

function createIntervalImpactMonitor() {
  const intervalMs = 16;
  const frameDropThresholdMs = 34;
  const audioGlitchThresholdMs = 48;
  let last = performance.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let droppedRenderFrames = 0;
  let audioGlitches = 0;

  return {
    start() {
      last = performance.now();
      timer = setInterval(() => {
        recordDrift(performance.now());
      }, intervalMs);
    },
    stop() {
      recordDrift(performance.now());
      if (timer) clearInterval(timer);
      return {
        dropped_render_frames: droppedRenderFrames,
        audio_glitches: audioGlitches,
      };
    },
  };

  function recordDrift(now: number): void {
    const drift = now - last - intervalMs;
    if (drift > frameDropThresholdMs) droppedRenderFrames += Math.max(1, Math.round(drift / intervalMs));
    if (drift > audioGlitchThresholdMs) audioGlitches += 1;
    last = now;
  }
}

function buildSuiteReport(backend: PhraseBenchmarkBackend, reports: PhraseBenchmarkReport[]): PhraseBenchmarkSuiteReport {
  const accepted = reports
    .filter((report) => report.recommendation.accepted)
    .sort((left, right) => left.metrics.time_to_first_phrase_ms - right.metrics.time_to_first_phrase_ms);
  const selected = accepted[0] ?? null;
  return {
    generated_at: new Date().toISOString(),
    backend,
    reports,
    recommendation: selected
      ? {
          selected_model: selected.model,
          accepted: true,
          reasons: [`${selected.model} had the fastest accepted first phrase latency`],
        }
      : {
          selected_model: null,
          accepted: false,
          reasons: reports.flatMap((report) => report.recommendation.reasons.map((reason) => `${report.model}: ${reason}`)),
        },
  };
}

function printSummary(output: PhraseBenchmarkReport | PhraseBenchmarkSuiteReport, out: string): void {
  const recommendation = output.recommendation;
  const selected = recommendation.selected_model ?? 'none';
  console.log(`Sing phrase benchmark written: ${out}`);
  console.log(`Recommended model: ${selected}`);
  console.log(`Accepted: ${recommendation.accepted ? 'yes' : 'no'}`);
}

function machineLabel(): string {
  const cpu = os.cpus()[0]?.model ?? 'unknown CPU';
  return `${os.platform()} ${os.arch()} ${cpu}`;
}

function initialCwd(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

function parseBackend(value: string): PhraseBenchmarkBackend {
  if (value === 'mock' || value === 'openai-compatible') return value;
  throw new Error(`Unsupported backend: ${value}`);
}

function parsePositiveInteger(value: string, key: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

function parseScore(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error('--performer-score must be between 1 and 5');
  }
  return parsed;
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
