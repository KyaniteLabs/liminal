#!/usr/bin/env tsx
/**
 * Local Model Campaign Runner — Resume Mode
 *
 * Resumes a crashed local campaign by checking results.jsonl for
 * already-completed runs, then running the remaining ones.
 *
 * Usage: tsx scripts/campaign-local-resume.ts [--output-dir DIR]
 */

import { P5GeneratorLLM } from '../src/generators/p5/P5GeneratorLLM.js';
import { ShaderGenerator } from '../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../src/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../src/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../src/generators/hydra/HydraGenerator.js';
import { RemotionGenerator } from '../src/generators/remotion/RemotionGenerator.js';
import { HTMLWebGenerator } from '../src/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../src/generators/ascii/ASCIIArtGenerator.js';
import { ToneGenerator } from '../src/generators/tone/ToneGenerator.js';
import { LLMClient } from '../src/llm/LLMClient.js';

import { writeFileSync, mkdirSync, appendFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOMAIN_PROMPTS: Record<string, string> = {
  p5: `Create an animated p5.js sketch featuring colorful fireworks exploding in the night sky. Include particle physics, gravity, and fading trails.`,
  glsl: `Create a GLSL fragment shader that renders a mesmerizing plasma effect with animated color shifts. Include noise functions and time-based animation.`,
  three: `Create a Three.js scene with a rotating wireframe torus knot that changes colors. Include orbit controls and animated lighting.`,
  strudel: `Create a Strudel pattern that plays a techno beat with kick, snare, hi-hat, and a bassline. Use pattern functions and effects.`,
  hydra: `Create a Hydra video synth patch with feedback effects, color shifting, and geometric patterns. Make it visually striking.`,
  remotion: `Create a Remotion video component that animates text typing with a cursor blink, then fades in a subtitle.`,
  html: `Create a responsive landing page for a creative coding portfolio. Include a hero section with animated gradient background, project cards, and contact form.`,
  ascii: `Create simple ASCII art of a mountain landscape. Use only basic characters like @ # % * + = - . and spaces.`,
  tone: `Create a Tone.js synthesizer patch that plays an ambient drone with reverb and delay effects. Use multiple oscillators and LFOs for rich sound.`,
};

const DOMAINS = Object.keys(DOMAIN_PROMPTS);

const LOCAL_MODELS = [
  { name: 'gemma4:latest', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'gemma3:4b', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'phi4-mini:latest', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'qwen3.5:2b', baseUrl: 'http://localhost:11434', apiStyle: 'ollama' as const },
  { name: 'qwen3.5:0.8b', baseUrl: 'http://localhost:11434', apiStyle: 'ollama' as const },
  { name: 'granite4:1b', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'granite4:350m', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'lfm2.5-thinking:1.2b', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
];

const ROUNDS = 3;
const TIMEOUT_MS = 300_000; // 5 min timeout per run

interface CampaignResult {
  model: string;
  round: number;
  domain: string;
  success: boolean;
  duration: number;
  codeLength: number;
  code?: string;
  error?: string;
  // Reasoning / thinking telemetry
  reasoning?: string;
  thinking?: string;
  thinkingSource?: string;
  reasoningQuality?: number;
  recoveredFromThinking?: boolean;
  detectedPatterns?: string[];
  timestamp: string;
}

function loadCompleted(outputBase: string): Set<string> {
  const jsonlPath = join(outputBase, 'results.jsonl');
  if (!existsSync(jsonlPath)) return new Set();

  const content = readFileSync(jsonlPath, 'utf-8');
  const completed = new Set<string>();
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      completed.add(`${r.model}|${r.round}|${r.domain}`);
    } catch { /* skip malformed */ }
  }
  return completed;
}

/**
 * Generate with a hard timeout using AbortController.
 * The generators don't pass signals internally, so we monkey-patch
 * the LLMClient's generate method to inject the abort signal.
 */
interface GenerationTelemetry {
  code: string;
  thinking?: string;
  thinkingSource?: string;
  reasoningQuality?: number;
  recoveredFromThinking?: boolean;
  detectedPatterns?: string[];
}

