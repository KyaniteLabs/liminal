import fs from 'fs/promises';
import path from 'path';
import { LLMClient } from '../llm/LLMClient.js';
import { CreativeEvaluator } from '../core/CreativeEvaluator.js';
import { P5GeneratorLLM } from '../generators/p5/P5GeneratorLLM.js';
import { ShaderGenerator } from '../generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../generators/tone/ToneGenerator.js';
import { HTMLWebGenerator } from '../generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../generators/ascii/ASCIIArtGenerator.js';
import { RemotionGenerator } from '../generators/remotion/RemotionGenerator.js';

export type RegressionDomain =
  | 'p5'
  | 'glsl'
  | 'three'
  | 'strudel'
  | 'hydra'
  | 'tone'
  | 'html'
  | 'ascii'
  | 'revideo';

export interface RegressionRequest {
  provider: string;
  model: string;
  domain: RegressionDomain | 'remotion';
  prompt?: string;
  baseUrl?: string;
  apiKey?: string;
  outputRoot?: string;
}

export interface RegressionEvaluation {
  passed: boolean;
  score: number;
  technicalScore: number;
  creativeScore: number;
  issues: string[];
}

export interface RegressionResult {
  provider: string;
  model: string;
  domain: RegressionDomain;
  prompt: string;
  baseUrl: string;
  durationMs: number;
  outputDir: string;
  rawArtifactPath: string;
  wrappedArtifactPath: string;
  summaryPath: string;
  rawEvaluation: RegressionEvaluation;
  wrappedEvaluation: RegressionEvaluation;
}

const DEFAULT_PROMPTS: Record<RegressionDomain, string> = {
  p5: 'Create an animated p5.js sketch featuring colorful fireworks exploding in the night sky. Include particle physics, gravity, and fading trails.',
  glsl: 'Create a GLSL fragment shader that renders a mesmerizing plasma effect with animated color shifts. Include noise functions and time-based animation.',
  three: 'Create a Three.js scene with a rotating wireframe torus knot that changes colors. Include orbit controls and animated lighting.',
  strudel: 'Create a Strudel pattern that plays a techno beat with kick, snare, hi-hat, and a bassline. Use pattern functions and effects.',
  hydra: 'Create a Hydra video synth patch with feedback effects, color shifting, and geometric patterns. Make it visually striking.',
  tone: 'Create a Tone.js synthesizer patch that plays an ambient drone with reverb and delay effects. Use multiple oscillators and LFOs for rich sound.',
  html: 'Create a responsive landing page for a creative coding portfolio. Include a hero section with animated gradient background, project cards, and contact form.',
  ascii: 'Create simple ASCII art of a mountain landscape. Use only basic characters like @ # % * + = - . and spaces.',
  revideo: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle.',
};

export function normalizeRegressionDomain(domain: RegressionRequest['domain']): RegressionDomain {
  return domain === 'remotion' ? 'revideo' : domain;
}

