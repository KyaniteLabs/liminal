#!/usr/bin/env tsx
/**
 * Live creative-domain execution receipt.
 *
 * This is intentionally not the source-contract gauntlet: it calls the real
 * domain generators, writes real artifacts, and records per-domain results.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getProviderConfig, listConfiguredProviders, type ProviderType } from '../../src/harness/MultiProviderConfig.js';
import { selectLiveSmokeProvider } from '../../src/market/LiveProviderSmokeReceipt.js';
import { P5GeneratorV2 } from '../../src/generators/p5/P5GeneratorV2.js';
import { SVGGenerator } from '../../src/generators/svg/SVGGenerator.js';
import { StrudelGenerator } from '../../src/generators/strudel/StrudelGenerator.js';
import { ToneGenerator } from '../../src/generators/tone/ToneGenerator.js';
import { RevideoGenerator } from '../../src/generators/revideo/RevideoGenerator.js';
import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';
import { HydraGenerator } from '../../src/generators/hydra/HydraGenerator.js';
import { HTMLWebGenerator } from '../../src/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../../src/generators/ascii/ASCIIArtGenerator.js';
import { TextGenerativeGenerator } from '../../src/generators/textgen/TextGenerativeGenerator.js';

const DEFAULT_DOMAINS = ['p5', 'svg', 'strudel', 'tone', 'revideo'] as const;
type Domain = typeof DEFAULT_DOMAINS[number] | 'glsl' | 'three' | 'hydra' | 'html' | 'ascii' | 'textgen';

type GeneratorLike = { generate(prompt: string, options?: { signal?: AbortSignal; maxTokens?: number }): Promise<string> | string };

const PROMPTS: Record<Domain, string> = {
  p5: 'create a concise p5 generative sketch with blue green particles and visible motion',
  svg: 'create an SVG vector logo for Liminal with a transparent background',
  strudel: 'create a Strudel live coding rhythm with kick snare hats and bass pattern',
  tone: 'create a Tone.js ambient synth sequence with reverb and a clear start affordance',
  revideo: 'create a Revideo timeline composition with animated title text and subtitle fade',
  glsl: 'create a GLSL fragment shader with animated plasma colors',
  three: 'create a Three.js scene with a rotating cube and visible lighting',
  hydra: 'create a Hydra video synth patch with oscillator and kaleidoscope modulation',
  html: 'create an HTML landing page hero for Liminal with one call to action',
  ascii: 'create ASCII art of a moonlit mountain landscape',
  textgen: 'create concrete poetry word art about a machine dreaming in loops',
};

const EXTENSIONS: Record<Domain, string> = {
  p5: 'js', svg: 'svg', strudel: 'js', tone: 'html', revideo: 'tsx', glsl: 'frag', three: 'js', hydra: 'js', html: 'html', ascii: 'txt', textgen: 'txt',
};

interface DomainResult {
  domain: Domain;
  prompt: string;
  status: 'pass' | 'fail';
  durationMs: number;
  artifactPath?: string;
  codeBytes: number;
  provider: string;
  model: string;
  error?: string;
}

interface LiveCreativeDomainReceipt {
  contract: 'liminal-live-creative-domain-execution-v1';
  generatedAt: string;
  status: 'pass' | 'fail';
  ready: boolean;
  mode: 'live-execution';
  provider: string;
  model: string;
  domains: DomainResult[];
  passed: number;
  failed: number;
  blockers: string[];
}

function parseArgs(argv: string[]): { outDir: string; domains: Domain[]; timeoutMs: number; provider?: ProviderType } {
  let outDir = path.join(process.cwd(), '.omx', 'proof', 'live-creative-domains');
  let domains: Domain[] = [...DEFAULT_DOMAINS];
  let timeoutMs = 120_000;
  let provider: ProviderType | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--out') outDir = argv[++i] ?? outDir;
    else if (arg.startsWith('--out=')) outDir = arg.slice('--out='.length);
    else if (arg === '--domains') domains = parseDomains(argv[++i] ?? '');
    else if (arg.startsWith('--domains=')) domains = parseDomains(arg.slice('--domains='.length));
    else if (arg === '--all') domains = Object.keys(PROMPTS) as Domain[];
    else if (arg === '--timeout-ms') timeoutMs = Number(argv[++i] ?? timeoutMs);
    else if (arg.startsWith('--timeout-ms=')) timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg === '--provider') provider = argv[++i] as ProviderType;
    else if (arg.startsWith('--provider=')) provider = arg.slice('--provider='.length) as ProviderType;
  }
  return { outDir, domains, timeoutMs, provider };
}

function parseDomains(value: string): Domain[] {
  return value.split(',').map(item => item.trim()).filter(Boolean) as Domain[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createGenerator(domain: Domain, config: { baseUrl?: string; model?: string; apiKey?: string; apiStyle?: 'openai' | 'anthropic' | 'ollama' }): GeneratorLike {
  switch (domain) {
    case 'p5': return new P5GeneratorV2(config);
    case 'svg': return new SVGGenerator(config);
    case 'strudel': return new StrudelGenerator(config);
    case 'tone': return new ToneGenerator(config);
    case 'revideo': return new RevideoGenerator(config);
    case 'glsl': return new ShaderGenerator(config);
    case 'three': return new ThreeGenerator(config);
    case 'hydra': return new HydraGenerator(config);
    case 'html': return new HTMLWebGenerator(config);
    case 'ascii': return new ASCIIArtGenerator(config);
    case 'textgen': return new TextGenerativeGenerator(config);
  }
}

async function runDomain(domain: Domain, rootOutDir: string, timeoutMs: number, provider: string, model: string, config: Parameters<typeof createGenerator>[1]): Promise<DomainResult> {
  const prompt = PROMPTS[domain];
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const generator = createGenerator(domain, config);
    const code = String(await generator.generate(prompt, { signal: controller.signal, maxTokens: 4096 })).trim();
    const codeBytes = Buffer.byteLength(code, 'utf8');
    const artifactPath = path.join(rootOutDir, `${domain}.${EXTENSIONS[domain]}`);
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, `${code}\n`, 'utf8');
    const status = codeBytes > 0 ? 'pass' : 'fail';
    return {
      domain,
      prompt,
      status,
      durationMs: Date.now() - started,
      artifactPath: path.relative(process.cwd(), artifactPath),
      codeBytes,
      provider,
      model,
      error: status === 'pass' ? undefined : 'Generated code was empty',
    };
  } catch (error) {
    return {
      domain,
      prompt,
      status: 'fail',
      durationMs: Date.now() - started,
      codeBytes: 0,
      provider,
      model,
      error: errorMessage(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const { outDir, domains, timeoutMs, provider: explicitProvider } = parseArgs(process.argv.slice(2));
  const provider = selectLiveSmokeProvider(listConfiguredProviders(), explicitProvider);
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`Provider ${provider} is not configured`);
  await mkdir(outDir, { recursive: true });
  const results: DomainResult[] = [];
  for (const domain of domains) {
    console.log(`live creative domain: ${domain} via ${provider}/${config.model}`);
    results.push(await runDomain(domain, outDir, timeoutMs, provider, config.model, config));
  }
  const failed = results.filter(result => result.status !== 'pass');
  const receipt: LiveCreativeDomainReceipt = {
    contract: 'liminal-live-creative-domain-execution-v1',
    generatedAt: new Date().toISOString(),
    status: failed.length === 0 ? 'pass' : 'fail',
    ready: failed.length === 0,
    mode: 'live-execution',
    provider,
    model: config.model,
    domains: results,
    passed: results.length - failed.length,
    failed: failed.length,
    blockers: failed.map(result => `${result.domain}: ${result.error ?? 'failed'}`),
  };
  const receiptPath = path.join(process.cwd(), '.omx', 'proof', 'domain-gauntlet-live.json');
  await mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  console.log(`live creative-domain receipt: ${receiptPath}`);
  process.exit(receipt.status === 'pass' ? 0 : 1);
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
