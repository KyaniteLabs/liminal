#!/usr/bin/env node
/**
 * DF1 App Dogfood
 *
 * Product-facing generation slice: generate real creative outputs, validate
 * them, and emit durable artifacts that can drive harness repairs.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
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
  domains: DomainName[];
  outputRoot: string;
  baseUrl?: string;
  model?: string;
  lmstudioBaseUrl?: string;
  lmstudioModel?: string;
  maxTokens?: number;
}

interface DomainResult {
  domain: DomainName;
  success: boolean;
  validationPassed: boolean;
  runtimePassed?: boolean;
  artifactDir: string;
  codeLength: number;
  error?: string;
  durationMs: number;
}

const DOMAIN_SPECS: DomainSpec[] = [
  {
    name: 'p5',
    prompt: 'Create a calming blue particle system with flowing movement.',
    createGenerator: (llm) => new P5GeneratorV2(llm),
  },
  {
    name: 'glsl',
    prompt: 'Create an abstract plasma shader with animated colors.',
    createGenerator: (llm) => new ShaderGenerator(llm),
  },
  {
    name: 'three',
    prompt: 'Create a rotating 3D cube with dramatic lighting and depth.',
    createGenerator: (llm) => new ThreeGenerator(llm),
  },
  {
    name: 'strudel',
    prompt: 'Create a simple techno beat pattern with drums and bass.',
    createGenerator: (llm) => new StrudelGenerator(llm),
  },
  {
    name: 'tone',
    prompt: 'Create an ambient drone synthesizer with reverb.',
    createGenerator: (llm) => new ToneGenerator(llm),
  },
  {
    name: 'kinetic',
    prompt: 'Create kinetic CSS art: floating geometric text forms with perpetual motion.',
    createGenerator: (llm) => new KineticGenerator(llm),
  },
  {
    name: 'html',
    prompt: 'Create an infrastructure HTML wrapper smoke page.',
    createGenerator: (llm) => new HTMLWebGenerator(llm),
  },
  {
    name: 'ascii',
    prompt: 'Create ASCII art of a mountain landscape.',
    createGenerator: (llm) => new ASCIIArtGenerator(llm),
  },
];

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
    domains,
    outputRoot: String(args.get('output') || '.omx/logs/df1-runs'),
    baseUrl: typeof args.get('base-url') === 'string' ? String(args.get('base-url')) : undefined,
    model: typeof args.get('model') === 'string' ? String(args.get('model')) : undefined,
    lmstudioBaseUrl: typeof args.get('lmstudio-base-url') === 'string' ? String(args.get('lmstudio-base-url')) : undefined,
    lmstudioModel: typeof args.get('lmstudio-model') === 'string' ? String(args.get('lmstudio-model')) : undefined,
    maxTokens: typeof args.get('max-tokens') === 'string' ? Number(args.get('max-tokens')) : undefined,
  };
}

async function loadProviderConfig(options: CliOptions): Promise<Partial<LLMConfig> | undefined> {
  if (options.dryRun) return undefined;

  const configPath = path.join(os.homedir(), '.liminal', 'config.json');
  const fileConfig = fsSync.existsSync(configPath)
    ? JSON.parse(await fs.readFile(configPath, 'utf8'))
    : {};
  const providers = fileConfig.providers || {};
  const defaultProvider = options.provider === 'active'
    ? (fileConfig.defaultProvider || 'lmstudio')
    : options.provider;
  const providerConfig = providers[defaultProvider] || {};

  const config: Record<string, unknown> = {
    baseUrl: options.baseUrl || providerConfig.baseUrl,
    model: options.model || providerConfig.model,
    apiKey: providerConfig.apiKey,
    maxTokens: options.maxTokens || 8192,
  };

  if (defaultProvider === 'kimi') {
    config.baseUrl = options.baseUrl || 'https://api.kimi.com/coding';
    config.model = options.model || 'kimi-for-coding';
    config.apiKey = providerConfig.apiKey || process.env.KIMI_API_KEY;
  }
  if (defaultProvider === 'minimax') {
    config.baseUrl = options.baseUrl || 'https://api.minimax.io/anthropic';
    config.model = options.model || 'MiniMax-M2.7';
    config.apiKey = providerConfig.apiKey || process.env.MINIMAX_API_KEY;
  }
  if (defaultProvider === 'glm') {
    config.baseUrl = options.baseUrl || 'https://api.z.ai/api/anthropic';
    config.model = options.model || providerConfig.model || 'glm-5.1';
    config.apiKey = providerConfig.apiKey || process.env.GLM_API_KEY;
  }
  if (defaultProvider === 'openai') {
    config.baseUrl = options.baseUrl || providerConfig.baseUrl || 'https://api.openai.com/v1';
    config.model = options.model || 'gpt-5.4';
    config.apiKey = providerConfig.apiKey || process.env.OPENAI_API_KEY;
  }
  if (defaultProvider === 'lmstudio') {
    config.baseUrl = options.lmstudioBaseUrl ||
      options.baseUrl ||
      process.env.LIMINAL_LMSTUDIO_BASE_URL ||
      process.env.LMSTUDIO_BASE_URL ||
      providerConfig.baseUrl ||
      'http://localhost:1234/v1';
    config.model = options.lmstudioModel ||
      options.model ||
      process.env.LIMINAL_LMSTUDIO_MODEL ||
      process.env.LMSTUDIO_MODEL ||
      providerConfig.model ||
      'local-model';
    config.apiKey = providerConfig.apiKey;
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

async function runDomain(spec: DomainSpec, runDir: string, options: CliOptions, llmConfig?: Partial<LLMConfig>): Promise<DomainResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const domainDir = path.join(runDir, spec.name);
  await fs.mkdir(domainDir, { recursive: true });
  await writeJson(path.join(domainDir, 'prompt.json'), {
    domain: spec.name,
    prompt: spec.prompt,
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

    const result: DomainResult = {
      domain: spec.name,
      success,
      validationPassed: validation.valid,
      runtimePassed: runtime.passed,
      artifactDir: domainDir,
      codeLength: code.length,
      error: success ? undefined : [validation.errors.join('; '), runtime.error].filter(Boolean).join('; '),
      durationMs: Date.now() - start,
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

    const result: DomainResult = {
      domain: spec.name,
      success: false,
      validationPassed,
      runtimePassed: false,
      artifactDir: domainDir,
      codeLength: failedCode.length,
      error: validationError || (error instanceof Error ? error.message : String(error)),
      durationMs: Date.now() - start,
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
    '| Domain | Result | Static | Runtime | Code chars | Duration ms | Error |',
    '| --- | --- | --- | --- | ---: | ---: | --- |',
    ...results.map((result) =>
      `| ${result.domain} | ${result.success ? 'PASS' : 'FAIL'} | ${result.validationPassed ? 'PASS' : 'FAIL'} | ${result.runtimePassed === undefined ? 'SKIP' : result.runtimePassed ? 'PASS' : 'FAIL'} | ${result.codeLength} | ${result.durationMs} | ${(result.error || '').replace(/\|/g, '\\|')} |`
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const runId = `df1-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runDir = path.resolve(options.outputRoot, runId);
  await fs.mkdir(runDir, { recursive: true });

  const llmConfig = await loadProviderConfig(options);
  await writeJson(path.join(runDir, 'run.json'), {
    runId,
    dryRun: options.dryRun,
    provider: options.provider,
    domains: options.domains,
    llmConfig: llmConfig ? {
      ...llmConfig,
      apiKey: llmConfig.apiKey ? '[REDACTED]' : undefined,
    } : undefined,
    generatorRole: options.dryRun ? 'dry-run' : 'generator',
    startedAt: new Date().toISOString(),
  });

  const specs = DOMAIN_SPECS.filter((spec) => options.domains.includes(spec.name));
  const results: DomainResult[] = [];
  for (const spec of specs) {
    console.log(`DF1 ${options.dryRun ? 'dry-run' : 'run'}: ${spec.name}`);
    results.push(await runDomain(spec, runDir, options, llmConfig));
  }

  const summary = {
    runId,
    dryRun: options.dryRun,
    passed: results.filter((result) => result.success).length,
    total: results.length,
    passRate: results.length === 0 ? 0 : results.filter((result) => result.success).length / results.length,
    results,
    completedAt: new Date().toISOString(),
  };
  await writeJson(path.join(runDir, 'summary.json'), summary);
  await fs.writeFile(path.join(runDir, 'summary.md'), summaryMarkdown(runId, results, options.dryRun), 'utf8');

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
