#!/usr/bin/env node
/**
 * 🌟 GLM CLOUD PROVIDER DOGFOOD
 * Tests all 9 domains with GLM-5.1 model
 */

import { LLMClient } from '../src/llm/LLMClient.js';
import { P5GeneratorV2 } from '../src/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from '../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../src/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../src/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../src/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../src/generators/tone/ToneGenerator.js';
import { RemotionGenerator } from '../src/generators/remotion/RemotionGenerator.js';
import { HTMLWebGenerator } from '../src/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../src/generators/ascii/ASCIIArtGenerator.js';
import { PROVIDER_TEMPLATES } from '../src/harness/MultiProviderConfig.js';
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

function loadGlmApiKey(): string | undefined {
  if (process.env.GLM_API_KEY) return process.env.GLM_API_KEY;

  const configPath = path.join(process.env.HOME ?? '', '.liminal', 'config.json');
  if (!fs.existsSync(configPath)) return undefined;

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      providers?: { glm?: { apiKey?: string } };
    };
    return parsed.providers?.glm?.apiKey;
  } catch {
    return undefined;
  }
}

function getGlmConfig() {
  const template = PROVIDER_TEMPLATES.glm;
  const apiKey = loadGlmApiKey();

  if (!apiKey) {
    throw new Error('GLM_API_KEY not set and no providers.glm.apiKey found in ~/.liminal/config.json');
  }

  return {
  name: 'glm-5.1',
    baseUrl: template.baseUrl,
    model: template.model,
    apiKey,
  };
}

type GlmConfig = ReturnType<typeof getGlmConfig>;

interface Result {
  domain: string;
  model: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runTest(domain: typeof DOMAINS[0], glmConfig: GlmConfig): Promise<Result> {
  const start = Date.now();
  const outputPath = `landing-live/glm-${domain.name}-glm-5.1.html`;
  
  console.log(`  🔄 Testing ${domain.name}...`);
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: glmConfig.baseUrl,
      model: glmConfig.model,
      apiKey: glmConfig.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    console.log(`  ✅ ${domain.name} (${duration}ms) → ${outputPath}`);
    
    return { domain: domain.name, model: glmConfig.name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${domain.name} (${duration}ms): ${errorMsg.slice(0, 100)}`);
    return { domain: domain.name, model: glmConfig.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  const glmConfig = getGlmConfig();

  console.log('🌟 GLM CLOUD PROVIDER DOGFOOD\n');
  console.log(`Model: ${glmConfig.model}`);
  console.log(`Base URL: ${glmConfig.baseUrl}`);
  console.log(`Domains: ${DOMAINS.length}\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const startTime = Date.now();
  const results: Result[] = [];

  // Run tests sequentially to avoid rate limits
  for (const domain of DOMAINS) {
    const result = await runTest(domain, glmConfig);
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    provider: 'glm',
    model: glmConfig.model,
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

main().catch(error => {
  console.error(error);
  process.exit(1);
});
