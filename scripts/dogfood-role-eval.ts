#!/usr/bin/env node
/**
 * 🔬 DOGFOOD ROLE EVALUATION
 *
 * Full matrix: 9 domains × 2 generators × 2 harnesses = 36 runs
 * Generators: Qwen 3.5 2B, Gemma 4B (LM Studio)
 * Evaluator:  Qwen 3.5 2B-it (LM Studio)
 * Harnesses:  GLM-5.1 (cloud), MiniMax-M2.7 (cloud)
 */

import { LLMClient, type LLMResponse } from '../dist/llm/LLMClient.js';
import { P5GeneratorV2 } from '../dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from '../dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../dist/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../dist/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../dist/generators/tone/ToneGenerator.js';
import { RemotionGenerator } from '../dist/generators/remotion/RemotionGenerator.js';
import { HTMLWebGenerator } from '../dist/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../dist/generators/ascii/ASCIIArtGenerator.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Telemetry directories
const TELEMETRY_DIR = path.join(PROJECT_ROOT, 'dogfood-telemetry', 'role-eval');
const REASONING_DIR = path.join(TELEMETRY_DIR, 'reasoning');
const RESPONSES_DIR = path.join(TELEMETRY_DIR, 'responses');
const TRACES_DIR    = path.join(TELEMETRY_DIR, 'traces');
const SCORES_DIR    = path.join(TELEMETRY_DIR, 'scores');
const SUMMARIES_DIR = path.join(TELEMETRY_DIR, 'summaries');
const LANDING_DIR   = path.join(PROJECT_ROOT, 'landing-live');

for (const dir of [TELEMETRY_DIR, REASONING_DIR, RESPONSES_DIR, TRACES_DIR, SCORES_DIR, SUMMARIES_DIR, LANDING_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Domain configuration
const DOMAINS = [
  { name: 'p5',      prompt: 'Create a calming blue particle system with flowing movement',         Generator: P5GeneratorV2 },
  { name: 'glsl',     prompt: 'Create an abstract plasma shader with animated colors',               Generator: ShaderGenerator },
  { name: 'three',    prompt: 'Create a rotating 3D cube with interesting lighting',               Generator: ThreeGenerator },
  { name: 'revideo',  prompt: 'Create a typing text animation video component',                     Generator: RemotionGenerator },
  { name: 'strudel',  prompt: 'Create a simple techno beat pattern with drums',                    Generator: StrudelGenerator },
  { name: 'hydra',    prompt: 'Create a geometric video synth pattern with kaleidoscope effect',    Generator: HydraGenerator },
  { name: 'tone',     prompt: 'Create an ambient drone synthesizer with reverb',                    Generator: ToneGenerator },
  { name: 'html',     prompt: 'Create a landing page with hero section and call to action',         Generator: HTMLWebGenerator },
  { name: 'ascii',    prompt: 'Create ASCII art of a mountain landscape',                          Generator: ASCIIArtGenerator },
] as const;

type DomainName = typeof DOMAINS[number]['name'];

// Generous settings for all models
const DOGFOOD_TIMEOUT = 600_000;   // 10 minutes
const DOGFOOD_MAX_TOKENS = 32_768;

// LM Studio base URL
const LM_STUDIO_URL = 'http://localhost:1234/v1';

// ─── Model / Provider Types ────────────────────────────────────────────────────

interface ModelInfo {
  id: string;       // e.g. "qwen3.5-2b"
  name: string;      // e.g. "lmstudio-qwen3.5-2b"
  provider: 'lmstudio';
}

interface ProviderConfig {
  name: string;       // display name e.g. "glm-5.1"
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  type: 'cloud';
}

// ─── LM Studio Model Detection ────────────────────────────────────────────────

/**
 * Detect available LM Studio models and filter for qwen/gemma.
 * Returns { generator: ModelInfo, gemma: ModelInfo, evaluator: ModelInfo }
 */
async function detectLMStudioModels(): Promise<{
  generator: ModelInfo | null;
  gemma: ModelInfo | null;
  evaluator: ModelInfo | null;
}> {
  let res: Response;
  try {
    res = await fetch(`${LM_STUDIO_URL}/models`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new Error('LM Studio not available at localhost:1234');
  }
  const data = await res.json() as { data: Array<{ id: string }> };
  const available = data.data.map((m) => m.id);

  // Find Qwen 3.5 2B for generator
  const qwen2b = available.find((id) => /qwen3[._-]?5[._-]?2b/i.test(id)) ?? null;
  // Find Gemma 4B for generator B
  const gemma4b = available.find((id) => /gemma[_-]?4b/i.test(id)) ?? null;
  // Find Qwen instruction-tuned for evaluator (prefer 2b-it, fall back to any qwen it)
  const evaluator = available.find((id) => /qwen3[._-]?5[._-]?2b[_-]?it/i.test(id))
    ?? available.find((id) => /qwen.*it$/i.test(id))
    ?? null;

  return {
    generator: qwen2b ? { id: qwen2b, name: `lmstudio-${qwen2b.replace(/[/:]/g, '-')}`, provider: 'lmstudio' } : null,
    gemma:     gemma4b  ? { id: gemma4b,  name: `lmstudio-${gemma4b.replace(/[/:]/g, '-')}`,  provider: 'lmstudio' } : null,
    evaluator: evaluator ? { id: evaluator, name: `lmstudio-${evaluator.replace(/[/:]/g, '-')}`, provider: 'lmstudio' } : null,
  };
}

// ─── Cloud Config Loader ──────────────────────────────────────────────────────

/**
 * Load API keys from config file
 */
function loadCloudConfig(): { glm?: { apiKey: string }, minimax?: { apiKey: string } } {
  const configPath = path.join(process.env.HOME ?? '', '.liminal/config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

// ─── Harness Provider Configs ────────────────────────────────────────────────

function buildHarnessConfigs(cloudConfig: ReturnType<typeof loadCloudConfig>): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  // GLM-5.1 harness
  const glmApiKey = cloudConfig.glm?.apiKey ?? process.env.GLM_API_KEY;
  if (glmApiKey) {
    configs.push({
      name: 'glm-5.1',
      baseUrl: 'https://api.z.ai/api/coding/paas/v4',
      model: 'glm-5.1',
      apiKey: glmApiKey,
      timeout: DOGFOOD_TIMEOUT,
      maxTokens: DOGFOOD_MAX_TOKENS,
      temperature: 0.5,
      type: 'cloud',
    });
  }

  // MiniMax-M2.7 harness
  const minimaxApiKey = cloudConfig.minimax?.apiKey ?? process.env.MINIMAX_API_KEY;
  if (minimaxApiKey) {
    configs.push({
      name: 'MiniMax-M2.7',
      baseUrl: 'https://api.minimaxi.chat/v1',
      model: 'MiniMax-M2.7',
      apiKey: minimaxApiKey,
      timeout: DOGFOOD_TIMEOUT,
      maxTokens: DOGFOOD_MAX_TOKENS,
      temperature: 0.5,
      type: 'cloud',
    });
  }

  return configs;
}
