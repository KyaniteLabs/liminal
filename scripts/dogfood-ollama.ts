#!/usr/bin/env node
/**
 * 🦙 OLLAMA DOGFOOD - LOCAL MODELS (SLOWER)
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

async function getOllamaModels() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    const data = await res.json();
    return data.models.map((m: { name: string }) => ({
      name: m.name.replace(/:/g, '-'),
      model: m.name,
      baseUrl: 'http://localhost:11434/v1',
    }));
  } catch {
    console.error('❌ Ollama not available at localhost:11434');
    process.exit(1);
  }
}

interface Result {
  domain: string; model: string; success: boolean; duration: number; error?: string;
}

async function runTest(domain: typeof DOMAINS[0], model: { name: string; model: string; baseUrl: string }): Promise<Result> {
  const start = Date.now();
  const outputPath = `landing-live/ollama-${domain.name}-${model.name}.html`;
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: model.baseUrl,
      model: model.model,
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
  console.log('🦙 OLLAMA DOGFOOD\n');
  
  const models = await getOllamaModels();
  console.log(`Models: ${models.length} models`);
  console.log(`Tests: ${DOMAINS.length} domains × ${models.length} models = ${DOMAINS.length * models.length}\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  // Run in smaller batches since Ollama is slower
  const BATCH_SIZE = 3;
  const results: Result[] = [];
  
  const tests: Array<{ domain: typeof DOMAINS[0]; model: typeof models[0] }> = [];
  for (const domain of DOMAINS) {
    for (const model of models) {
      tests.push({ domain, model });
    }
  }

  const startTime = Date.now();
  
  for (let i = 0; i < tests.length; i += BATCH_SIZE) {
    const batch = tests.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(t => runTest(t.domain, t.model)));
    results.push(...batchResults);
    console.log(`📊 Progress: ${Math.min(i + BATCH_SIZE, tests.length)}/${tests.length}`);
  }

  const totalDuration = Date.now() - startTime;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-report-ollama.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), total: results.length, success, failed, rate: ((success/results.length)*100).toFixed(1)+'%', duration: totalDuration+'ms', results }, null, 2)
  );

  console.log('\n🦙 OLLAMA COMPLETE');
  console.log(`⏱️ ${(totalDuration/1000/60).toFixed(1)}m | ✅ ${success} | ❌ ${failed} | 📈 ${((success/results.length)*100).toFixed(1)}%`);
}

main().catch(console.error);
