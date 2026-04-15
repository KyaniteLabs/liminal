#!/usr/bin/env node
/**
 * 🌙 KIMI CLOUD PROVIDER DOGFOOD TEST
 * Tests all 9 domains with kimi-k2p5 model
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

const KIMI_CONFIG = {
  name: 'kimi-k2p5',
  baseUrl: 'https://api.moonshot.ai/v1',
  model: 'kimi-k2.5',
  apiKey: process.env.KIMI_API_KEY || '',
};

interface Result {
  domain: string;
  model: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runTest(domain: typeof DOMAINS[0]): Promise<Result> {
  const start = Date.now();
  const outputPath = `landing-live/kimi-${domain.name}-kimi-k2p5.html`;
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: KIMI_CONFIG.baseUrl,
      model: KIMI_CONFIG.model,
      apiKey: KIMI_CONFIG.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    console.log(`  ✅ ${domain.name} (${duration}ms)`);
    
    return { domain: domain.name, model: KIMI_CONFIG.model, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${domain.name} (${duration}ms): ${errorMsg.slice(0, 80)}`);
    return { domain: domain.name, model: KIMI_CONFIG.model, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('🌙 KIMI CLOUD PROVIDER DOGFOOD\n');
  
  if (!KIMI_CONFIG.apiKey) {
    console.log('⚠️ No KIMI_API_KEY found. Set KIMI_API_KEY environment variable');
    process.exit(1);
  }

  console.log(`Model: ${KIMI_CONFIG.name} (${KIMI_CONFIG.model})`);
  console.log(`Tests: ${DOMAINS.length} domains\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const startTime = Date.now();
  const results: Result[] = [];

  // Run tests sequentially to avoid rate limiting
  for (const domain of DOMAINS) {
    const result = await runTest(domain);
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-report-kimi.json'),
    JSON.stringify({ 
      timestamp: new Date().toISOString(), 
      provider: 'kimi',
      model: KIMI_CONFIG.model,
      total: results.length, 
      success, 
      failed, 
      rate: ((success/results.length)*100).toFixed(1)+'%', 
      duration: totalDuration+'ms', 
      results 
    }, null, 2)
  );

  console.log('\n🌙 KIMI COMPLETE');
  console.log(`⏱️ ${(totalDuration/1000).toFixed(1)}s | ✅ ${success} | ❌ ${failed} | 📈 ${((success/results.length)*100).toFixed(1)}%`);
  
  // Summary
  console.log('\n📋 RESULTS:');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.domain}: ${r.success ? 'SUCCESS' : 'FAILED'} (${r.duration}ms)`);
  }
}

main().catch(console.error);