async function generateWithLLM(
  prompt: string,
  domain: string,
  llm: LLMClient,
  abortSignal?: AbortSignal
): Promise<GenerationTelemetry> {
  // Monkey-patch llm.generate to inject the abort signal if provided
  if (abortSignal) {
    const origGenerate = llm.generate.bind(llm);
    (llm as any).generate = (sys: string, user: string, _sig?: AbortSignal, bypass?: boolean) =>
      origGenerate(sys, user, abortSignal, bypass);
  }

  switch (domain) {
    case 'p5': {
      const gen = new P5GeneratorLLM(llm);
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'glsl': {
      const gen = new ShaderGenerator();
      (gen as any).llm = llm;
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'three': {
      const gen = new ThreeGenerator();
      (gen as any).llm = llm;
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'strudel': {
      const gen = new StrudelGenerator(llm);
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'hydra': {
      const gen = new HydraGenerator(llm);
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'remotion': {
      const gen = new RemotionGenerator();
      (gen as any).llm = llm;
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'html': {
      const gen = new HTMLWebGenerator(llm);
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'ascii': {
      const gen = new ASCIIArtGenerator(llm);
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    case 'tone': {
      const gen = new ToneGenerator(llm);
      const resp = await gen.generateFull(prompt);
      return {
        code: resp.code,
        thinking: resp.thinking,
        thinkingSource: resp.thinkingSource,
        reasoningQuality: resp.reasoningQuality,
        recoveredFromThinking: resp.recoveredFromThinking,
        detectedPatterns: resp.detectedPatterns,
      };
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let outputBase = 'dogfood-campaign-local-2026-04-04T07-59-30';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      outputBase = args[i + 1];
      i++;
    }
  }

  // Ensure output dirs exist
  mkdirSync(join(outputBase, 'code'), { recursive: true });
  mkdirSync(join(outputBase, 'traces'), { recursive: true });

  // Load completed runs
  const completed = loadCompleted(outputBase);
  console.log(`Loaded ${completed.size} completed runs from ${outputBase}/results.jsonl`);

  // Build remaining work
  const remaining: { model: typeof LOCAL_MODELS[0]; round: number; domain: string }[] = [];
  for (const model of LOCAL_MODELS) {
    for (let round = 1; round <= ROUNDS; round++) {
      for (const domain of DOMAINS) {
        const key = `${model.name}|${round}|${domain}`;
        if (!completed.has(key)) {
          remaining.push({ model, round, domain });
        }
      }
    }
  }

  console.log(`Remaining: ${remaining.length} runs\n`);

  if (remaining.length === 0) {
    console.log('All runs complete!');
    return;
  }

  let completedCount = 0;
  for (const { model: modelConfig, round, domain } of remaining) {
    completedCount++;
    const prompt = DOMAIN_PROMPTS[domain];
    const runTimestamp = new Date().toISOString();
    const safeModel = modelConfig.name.replace(/[^a-zA-Z0-9]/g, '_');

    process.stdout.write(`[${completedCount}/${remaining.length}] ${modelConfig.name} r${round} ${domain}... `);

    const llm = new LLMClient({
      baseUrl: modelConfig.baseUrl,
      apiKey: 'ollama',
      model: modelConfig.name,
      temperature: 0.7,
      maxTokens: 4000,
      apiStyle: modelConfig.apiStyle,
    });
    llm.disableCache();

    const startTime = Date.now();
    let result: CampaignResult;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const telemetry = await generateWithLLM(prompt, domain, llm, controller.signal);
      clearTimeout(timer);
      const duration = Date.now() - startTime;

      const codeFile = join(outputBase, 'code', `${safeModel}-round${round}-${domain}.js`);
      writeFileSync(codeFile, telemetry.code);

      if (telemetry.thinking) {
        writeFileSync(join(outputBase, 'traces', `${safeModel}-round${round}-${domain}-thinking.txt`), telemetry.thinking);
      }

      result = {
        model: modelConfig.name,
        round,
        domain,
        success: true,
        duration,
        codeLength: telemetry.code.length,
        code: codeFile,
        reasoning: telemetry.thinking || undefined,
        thinking: telemetry.thinking || undefined,
        thinkingSource: telemetry.thinkingSource || 'local',
        reasoningQuality: telemetry.reasoningQuality,
        recoveredFromThinking: telemetry.recoveredFromThinking,
        detectedPatterns: telemetry.detectedPatterns,
        timestamp: runTimestamp,
      };

      const thinkingTag = telemetry.thinking ? ` [thinking: ${telemetry.thinking.length} chars${telemetry.recoveredFromThinking ? ', recovered' : ''}]` : '';
      console.log(`OK (${(duration / 1000).toFixed(1)}s, ${telemetry.code.length} chars${thinkingTag})`);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errMsg = error?.message || String(error);

      result = {
        model: modelConfig.name,
        round,
        domain,
        success: false,
        duration,
        codeLength: 0,
        error: errMsg.slice(0, 200),
        thinkingSource: 'local',
        timestamp: runTimestamp,
      };

      console.log(`FAIL (${(duration / 1000).toFixed(1)}s): ${errMsg.slice(0, 60)}`);
    }

    appendFileSync(join(outputBase, 'results.jsonl'), JSON.stringify(result) + '\n');
  }

  console.log(`\nResume complete. ${remaining.length} runs processed.`);
}

main().catch(err => {
  console.error('Resume campaign failed:', err);
  process.exit(1);
});
