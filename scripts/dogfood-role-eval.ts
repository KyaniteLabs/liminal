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

// ─── Telemetry Wrapper ────────────────────────────────────────────────────────

/**
 * Wraps LLMClient to capture all request/response data to disk.
 * Each call gets a unique callId for traceability.
 */
class TelemetryLLMClient {
  private testId: string;

  constructor(private inner: LLMClient, testId: string) {
    this.testId = testId;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
    const callId = `${this.testId}-${Date.now()}`;
    const requestStart = Date.now();

    // Log request
    const requestData = {
      timestamp: new Date().toISOString(),
      callId,
      testId: this.testId,
      model: (this.inner as any).config?.model ?? 'unknown',
      baseUrl: (this.inner as any).config?.baseUrl ?? 'unknown',
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      temperature: (this.inner as any).config?.temperature,
      maxTokens: (this.inner as any).config?.maxTokens,
    };
    fs.writeFileSync(
      path.join(TRACES_DIR, `${callId}-request.json`),
      JSON.stringify(requestData, null, 2)
    );

    try {
      const response = await this.inner.generate(systemPrompt, userPrompt);
      const duration = Date.now() - requestStart;

      const modelName = this.inner.getConfig().model;
      const responseData = {
        timestamp: new Date().toISOString(),
        callId,
        testId: this.testId,
        duration,
        success: response.success,
        codeLength: response.code?.length ?? 0,
        hasThinking: !!response.thinking,
        hasReasoning: !!response.reasoning,
        recoveredFromThinking: response.recoveredFromThinking,
        model: modelName,
        error: response.error,
        code: response.code,
        thinking: response.thinking,
        reasoning: response.reasoning,
        explanation: response.explanation,
      };
      fs.writeFileSync(
        path.join(RESPONSES_DIR, `${callId}-response.json`),
        JSON.stringify(responseData, null, 2)
      );

      // Reasoning trace markdown
      if (response.thinking || response.reasoning) {
        const traceMd = [
          `# Reasoning Trace: ${this.testId}`,
          `**Model:** ${modelName ?? 'unknown'}`,
          `**Duration:** ${duration}ms`,
          `**Recovered from thinking:** ${response.recoveredFromThinking ?? false}`,
          `## Prompt`,
          userPrompt.slice(0, 1000),
          `## Reasoning/Thinking`,
          response.thinking || response.reasoning || '',
          `## Generated Code`,
          '```\n' + (response.code ?? '// No code').slice(0, 2000) + '\n```',
        ].join('\n\n');
        fs.writeFileSync(path.join(REASONING_DIR, `${callId}-reasoning.md`), traceMd);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - requestStart;
      fs.writeFileSync(
        path.join(TRACES_DIR, `${callId}-error.json`),
        JSON.stringify({
          timestamp: new Date().toISOString(),
          callId,
          testId: this.testId,
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }, null, 2)
      );
      throw error;
    }
  }
}

// ─── Harness System Prompts ──────────────────────────────────────────────────

/**
 * Builds the harness system prompt that instructs the harness to:
 * 1. Call the Generator with the user prompt
 * 2. Call the Evaluator to score the result
 * 3. Return final code + score
 *
 * The harness (GLM or MiniMax) orchestrates the local models via structured output.
 */
function buildHarnessSystemPrompt(domainName: string, domainPrompt: string): string {
  return `You are orchestrating a code generation pipeline for the "${domainName}" creative domain.

Your task is to:
1. Generate code for: "${domainPrompt}"
2. Evaluate the generated code for correctness and domain relevance
3. Return the final code with a confidence score 0-1

Respond in this JSON format only:
{
  "generatedCode": "... the full code ...",
  "score": 0.85,
  "reasoning": "... brief evaluation notes ..."
}

Do not include any text outside this JSON structure.`;
}

const EVALUATOR_SYSTEM_PROMPT = `You are a precise code evaluator. Score generated code 0-1 for:
- Correctness (0.4 weight): Does it run without errors?
- Domain relevance (0.3 weight): Does it match the requested creative domain?
- Code quality (0.3 weight): Is it well-structured and complete?

Respond ONLY with a JSON object:
{
  "score": 0.85,
  "correctness": 0.9,
  "relevance": 0.8,
  "quality": 0.85,
  "notes": "..."
}`;

const GENERATOR_SYSTEM_PROMPT = `You are an expert creative code generator. Generate the best possible code for the requested creative domain. Output ONLY the raw code, no explanation, no markdown fences, no comments outside the code.`;

// ─── Harness Result Interface ──────────────────────────────────────────────────

interface HarnessResult {
  success: boolean;
  finalCode: string;
  harnessScore: number;
  generatorModel: string;
  harnessModel: string;
  evaluatorModel: string;
  domain: string;
  harnessCallId: string;
  generatorCallId: string;
  evaluatorCallId: string;
  duration: number;
  error?: string;
  reasoning?: string;
}

// ─── Harness Test Orchestration ────────────────────────────────────────────────

/**
 * Runs a single test: Harness → Generator → Evaluator → Score
 * Returns the harness decision with telemetry IDs for traceability.
 */
async function runHarnessTest(
  domain: typeof DOMAINS[number],
  harnessCfg: ProviderConfig,
  generatorModel: ModelInfo,
  evaluatorModel: ModelInfo,
): Promise<HarnessResult> {
  const testId = `role-eval-${harnessCfg.name}-${generatorModel.name}-${domain.name}`;
  const startTime = Date.now();

  const harnessLLM = new LLMClient({
    role: 'harness',
    baseUrl: harnessCfg.baseUrl,
    model: harnessCfg.model,
    apiKey: harnessCfg.apiKey,
    temperature: harnessCfg.temperature,
    maxTokens: harnessCfg.maxTokens,
  });

  const generatorLLM = new LLMClient({
    role: 'generator',
    baseUrl: LM_STUDIO_URL,
    model: generatorModel.id,
    temperature: 0.7,
    maxTokens: DOGFOOD_MAX_TOKENS,
  });

  const evaluatorLLM = new LLMClient({
    role: 'evaluator',
    baseUrl: LM_STUDIO_URL,
    model: evaluatorModel.id,
    temperature: 0.2,
    maxTokens: DOGFOOD_MAX_TOKENS,
  });

  const tHarness = new TelemetryLLMClient(harnessLLM, `${testId}-harness`);
  const tGenerator = new TelemetryLLMClient(generatorLLM, `${testId}-generator`);
  const tEvaluator = new TelemetryLLMClient(evaluatorLLM, `${testId}-evaluator`);

  try {
    // Step 1: Ask harness to orchestrate
    const harnessResponse = await tHarness.generate(
      buildHarnessSystemPrompt(domain.name, domain.prompt),
      domain.prompt,
    );

    if (!harnessResponse.success || !harnessResponse.code) {
      throw new Error(harnessResponse.error ?? 'Harness returned no code');
    }

    // Parse harness JSON response
    let harnessData: { generatedCode: string; score: number; reasoning?: string };
    try {
      // Try to extract JSON from response
      const jsonMatch = harnessResponse.code.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in harness response');
      harnessData = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Harness did not return valid JSON: ' + harnessResponse.code.slice(0, 200));
    }

    // Step 2: Evaluate the generated code
    const evalResponse = await tEvaluator.generate(
      EVALUATOR_SYSTEM_PROMPT,
      `Domain: ${domain.name}\nPrompt: ${domain.prompt}\n\nGenerated code:\n${harnessData.generatedCode}`,
    );

    let evalScore = harnessData.score;
    if (evalResponse.success && evalResponse.code) {
      try {
        const evalMatch = evalResponse.code.match(/\{[\s\S]*\}/);
        if (evalMatch) {
          const evalData = JSON.parse(evalMatch[0]);
          evalScore = evalData.score ?? harnessData.score;
        }
      } catch { /* use harness score as fallback */ }
    }

    const duration = Date.now() - startTime;

    // Save the generated code to landing-live
    const outputFile = path.join(
      LANDING_DIR,
      `dogfood-role-eval-${harnessCfg.name}-${generatorModel.name}-${domain.name}.html`,
    );
    fs.writeFileSync(outputFile, harnessData.generatedCode);

    // Save score
    const scoreData = {
      timestamp: new Date().toISOString(),
      testId,
      domain: domain.name,
      harness: harnessCfg.name,
      generator: generatorModel.name,
      evaluator: evaluatorModel.name,
      harnessScore: harnessData.score,
      evaluatorScore: evalScore,
      finalScore: (harnessData.score + evalScore) / 2,
      duration,
      generatorCallId: `${testId}-generator-${Date.now()}`,
      evaluatorCallId: `${testId}-evaluator-${Date.now()}`,
    };
    fs.writeFileSync(
      path.join(SCORES_DIR, `${testId}-score.json`),
      JSON.stringify(scoreData, null, 2),
    );

    return {
      success: true,
      finalCode: harnessData.generatedCode,
      harnessScore: evalScore,
      generatorModel: generatorModel.name,
      harnessModel: harnessCfg.name,
      evaluatorModel: evaluatorModel.name,
      domain: domain.name,
      harnessCallId: `${testId}-harness`,
      generatorCallId: `${testId}-generator`,
      evaluatorCallId: `${testId}-evaluator`,
      duration,
      reasoning: harnessData.reasoning,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      finalCode: '',
      harnessScore: 0,
      generatorModel: generatorModel.name,
      harnessModel: harnessCfg.name,
      evaluatorModel: evaluatorModel.name,
      domain: domain.name,
      harnessCallId: `${testId}-harness`,
      generatorCallId: `${testId}-generator`,
      evaluatorCallId: `${testId}-evaluator`,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