export function inferRegressionBaseUrl(provider: string, explicitBaseUrl?: string): string {
  if (explicitBaseUrl) return explicitBaseUrl;
  switch (provider) {
    case 'lmstudio':
      return 'http://localhost:1234/v1';
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'minimax':
      return 'https://api.minimaxi.com/v1';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function shouldAllowLocalhost(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1|::1/.test(baseUrl);
}

function getArtifactExtension(domain: RegressionDomain): string {
  switch (domain) {
    case 'ascii':
      return 'txt';
    case 'html':
    case 'tone':
    case 'three':
    case 'strudel':
      return 'html';
    case 'glsl':
      return 'glsl';
    case 'p5':
    case 'hydra':
    case 'revideo':
    default:
      return 'js';
  }
}

function toEvaluation(result: ReturnType<typeof CreativeEvaluator.assess>): RegressionEvaluation {
  return {
    passed: result.passed,
    score: result.score,
    technicalScore: result.technicalScore,
    creativeScore: result.creativeScore,
    issues: result.issues,
  };
}

async function createGenerator(domain: RegressionDomain, llm: LLMClient) {
  switch (domain) {
    case 'p5':
      return new P5GeneratorLLM(llm);
    case 'glsl':
      return new ShaderGenerator(llm);
    case 'three':
      return new ThreeGenerator(llm);
    case 'strudel':
      return new StrudelGenerator(llm);
    case 'hydra':
      return new HydraGenerator(llm);
    case 'tone':
      return new ToneGenerator(llm);
    case 'html':
      return new HTMLWebGenerator(llm);
    case 'ascii':
      return new ASCIIArtGenerator(llm);
    case 'revideo':
      return new RemotionGenerator(llm);
  }
}

async function generateDomainArtifact(domain: RegressionDomain, generator: Awaited<ReturnType<typeof createGenerator>>, prompt: string): Promise<string> {
  switch (domain) {
    case 'html':
      return (generator as HTMLWebGenerator).generate(prompt, { responsive: true, includeAnimations: true });
    case 'ascii':
      return (generator as ASCIIArtGenerator).generate(prompt, { style: 'abstract', width: 60, height: 30 });
    default:
      return (generator as { generate: (prompt: string) => Promise<string> }).generate(prompt);
  }
}

export async function runGenerationRegression(request: RegressionRequest): Promise<RegressionResult> {
  const domain = normalizeRegressionDomain(request.domain);
  const baseUrl = inferRegressionBaseUrl(request.provider, request.baseUrl);
  const prompt = request.prompt ?? DEFAULT_PROMPTS[domain];

  if (shouldAllowLocalhost(baseUrl)) {
    process.env.LIMINAL_ALLOW_LOCALHOST_LLM = 'true';
    process.env.LIMINAL_ALLOW_LOCALHOST = 'true';
  }

  const llm = new LLMClient({
    baseUrl,
    apiKey: request.apiKey ?? process.env.LIMINAL_LLM_API_KEY ?? process.env.MINIMAX_API_KEY ?? process.env.OLLAMA_API_KEY ?? process.env.LMSTUDIO_API_KEY,
    model: request.model,
    temperature: 0.7,
    maxTokens: 4000,
  });

  const generator = await createGenerator(domain, llm);
  const started = Date.now();
  const rawArtifact = await generateDomainArtifact(domain, generator, prompt);
  const durationMs = Date.now() - started;

  const wrappedArtifact = typeof (generator as { wrapForGallery?: (code: string) => string }).wrapForGallery === 'function'
    ? (generator as { wrapForGallery: (code: string) => string }).wrapForGallery(rawArtifact)
    : rawArtifact;

  const rawEvaluation = toEvaluation(CreativeEvaluator.assess(rawArtifact, { domain: domain === 'strudel' ? 'music' : domain }));
  const wrappedEvaluation = toEvaluation(CreativeEvaluator.assess(wrappedArtifact, { domain: domain === 'strudel' ? 'music' : domain }));

  const safeProvider = request.provider.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeModel = request.model.replace(/[^a-zA-Z0-9._-]/g, '_');
  const root = request.outputRoot ?? path.join('artifacts', 'regression-harness');
  const outputDir = path.join(root, safeProvider, safeModel, domain);
  await fs.mkdir(outputDir, { recursive: true });

  const ext = getArtifactExtension(domain);
  const rawArtifactPath = path.join(outputDir, `raw.${ext}`);
  const wrappedArtifactPath = path.join(outputDir, 'wrapped.html');
  const summaryPath = path.join(outputDir, 'summary.json');

  await fs.writeFile(rawArtifactPath, rawArtifact, 'utf8');
  await fs.writeFile(wrappedArtifactPath, wrappedArtifact, 'utf8');

  const summary: RegressionResult = {
    provider: request.provider,
    model: request.model,
    domain,
    prompt,
    baseUrl,
    durationMs,
    outputDir,
    rawArtifactPath,
    wrappedArtifactPath,
    summaryPath,
    rawEvaluation,
    wrappedEvaluation,
  };

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}
