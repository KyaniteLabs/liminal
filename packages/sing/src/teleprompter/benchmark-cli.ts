import { mkdirSync, writeFileSync } from 'node:fs';
import { hostname, platform, arch, cpus } from 'node:os';
import { dirname, resolve } from 'node:path';
import {
  LFM25_CANDIDATE_MODELS,
  runPhraseBenchmark,
  type PhraseBenchmarkBackend,
} from './benchmark.js';

interface CliOptions {
  model: string;
  backend: PhraseBenchmarkBackend;
  samples: number;
  endpoint?: string;
  out?: string;
  quantization?: string;
  performerScore?: number;
  requestTimeoutMs: number;
  maxNewTokens: number;
  pretty: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runPhraseBenchmark({
    model: options.model,
    backend: options.backend,
    samples: options.samples,
    endpoint: options.endpoint,
    quantization: options.quantization,
    performerScore: options.performerScore,
    requestTimeoutMs: options.requestTimeoutMs,
    maxNewTokens: options.maxNewTokens,
    memoryMb: () => Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
  const machine = `${hostname()} ${platform()} ${arch()} ${cpus().length}cpu`;
  const output = JSON.stringify({ ...report, machine }, null, options.pretty ? 2 : 0);

  if (options.out) {
    const target = resolve(options.out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${output}\n`);
  }
  console.log(output);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    model: LFM25_CANDIDATE_MODELS[0],
    backend: 'mock',
    samples: 50,
    requestTimeoutMs: 2500,
    maxNewTokens: 48,
    pretty: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--model':
        options.model = requireValue(args, ++index, arg);
        break;
      case '--backend':
        options.backend = parseBackend(requireValue(args, ++index, arg));
        break;
      case '--samples':
        options.samples = parsePositiveInteger(requireValue(args, ++index, arg), arg);
        break;
      case '--endpoint':
        options.endpoint = requireValue(args, ++index, arg);
        break;
      case '--out':
        options.out = requireValue(args, ++index, arg);
        break;
      case '--quantization':
        options.quantization = requireValue(args, ++index, arg);
        break;
      case '--performer-score':
        options.performerScore = parsePerformerScore(requireValue(args, ++index, arg));
        break;
      case '--request-timeout-ms':
        options.requestTimeoutMs = parsePositiveInteger(requireValue(args, ++index, arg), arg);
        break;
      case '--max-new-tokens':
        options.maxNewTokens = parsePositiveInteger(requireValue(args, ++index, arg), arg);
        break;
      case '--pretty':
        options.pretty = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
    }
  }

  if (options.backend === 'http' && !options.endpoint) {
    throw new Error(`--backend http requires --endpoint\n\n${usage()}`);
  }
  return options;
}

function parseBackend(value: string): PhraseBenchmarkBackend {
  if (value === 'mock' || value === 'http') return value;
  throw new Error(`Unsupported backend: ${value}. Use mock or http.`);
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parsePerformerScore(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error('--performer-score must be between 1 and 5');
  }
  return parsed;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function printUsage(): void {
  console.log(usage());
}

function usage(): string {
  return [
    'Usage: pnpm --filter sing bench:phrases --model <model> --backend <mock|http> --samples <n>',
    '',
    'Examples:',
    '  pnpm --filter sing bench:phrases --model LiquidAI/LFM2.5-350M --backend mock --samples 10 --pretty',
    '  pnpm --filter sing bench:phrases --model LiquidAI/LFM2.5-1.2B-Instruct --backend http --endpoint http://127.0.0.1:8080/phrases --samples 50',
  ].join('\n');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
