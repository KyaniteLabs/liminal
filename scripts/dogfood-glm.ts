#!/usr/bin/env node
/**
 * 🌟 GLM CLOUD PROVIDER DOGFOOD
 * Tests all 9 domains with GLM-5.1 model
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

const GLM_CONFIG = {
  name: 'glm-5.1',
  baseUrl: 'https://api.z.ai/api/coding/paas/v4',
  model: 'glm-5.1',
  apiKey: '1d4eebaada2e4da59ef1a9aa11375d18.GayzeS6a4nuoBVFj',
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
  const outputPath = `landing-live/glm-${domain.name}-glm-5.1.html`;
  
  console.log(`  🔄 Testing ${domain.name}...`);
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: GLM_CONFIG.baseUrl,
      model: GLM_CONFIG.model,
      apiKey: GLM_CONFIG.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    console.log(`  ✅ ${domain.name} (${duration}ms) → ${outputPath}`);
    
    return { domain: domain.name, model: GLM_CONFIG.name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${domain.name} (${duration}ms): ${errorMsg.slice(0, 100)}`);
    return { domain: domain.name, model: GLM_CONFIG.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('🌟 GLM CLOUD PROVIDER DOGFOOD\n');
  console.log(`Model: ${GLM_CONFIG.model}`);
  console.log(`Base URL: ${GLM_CONFIG.baseUrl}`);
  console.log(`Domains: ${DOMAINS.length}\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const startTime = Date.now();
  const results: Result[] = [];

  // Run tests sequentially to avoid rate limits
  for (const domain of DOMAINS) {
    const result = await runTest(domain);
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    provider: 'glm',
    model: GLM_CONFIG.model,
    total: results.length,
    success,
    failed,
    rate: ((success/results.length)*100).toFixed(1)+'%',
    duration: totalDuration+'ms',
    results
  };
  
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-report-glm.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n🌟 GLM DOGFOOD COMPLETE');
  console.log(`⏱️  ${(totalDuration/1000).toFixed(1)}s | ✅ ${success} passed | ❌ ${failed} failed | 📈 ${((success/results.length)*100).toFixed(1)}%`);
  
  // List output files
  console.log('\n📁 Output files:');
  for (const domain of DOMAINS) {
    const filePath = path.join(PROJECT_ROOT, `landing-live/glm-${domain.name}-glm-5.1.html`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   landing-live/glm-${domain.name}-glm-5.1.html (${(stats.size/1024).toFixed(1)}KB)`);
    }
  }
}

main().catch(console.error);
