#!/usr/bin/env node
/**
 * 🦙 OLLAMA DOGFOOD - AGENT A (p5, glsl, three, strudel)
 * Uses gemma4 model (already loaded in Ollama)
 */

import { LLMClient } from '../dist/llm/LLMClient.js';
import { P5GeneratorV2 } from '../dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from '../dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../dist/generators/strudel/StrudelGenerator.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Agent A domains: p5, glsl, three, strudel
const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
];

// Use gemma4 which is already loaded
const MODEL = { name: 'gemma4', model: 'gemma4:latest', baseUrl: 'http://localhost:11434/v1' };

interface Result {
  domain: string; model: string; success: boolean; duration: number; error?: string;
}

async function runTest(domain: typeof DOMAINS[0], model: typeof MODEL): Promise<Result> {
  const start = Date.now();
  const outputPath = `landing-live/ollama-${domain.name}-${model.name}.html`;
  
  console.log(`  Testing ${domain.name}...`);
  
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
    console.log(`  ❌ ${domain.name} × ${model.name} (${duration}ms): ${errorMsg.slice(0, 100)}`);
    return { domain: domain.name, model: model.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('🦙 OLLAMA DOGFOOD - AGENT A\n');
  console.log('Domains: p5, glsl, three, strudel');
  console.log(`Model: ${MODEL.model} (already loaded)\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const results: Result[] = [];
  const startTime = Date.now();
  
  for (const domain of DOMAINS) {
    const result = await runTest(domain, MODEL);
    results.push(result);
    console.log(`📊 Progress: ${results.length}/${DOMAINS.length}\n`);
  }

  const totalDuration = Date.now() - startTime;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  const report = {
    timestamp: new Date().toISOString(),
    agent: 'A',
    provider: 'ollama',
    model: MODEL.model,
    domains: DOMAINS.map(d => d.name),
    total: results.length,
    success,
    failed,
    rate: ((success/results.length)*100).toFixed(1)+'%',
    duration: totalDuration+'ms',
    results
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-results-ollama-a.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('🦙 OLLAMA AGENT A COMPLETE');
  console.log(`⏱️ ${(totalDuration/1000/60).toFixed(1)}m | ✅ ${success} | ❌ ${failed} | 📈 ${((success/results.length)*100).toFixed(1)}%`);
  
  // Summary per domain
  console.log('\n📋 Domain Summary:');
  for (const domain of DOMAINS.map(d => d.name)) {
    const domainResults = results.filter(r => r.domain === domain);
    const domainSuccess = domainResults.filter(r => r.success).length;
    console.log(`  ${domain}: ${domainSuccess}/${domainResults.length} passed`);
  }
  
  console.log(`\n📁 Results saved to: dogfood-results-ollama-a.json`);
}

main().catch(console.error);
