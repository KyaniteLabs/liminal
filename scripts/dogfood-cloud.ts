#!/usr/bin/env node
/**
 * ☁️ CLOUD PROVIDERS DOGFOOD - FAST PARALLEL EXECUTION
 * MiniMax + OpenRouter
 */

import { LLMClient } from '../dist/llm/LLMClient.js';
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

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
  { name: 'hydra', prompt: 'Create a kaleidoscope effect', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create ambient drone', Generator: ToneGenerator },
  { name: 'revideo', prompt: 'Create a Revideo typing animation scene', Generator: RemotionGenerator },
  { name: 'html', prompt: 'Create landing page', Generator: HTMLWebGenerator },
  { name: 'ascii', prompt: 'Create mountain ASCII art', Generator: ASCIIArtGenerator },
];

const CLOUD_MODELS = [
  ...(process.env.MINIMAX_API_KEY ? [
    { name: 'minimax-m27', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.7', apiKey: process.env.MINIMAX_API_KEY },
    { name: 'minimax-m25', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.5', apiKey: process.env.MINIMAX_API_KEY },
  ] : []),
  ...(process.env.OPENROUTER_API_KEY ? [
    { name: 'openrouter-claude', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet', apiKey: process.env.OPENROUTER_API_KEY },
    { name: 'openrouter-gpt4', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', apiKey: process.env.OPENROUTER_API_KEY },
  ] : []),
];

interface Result {
  domain: string; model: string; success: boolean; duration: number; error?: string;
}

async function runTest(domain: typeof DOMAINS[0], model: typeof CLOUD_MODELS[0]): Promise<Result> {
  const start = Date.now();
  const outputPath = `landing-live/cloud-${domain.name}-${model.name}.html`;
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: model.baseUrl,
      model: model.model,
      apiKey: model.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    console.log(`  ✅ ${domain.name} × ${model.name} (${duration}ms)`);
    
    return { domain: domain.name, model: model.name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${domain.name} × ${model.name} (${duration}ms): ${errorMsg.slice(0, 80)}`);
    return { domain: domain.name, model: model.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('☁️ CLOUD PROVIDERS DOGFOOD\n');
  
  if (CLOUD_MODELS.length === 0) {
    console.log('⚠️ No cloud API keys found. Set MINIMAX_API_KEY or OPENROUTER_API_KEY');
    process.exit(0);
  }

  console.log(`Models: ${CLOUD_MODELS.map(m => m.name).join(', ')}`);
  console.log(`Tests: ${DOMAINS.length} domains × ${CLOUD_MODELS.length} models = ${DOMAINS.length * CLOUD_MODELS.length}\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  // Run ALL in parallel (cloud is fast!)
  const promises: Promise<Result>[] = [];
  for (const domain of DOMAINS) {
    for (const model of CLOUD_MODELS) {
      promises.push(runTest(domain, model));
    }
  }

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-report-cloud.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), total: results.length, success, failed, rate: ((success/results.length)*100).toFixed(1)+'%', duration: totalDuration+'ms', results }, null, 2)
  );

  console.log('\n☁️ CLOUD COMPLETE');
  console.log(`⏱️ ${(totalDuration/1000).toFixed(1)}s | ✅ ${success} | ❌ ${failed} | 📈 ${((success/results.length)*100).toFixed(1)}%`);
}

main().catch(console.error);
