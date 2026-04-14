#!/usr/bin/env node
/**
 * DF1 App Dogfood
 *
 * Product-facing generation slice: generate real creative outputs, validate
 * them, and emit durable artifacts that can drive harness repairs.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { ASCIIArtGenerator } from '../../src/generators/ascii/ASCIIArtGenerator.js';
import { CodeValidator } from '../../src/core/CodeValidator.js';
import { HTMLWebGenerator } from '../../src/generators/html/HTMLWebGenerator.js';
import { KineticGenerator } from '../../src/generators/kinetic/KineticGenerator.js';
import { LLMClient, type LLMConfig, type LLMResponse } from '../../src/llm/LLMClient.js';
import { P5GeneratorV2 } from '../../src/generators/p5/P5GeneratorV2.js';
import { HeadlessRenderer, type RenderDomain } from '../../src/render/HeadlessRenderer.js';
import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import { StrudelGenerator } from '../../src/generators/strudel/StrudelGenerator.js';
import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';
import { ToneGenerator } from '../../src/generators/tone/ToneGenerator.js';

type ProviderName = 'active' | 'openai' | 'glm' | 'kimi' | 'minimax' | 'lmstudio' | 'ollama';
type DomainName = 'p5' | 'glsl' | 'three' | 'strudel' | 'tone' | 'kinetic' | 'html' | 'ascii';

interface DomainSpec {
  name: DomainName;
  prompt: string;
  createGenerator: (llm?: LLMClient) => {
    generateFull?: (prompt: string) => Promise<LLMResponse>;
    generate: (prompt: string) => Promise<string>;
    wrapForGallery?: (code: string) => string;
  };
}

interface CliOptions {
  dryRun: boolean;
  provider: ProviderName;
  harnessProvider?: ProviderName;
  evaluatorProvider?: ProviderName;
  domains: DomainName[];
  outputRoot: string;
  baseUrl?: string;
  model?: string;
  harnessBaseUrl?: string;
  harnessModel?: string;
  evaluatorBaseUrl?: string;
  evaluatorModel?: string;
  fallbackEvaluatorBaseUrl?: string;
  fallbackEvaluatorModel?: string;
  lmstudioBaseUrl?: string;
  lmstudioModel?: string;
  maxTokens?: number;
  harnessMaxTokens?: number;
  evaluatorMaxTokens?: number;
}

interface DomainResult {
  domain: DomainName;
  success: boolean;
  validationPassed: boolean;
  runtimePassed?: boolean;
  evaluatorScore?: number;
  qualityPassed?: boolean;
  launchReady: boolean;
  artifactDir: string;
  codeLength: number;
  error?: string;
  durationMs: number;
}

const DF1_CONTRACT_VERSION = 'df1-tri-role-v1';
const QUALITY_WARN_THRESHOLD = 0.6;
const QUALITY_PASS_THRESHOLD = 0.75;

const DOMAIN_SPECS: DomainSpec[] = [
  {
    name: 'p5',
    prompt: 'Create a bioluminescent tide-pool particle ecosystem: blue organisms drift in currents, cluster around invisible nutrients, and leave soft fading trails.',
    createGenerator: (llm) => new P5GeneratorV2(llm),
  },
  {
    name: 'glsl',
    prompt: 'Create a living aurora plasma shader: ribbon-like magnetic waves, deep teal-to-magenta color shifts, and slow breathing motion.',
    createGenerator: (llm) => new ShaderGenerator(llm),
  },
  {
    name: 'three',
    prompt: 'Create a floating obsidian cube shrine in deep space: rotating cube, rim lights, starfield depth, and a subtle glowing aura.',
    createGenerator: (llm) => new ThreeGenerator(llm),
  },
  {
    name: 'strudel',
    prompt: 'Create a hypnotic warehouse techno loop: kick, offbeat hats, syncopated clap, and a pulsing acid bassline with filter movement.',
    createGenerator: (llm) => new StrudelGenerator(llm),
  },
  {
    name: 'tone',
    prompt: 'Create an evolving midnight drone patch: layered synth voices, long reverb tail, slow filter/LFO movement, and a gentle repeating pulse.',
    createGenerator: (llm) => new ToneGenerator(llm),
  },
  {
    name: 'kinetic',
    prompt: 'Create kinetic CSS art: orbital typography fragments and geometric glyphs drifting like a neon mechanical clock with perpetual motion.',
    createGenerator: (llm) => new KineticGenerator(llm),
  },
  {
    name: 'html',
    prompt: 'Create an infrastructure HTML wrapper smoke page.',
    createGenerator: (llm) => new HTMLWebGenerator(llm),
  },
  {
    name: 'ascii',
    prompt: 'Create ASCII art of a mountain observatory at night, with peaks, a small dome telescope, and stars.',
    createGenerator: (llm) => new ASCIIArtGenerator(llm),
  },
];

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function qualityPassed(score: number | undefined): boolean | undefined {
  if (score === undefined) return undefined;
  return score >= QUALITY_PASS_THRESHOLD;
}

const DRY_RUN_CODE: Record<DomainName, string> = {
  p5: `function setup() {
  createCanvas(640, 480);
  background(12, 34, 76);
  noStroke();
}
function draw() {
  fill(80, 160, 255, 140);
  circle(width / 2 + sin(frameCount * 0.02) * 120, height / 2, 48);
}`,
  glsl: `precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / u_resolution.xy;
  float n = noise(uv * 8.0 + u_time * 0.15);
  vec3 color = mix(vec3(0.05, 0.1, 0.35), vec3(0.9, 0.2, 0.7), n);
  color += 0.2 * sin(vec3(1.0, 2.0, 3.0) + u_time + uv.xyx * 6.283);
  color += vec3(0.03, 0.02, 0.05) * smoothstep(0.1, 0.9, uv.y);
  fragColor = vec4(color, 1.0);
}`,
  three: `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const material = new THREE.MeshStandardMaterial({ color: 0x58a6ff, metalness: 0.25, roughness: 0.35 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 3, 4);
scene.add(key);
scene.add(new THREE.AmbientLight(0x335577, 0.6));
camera.position.z = 5;
function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.015;
  renderer.render(scene, camera);
}
animate();`,
  strudel: `stack(
  s("bd*4").gain(0.9),
  s("hh*8").gain(0.35).pan("<-0.25 0.25>"),
  s("sd").struct("~ 1 ~ 1").gain(0.55),
  note("c2 c2 eb2 g2").s("sawtooth").cutoff(900).slow(2)
).fast(1).out()`,
  tone: `const synth = new Tone.Synth().toDestination();
const reverb = new Tone.Reverb({ decay: 8, wet: 0.45 }).toDestination();
const drone = new Tone.AMSynth().connect(reverb);
Tone.Transport.scheduleRepeat((time) => {
  synth.triggerAttackRelease("C3", "2n", time);
  drone.triggerAttackRelease("G2", "1m", time);
}, "1m");
Tone.Transport.bpm.value = 72;
Tone.Transport.start();`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DF1 Landing</title>
  <style>
    body { margin: 0; font-family: sans-serif; background: #0d1117; color: #e6edf3; }
    main { min-height: 100vh; display: grid; place-items: center; text-align: center; padding: 2rem; }
    button { padding: 0.8rem 1.2rem; border-radius: 999px; border: 0; background: #58a6ff; color: #07111f; }
  </style>
</head>
<body><main><section><h1>DF1 Landing</h1><p>A small product dogfood proof.</p><button>Start</button></section></main></body>
</html>`,
  kinetic: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DF1 Kinetic</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #06111f; overflow: hidden; }
    .orb { width: 140px; height: 140px; border-radius: 999px; background: #58a6ff; animation: drift 3s ease-in-out infinite alternate; }
    @keyframes drift { from { transform: translateX(-60px) scale(0.8); opacity: 0.65; } to { transform: translateX(60px) scale(1.2); opacity: 1; } }
  </style>
</head>
<body><div class="orb"></div></body>
</html>`,
  ascii: '        /\\\n       /  \\\n      /____\\\n     /\\    /\\\n    /  \\  /  \\\n   /____\\/____\\\n      ||  ||',
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string | boolean>();
  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.set('dry-run', true);
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args.set(match[1], match[2]);
  }

  const domainsArg = String(args.get('domains') || 'p5,glsl,three,strudel,tone,kinetic,ascii');
  const domains = domainsArg
    .split(',')
    .map((domain) => domain.trim())
    .filter((domain): domain is DomainName => DOMAIN_SPECS.some((spec) => spec.name === domain));

  if (domains.length === 0) {
    throw new Error(`No valid domains selected from --domains=${domainsArg}`);
  }

  return {
    dryRun: args.get('dry-run') === true,
    provider: (args.get('provider') as ProviderName | undefined) || 'active',
    harnessProvider: typeof args.get('harness-provider') === 'string' ? args.get('harness-provider') as ProviderName : undefined,
    evaluatorProvider: typeof args.get('evaluator-provider') === 'string' ? args.get('evaluator-provider') as ProviderName : undefined,
    domains,
    outputRoot: String(args.get('output') || '.omx/logs/df1-runs'),
    baseUrl: typeof args.get('base-url') === 'string' ? String(args.get('base-url')) : undefined,
    model: typeof args.get('model') === 'string' ? String(args.get('model')) : undefined,
    harnessBaseUrl: typeof args.get('harness-base-url') === 'string' ? String(args.get('harness-base-url')) : undefined,
    harnessModel: typeof args.get('harness-model') === 'string' ? String(args.get('harness-model')) : undefined,
    evaluatorBaseUrl: typeof args.get('evaluator-base-url') === 'string' ? String(args.get('evaluator-base-url')) : undefined,
    evaluatorModel: typeof args.get('evaluator-model') === 'string' ? String(args.get('evaluator-model')) : undefined,
    fallbackEvaluatorBaseUrl: typeof args.get('fallback-evaluator-base-url') === 'string' ? String(args.get('fallback-evaluator-base-url')) : undefined,
    fallbackEvaluatorModel: typeof args.get('fallback-evaluator-model') === 'string' ? String(args.get('fallback-evaluator-model')) : undefined,
    lmstudioBaseUrl: typeof args.get('lmstudio-base-url') === 'string' ? String(args.get('lmstudio-base-url')) : undefined,
    lmstudioModel: typeof args.get('lmstudio-model') === 'string' ? String(args.get('lmstudio-model')) : undefined,
    maxTokens: typeof args.get('max-tokens') === 'string' ? Number(args.get('max-tokens')) : undefined,
    harnessMaxTokens: typeof args.get('harness-max-tokens') === 'string' ? Number(args.get('harness-max-tokens')) : undefined,
    evaluatorMaxTokens: typeof args.get('evaluator-max-tokens') === 'string' ? Number(args.get('evaluator-max-tokens')) : undefined,
  };
}

async function loadProviderConfig(options: CliOptions, role: 'generator' | 'harness' | 'evaluator' = 'generator'): Promise<Partial<LLMConfig> | undefined> {
  if (options.dryRun) return undefined;

  const configPath = path.join(os.homedir(), '.liminal', 'config.json');
  const fileConfig = fsSync.existsSync(configPath)
    ? JSON.parse(await fs.readFile(configPath, 'utf8'))
    : {};
  const providers = fileConfig.providers || {};
  const selectedProvider = role === 'harness'
    ? options.harnessProvider
    : role === 'evaluator'
      ? (options.evaluatorProvider || 'lmstudio')
    : options.provider;
  if (role === 'harness' && !selectedProvider) return undefined;

  const defaultProvider = selectedProvider === 'active'
    ? (fileConfig.defaultProvider || 'lmstudio')
    : selectedProvider;
  const providerConfig = providers[defaultProvider] || {};

  const config: Record<string, unknown> = {
    baseUrl: (role === 'harness' ? options.harnessBaseUrl : role === 'evaluator' ? options.evaluatorBaseUrl : options.baseUrl) || providerConfig.baseUrl,
    model: (role === 'harness' ? options.harnessModel : role === 'evaluator' ? options.evaluatorModel : options.model) || providerConfig.model,
    apiKey: providerConfig.apiKey,
    temperature: role === 'evaluator' ? 0 : undefined,
    maxTokens: (role === 'harness' ? options.harnessMaxTokens : role === 'evaluator' ? options.evaluatorMaxTokens : options.maxTokens) || (role === 'evaluator' ? 512 : 8192),
  };

  if (defaultProvider === 'kimi') {
    config.baseUrl = (role === 'harness' ? options.harnessBaseUrl : role === 'evaluator' ? options.evaluatorBaseUrl : options.baseUrl) || 'https://api.kimi.com/coding';
    config.model = (role === 'harness' ? options.harnessModel : role === 'evaluator' ? options.evaluatorModel : options.model) || 'kimi-for-coding';
    config.apiKey = providerConfig.apiKey || process.env.KIMI_API_KEY;
  }
  if (defaultProvider === 'minimax') {
    config.baseUrl = (role === 'harness' ? options.harnessBaseUrl : role === 'evaluator' ? options.evaluatorBaseUrl : options.baseUrl) || 'https://api.minimax.io/anthropic';
    config.model = (role === 'harness' ? options.harnessModel : role === 'evaluator' ? options.evaluatorModel : options.model) || 'MiniMax-M2.7';
    config.apiKey = providerConfig.apiKey || process.env.MINIMAX_API_KEY;
  }
  if (defaultProvider === 'glm') {
    config.baseUrl = (role === 'harness' ? options.harnessBaseUrl : role === 'evaluator' ? options.evaluatorBaseUrl : options.baseUrl) || 'https://api.z.ai/api/anthropic';
    config.model = (role === 'harness' ? options.harnessModel : role === 'evaluator' ? options.evaluatorModel : options.model) || providerConfig.model || 'glm-5.1';
    config.apiKey = providerConfig.apiKey || process.env.GLM_API_KEY;
  }
  if (defaultProvider === 'openai') {
    config.baseUrl = (role === 'harness' ? options.harnessBaseUrl : role === 'evaluator' ? options.evaluatorBaseUrl : options.baseUrl) || providerConfig.baseUrl || 'https://api.openai.com/v1';
    config.model = (role === 'harness' ? options.harnessModel : role === 'evaluator' ? options.evaluatorModel : options.model) || 'gpt-5.4';
    config.apiKey = providerConfig.apiKey || process.env.OPENAI_API_KEY;
  }
  if (defaultProvider === 'lmstudio') {
    config.baseUrl = (role === 'harness' ? options.harnessBaseUrl : role === 'evaluator' ? options.evaluatorBaseUrl : undefined) ||
      options.lmstudioBaseUrl ||
      options.baseUrl ||
      process.env.LIMINAL_LMSTUDIO_BASE_URL ||
      process.env.LMSTUDIO_BASE_URL ||
      providerConfig.baseUrl ||
      'http://localhost:1234/v1';
    config.model = (role === 'harness' ? options.harnessModel : role === 'evaluator' ? options.evaluatorModel : undefined) ||
      options.lmstudioModel ||
      options.model ||
      process.env.LIMINAL_LMSTUDIO_MODEL ||
      process.env.LMSTUDIO_MODEL ||
      providerConfig.model ||
      (role === 'evaluator' ? 'qwen3.5-2b' : 'local-model');
    config.apiKey = providerConfig.apiKey;
  }
  if (role === 'evaluator') {
    config.temperature = 0;
    config.maxTokens = options.evaluatorMaxTokens || 512;
  }
  if (defaultProvider === 'ollama') {
    config.baseUrl = options.baseUrl || providerConfig.baseUrl || 'http://localhost:11434';
    config.model = options.model || providerConfig.model || 'llama3.2';
    config.apiKey = providerConfig.apiKey;
  }

  if (!config.baseUrl || !config.model) {
    throw new Error(`Provider ${defaultProvider} is missing baseUrl/model. Use --base-url and --model.`);
  }

  return config as Partial<LLMConfig>;
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code: 'code' in value ? (value as { code?: unknown }).code : undefined,
      context: 'context' in value ? (value as { context?: unknown }).context : undefined,
    };
  }
  return value;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, jsonReplacer, 2), 'utf8');
}

function renderDomainFor(domain: DomainName): RenderDomain | undefined {
  if (domain === 'p5' || domain === 'three' || domain === 'glsl') return domain;
  if (domain === 'kinetic' || domain === 'html') return 'unknown';
  return undefined;
}

async function validateRuntime(domain: DomainName, preview: string, domainDir: string, dryRun: boolean): Promise<{
  passed?: boolean;
  error?: string;
}> {
  const renderDomain = renderDomainFor(domain);

  if (!renderDomain) {
    await writeJson(path.join(domainDir, 'runtime.json'), {
      status: 'skipped',
      reason: `Runtime render is not part of DF1 ${domain} validation yet.`,
    });
    return {};
  }

  if (dryRun) {
    await writeJson(path.join(domainDir, 'runtime.json'), {
      status: 'skipped',
      reason: 'Dry-run fixture output does not count as product runtime evidence.',
    });
    return {};
  }

  const renderer = new HeadlessRenderer();
  const startedAt = new Date().toISOString();

  try {
    const render = await renderer.render(preview, {
      domain: renderDomain,
      timeout: 15000,
      stabilizationTime: 1000,
    });
    if (render.screenshot?.buffer?.length) {
      await fs.writeFile(path.join(domainDir, 'screenshot.png'), render.screenshot.buffer);
    }

    const runtimeErrors = [
      ...(render.errors || []),
      ...(render.screenshot?.error ? [render.screenshot.error] : []),
      ...(render.error ? [render.error] : []),
    ];
    const passed = render.success && runtimeErrors.length === 0;

    await writeJson(path.join(domainDir, 'runtime.json'), {
      status: 'completed',
      startedAt,
      completedAt: new Date().toISOString(),
      passed,
      renderSuccess: render.success,
      screenshot: render.screenshot
        ? {
            success: render.screenshot.success,
            width: render.screenshot.width,
            height: render.screenshot.height,
            bytes: render.screenshot.buffer.length,
            error: render.screenshot.error,
          }
        : undefined,
      logs: render.logs,
      errors: runtimeErrors,
    });

    return {
      passed,
      error: passed ? undefined : runtimeErrors.join('; ') || 'Runtime render failed',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeJson(path.join(domainDir, 'runtime.json'), {
      status: 'error',
      startedAt,
      completedAt: new Date().toISOString(),
      passed: false,
      error: message,
    });
    return { passed: false, error: message };
  } finally {
    await renderer.close();
  }
}

const EVALUATOR_SYSTEM_PROMPT = `You are a deterministic domain-specific code evaluator.
Return compact JSON only. No markdown. No prose outside JSON.
Schema:
{"score":0.85,"correctness":0.9,"relevance":0.8,"quality":0.85,"confidence":0.8,"notes":"short"}
Rules:
- Base correctness primarily on deterministic validation/runtime evidence.
- Penalize code that passes syntax but is semantically weak.
- For audio/text domains with no browser runtime, do not penalize only because runtime is not applicable.`;

async function runEvaluator(
  spec: DomainSpec,
  domainDir: string,
  code: string,
  result: Omit<DomainResult, 'evaluatorScore'>,
  evaluatorConfig?: Partial<LLMConfig>,
  fallbackEvaluatorConfig?: Partial<LLMConfig>,
): Promise<number | undefined> {
  if (!evaluatorConfig || !code.trim()) return undefined;
  const runOne = async (config: Partial<LLMConfig>, reason: string) => {
    const llm = new LLMClient({ ...config, role: 'evaluator' });
    const response = await llm.generate(
      EVALUATOR_SYSTEM_PROMPT,
      `Domain: ${spec.name}
Prompt: ${spec.prompt}
Validation passed: ${result.validationPassed}
Runtime passed: ${result.runtimePassed}
Error: ${result.error || ''}

Generated code:
${code.slice(0, 12000)}`,
    );
    const json = response.code.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error('Evaluator returned no JSON');
    const parsed = JSON.parse(json) as { score?: number; correctness?: number; relevance?: number; quality?: number; confidence?: number; notes?: string };
    if (typeof parsed.score !== 'number') throw new Error('Evaluator JSON missing numeric score');
    return { response, parsed, reason };
  };

  const startedAt = new Date().toISOString();
  try {
    let used = await runOne(evaluatorConfig, 'primary');
    if (
      fallbackEvaluatorConfig &&
      (used.parsed.confidence !== undefined && used.parsed.confidence < 0.5)
    ) {
      used = await runOne(fallbackEvaluatorConfig, 'fallback-low-confidence');
    }
    await writeJson(path.join(domainDir, 'evaluator.json'), {
      startedAt,
      completedAt: new Date().toISOString(),
      evaluatorReason: used.reason,
      evaluatorConfig: {
        ...(used.reason === 'primary' ? evaluatorConfig : fallbackEvaluatorConfig),
        apiKey: (used.reason === 'primary' ? evaluatorConfig : fallbackEvaluatorConfig)?.apiKey ? '[REDACTED]' : undefined,
      },
      response: {
        success: used.response.success,
        model: used.response.model,
        usage: used.response.usage,
        error: used.response.error,
      },
      parsed: used.parsed,
      raw: used.response.code,
    });
    return used.parsed.score;
  } catch (error) {
    if (fallbackEvaluatorConfig) {
      try {
        const used = await runOne(fallbackEvaluatorConfig, 'fallback-parse-or-error');
        await writeJson(path.join(domainDir, 'evaluator.json'), {
          startedAt,
          completedAt: new Date().toISOString(),
          evaluatorReason: used.reason,
          evaluatorConfig: {
            ...fallbackEvaluatorConfig,
            apiKey: fallbackEvaluatorConfig.apiKey ? '[REDACTED]' : undefined,
          },
          response: {
            success: used.response.success,
            model: used.response.model,
            usage: used.response.usage,
            error: used.response.error,
          },
          parsed: used.parsed,
          raw: used.response.code,
          primaryError: error,
        });
        return used.parsed.score;
      } catch {
        // Fall through to error artifact for the original evaluator failure.
      }
    }
    await writeJson(path.join(domainDir, 'evaluator.json'), {
      startedAt,
      completedAt: new Date().toISOString(),
      evaluatorConfig: {
        ...evaluatorConfig,
        apiKey: evaluatorConfig.apiKey ? '[REDACTED]' : undefined,
      },
      error,
    });
    return undefined;
  }
}

async function runDomain(
  spec: DomainSpec,
  runDir: string,
  options: CliOptions,
  llmConfig?: Partial<LLMConfig>,
  evaluatorConfig?: Partial<LLMConfig>,
  fallbackEvaluatorConfig?: Partial<LLMConfig>,
): Promise<DomainResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const domainDir = path.join(runDir, spec.name);
  await fs.mkdir(domainDir, { recursive: true });
  await writeJson(path.join(domainDir, 'prompt.json'), {
    domain: spec.name,
    prompt: spec.prompt,
    promptHash: sha256(spec.prompt),
    contractVersion: DF1_CONTRACT_VERSION,
    dryRun: options.dryRun,
    startedAt,
  });

  try {
    const llm = llmConfig ? new LLMClient(llmConfig) : undefined;
    const generator = spec.createGenerator(llm);
    const response = options.dryRun
      ? {
          code: DRY_RUN_CODE[spec.name],
          success: true,
          explanation: 'Dry-run fixture output. Does not count as product evidence.',
          model: 'dry-run',
        } as LLMResponse
      : generator.generateFull
        ? await generator.generateFull(spec.prompt)
        : { code: await generator.generate(spec.prompt), success: true } as LLMResponse;

    const code = response.code || '';
    const validation = CodeValidator.validate(code, spec.name);
    const preview = typeof generator.wrapForGallery === 'function'
      ? generator.wrapForGallery(validation.cleanedCode || code)
      : validation.cleanedCode || code;

    await fs.writeFile(path.join(domainDir, 'code.txt'), code, 'utf8');
    await fs.writeFile(path.join(domainDir, 'preview.html'), preview, 'utf8');
    await writeJson(path.join(domainDir, 'response.json'), response);
    await writeJson(path.join(domainDir, 'validation.json'), validation);
    const runtime = await validateRuntime(spec.name, preview, domainDir, options.dryRun);
    const success = validation.valid && runtime.passed !== false;

    const resultWithoutEval: Omit<DomainResult, 'evaluatorScore'> = {
      domain: spec.name,
      success,
      validationPassed: validation.valid,
      runtimePassed: runtime.passed,
      artifactDir: domainDir,
      codeLength: code.length,
      error: success ? undefined : [validation.errors.join('; '), runtime.error].filter(Boolean).join('; '),
      durationMs: Date.now() - start,
    };
    const evaluatorScore = await runEvaluator(spec, domainDir, validation.cleanedCode || code, resultWithoutEval, evaluatorConfig, fallbackEvaluatorConfig);
    const quality = qualityPassed(evaluatorScore);
    const result: DomainResult = {
      ...resultWithoutEval,
      evaluatorScore,
      qualityPassed: quality,
      launchReady: resultWithoutEval.success && quality !== false,
    };
    await writeJson(path.join(domainDir, 'result.json'), result);
    return result;
  } catch (error) {
    const context = error instanceof Error && 'context' in error
      ? (error as { context?: Record<string, unknown> }).context
      : undefined;
    const failedCode = typeof context?.failedCode === 'string' ? context.failedCode : '';
    let validationPassed = false;
    let validationError: string | undefined;
    if (failedCode) {
      const validation = CodeValidator.validate(failedCode, spec.name);
      validationPassed = validation.valid;
      validationError = validation.errors.join('; ') || undefined;
      await fs.writeFile(path.join(domainDir, 'code.txt'), failedCode, 'utf8');
      await writeJson(path.join(domainDir, 'validation.json'), validation);
      await writeJson(path.join(domainDir, 'runtime.json'), {
        status: 'skipped',
        reason: 'Generation failed before runtime validation.',
      });
    }

    const resultWithoutEval: Omit<DomainResult, 'evaluatorScore'> = {
      domain: spec.name,
      success: false,
      validationPassed,
      runtimePassed: false,
      artifactDir: domainDir,
      codeLength: failedCode.length,
      error: validationError || (error instanceof Error ? error.message : String(error)),
      durationMs: Date.now() - start,
    };
    const evaluatorScore = await runEvaluator(spec, domainDir, failedCode, resultWithoutEval, evaluatorConfig, fallbackEvaluatorConfig);
    const quality = qualityPassed(evaluatorScore);
    const result: DomainResult = {
      ...resultWithoutEval,
      evaluatorScore,
      qualityPassed: quality,
      launchReady: false,
    };
    await writeJson(path.join(domainDir, 'error.json'), { error });
    await writeJson(path.join(domainDir, 'result.json'), result);
    return result;
  }
}

function summaryMarkdown(runId: string, results: DomainResult[], dryRun: boolean): string {
  const passed = results.filter((result) => result.success).length;
  const lines = [
    `# DF1 App Dogfood ${runId}`,
    '',
    `Dry run: ${dryRun}`,
    `Pass rate: ${passed}/${results.length}`,
    '',
    '| Domain | Result | Static | Runtime | Evaluator | Quality | Launch | Code chars | Duration ms | Error |',
    '| --- | --- | --- | --- | ---: | --- | --- | ---: | ---: | --- |',
    ...results.map((result) =>
      `| ${result.domain} | ${result.success ? 'PASS' : 'FAIL'} | ${result.validationPassed ? 'PASS' : 'FAIL'} | ${result.runtimePassed === undefined ? 'SKIP' : result.runtimePassed ? 'PASS' : 'FAIL'} | ${result.evaluatorScore ?? ''} | ${result.qualityPassed === undefined ? 'UNKNOWN' : result.qualityPassed ? 'PASS' : 'WARN'} | ${result.launchReady ? 'YES' : 'NO'} | ${result.codeLength} | ${result.durationMs} | ${(result.error || '').replace(/\|/g, '\\|')} |`
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function runHarnessAnalysis(runDir: string, summary: unknown, harnessConfig?: Partial<LLMConfig>): Promise<void> {
  if (!harnessConfig) return;

  const llm = new LLMClient({ ...harnessConfig, role: 'harness' });
  const systemPrompt = 'You are the Liminal cloud harness model. Analyze DF1 local-generator dogfood artifacts. Be concrete, classify failures, identify whether each failure is generator compatibility, validator bug, runtime wrapper bug, or infra/provider issue. Do not write code.';
  const userPrompt = `DF1 run summary:
${JSON.stringify(summary, null, 2)}

Task:
1. Identify launch blockers.
2. Identify which failures should be fixed in harness/validator/wrapper versus local generator prompt contract.
3. Decide whether the local generator model is acceptable for DF1 launch.
4. List the next three highest-ROI fixes.
5. Confirm whether provider/model provenance is sufficient.`;

  const startedAt = new Date().toISOString();
  try {
    const response = await llm.generate(systemPrompt, userPrompt);
    await writeJson(path.join(runDir, 'harness-analysis.json'), {
      startedAt,
      completedAt: new Date().toISOString(),
      harnessConfig: {
        ...harnessConfig,
        apiKey: harnessConfig.apiKey ? '[REDACTED]' : undefined,
      },
      success: response.success,
      model: response.model,
      usage: response.usage,
      error: response.error,
    });
    await fs.writeFile(path.join(runDir, 'harness-analysis.md'), response.code || response.error || '', 'utf8');
  } catch (error) {
    await writeJson(path.join(runDir, 'harness-analysis.json'), {
      startedAt,
      completedAt: new Date().toISOString(),
      harnessConfig: {
        ...harnessConfig,
        apiKey: harnessConfig.apiKey ? '[REDACTED]' : undefined,
      },
      success: false,
      error,
    });
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const runId = `df1-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runDir = path.resolve(options.outputRoot, runId);
  await fs.mkdir(runDir, { recursive: true });

  const llmConfig = await loadProviderConfig(options, 'generator');
  const harnessConfig = await loadProviderConfig(options, 'harness');
  const evaluatorConfig = await loadProviderConfig(options, 'evaluator');
  const fallbackEvaluatorConfig: Partial<LLMConfig> | undefined = evaluatorConfig
    ? {
        ...evaluatorConfig,
        baseUrl: options.fallbackEvaluatorBaseUrl || 'http://100.66.225.85:1234/v1',
        model: options.fallbackEvaluatorModel || 'qwen3-coder-next-reap-40b-a3b-i1',
        maxTokens: options.evaluatorMaxTokens || 512,
        temperature: 0,
      }
    : undefined;
  await writeJson(path.join(runDir, 'run.json'), {
    runId,
    dryRun: options.dryRun,
    provider: options.provider,
    domains: options.domains,
    contractVersion: DF1_CONTRACT_VERSION,
    qualityThresholds: {
      warn: QUALITY_WARN_THRESHOLD,
      pass: QUALITY_PASS_THRESHOLD,
    },
    promptHashes: Object.fromEntries(DOMAIN_SPECS.map((spec) => [spec.name, sha256(spec.prompt)])),
    llmConfig: llmConfig ? {
      ...llmConfig,
      apiKey: llmConfig.apiKey ? '[REDACTED]' : undefined,
    } : undefined,
    generatorRole: options.dryRun ? 'dry-run' : 'generator',
    harnessConfig: harnessConfig ? {
      ...harnessConfig,
      apiKey: harnessConfig.apiKey ? '[REDACTED]' : undefined,
    } : undefined,
    evaluatorConfig: evaluatorConfig ? {
      ...evaluatorConfig,
      apiKey: evaluatorConfig.apiKey ? '[REDACTED]' : undefined,
    } : undefined,
    fallbackEvaluatorConfig: fallbackEvaluatorConfig ? {
      ...fallbackEvaluatorConfig,
      apiKey: fallbackEvaluatorConfig.apiKey ? '[REDACTED]' : undefined,
    } : undefined,
    startedAt: new Date().toISOString(),
  });

  const specs = DOMAIN_SPECS.filter((spec) => options.domains.includes(spec.name));
  const results: DomainResult[] = [];
  for (const spec of specs) {
    console.log(`DF1 ${options.dryRun ? 'dry-run' : 'run'}: ${spec.name}`);
    results.push(await runDomain(spec, runDir, options, llmConfig, evaluatorConfig, fallbackEvaluatorConfig));
  }

  const summary = {
    runId,
    dryRun: options.dryRun,
    passed: results.filter((result) => result.success).length,
    launchReady: results.filter((result) => result.launchReady).length,
    total: results.length,
    passRate: results.length === 0 ? 0 : results.filter((result) => result.success).length / results.length,
    launchReadyRate: results.length === 0 ? 0 : results.filter((result) => result.launchReady).length / results.length,
    qualityWarnings: results.filter((result) => result.success && result.qualityPassed === false).map((result) => ({
      domain: result.domain,
      evaluatorScore: result.evaluatorScore,
      artifactDir: result.artifactDir,
    })),
    results,
    completedAt: new Date().toISOString(),
  };
  await writeJson(path.join(runDir, 'summary.json'), summary);
  await fs.writeFile(path.join(runDir, 'summary.md'), summaryMarkdown(runId, results, options.dryRun), 'utf8');
  await runHarnessAnalysis(runDir, summary, harnessConfig);

  console.log(JSON.stringify({
    runDir,
    passed: summary.passed,
    total: summary.total,
    passRate: summary.passRate,
    dryRun: options.dryRun,
  }, null, 2));

  if (!options.dryRun && summary.passed !== summary.total) {
    process.exitCode = 1;
  }
}

main()
  .then(() => {
    process.exit(process.exitCode ?? 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
