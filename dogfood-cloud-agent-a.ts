#!/usr/bin/env node
/**
 * ☁️ AGENT A - CLOUD PROVIDERS DOGFOOD
 * Providers: OpenRouter, MiniMax
 * Domains: p5, glsl, three, strudel
 */

import { LLMClient } from './dist/llm/LLMClient.js';
import { P5GeneratorV2 } from './dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from './dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from './dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from './dist/generators/strudel/StrudelGenerator.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname;

// Agent A assigned domains only
const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
];

// Check for API keys
const MINIMAX_KEY = process.env.MINIMAX_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const MODELS: Array<{provider: string, name: string, baseUrl: string, model: string, apiKey?: string}> = [
  ...(MINIMAX_KEY ? [
    { provider: 'MiniMax', name: 'minimax-m27', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.7', apiKey: MINIMAX_KEY },
    { provider: 'MiniMax', name: 'minimax-m25', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.5', apiKey: MINIMAX_KEY },
  ] : []),
  ...(OPENROUTER_KEY ? [
    { provider: 'OpenRouter', name: 'openrouter-claude', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet', apiKey: OPENROUTER_KEY },
    { provider: 'OpenRouter', name: 'openrouter-gpt4', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', apiKey: OPENROUTER_KEY },
  ] : []),
];

interface Result {
  provider: string;
  model: string;
  domain: string;
  success: boolean;
  duration: number;
  error?: string;
  notes?: string;
}

async function runTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]): Promise<Result> {
  const start = Date.now();
  const testId = `${model.provider}-${domain.name}-${model.name}`;
  
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

    // Save output
    const outputPath = path.join(PROJECT_ROOT, 'landing-live', `cloud-a-${testId}.html`);
    fs.writeFileSync(outputPath, code);
    
    console.log(`  ✅ ${testId} (${duration}ms)`);
    return { provider: model.provider, model: model.name, domain: domain.name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${testId} (${duration}ms): ${errorMsg.slice(0, 80)}`);
    return { provider: model.provider, model: model.name, domain: domain.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ☁️ AGENT A - CLOUD PROVIDERS DOGFOOD TEST             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('Configuration:');
  console.log(`  MiniMax API Key: ${MINIMAX_KEY ? '✅ Configured' : '❌ Not set'}`);
  console.log(`  OpenRouter API Key: ${OPENROUTER_KEY ? '✅ Configured' : '❌ Not set'}`);
  console.log(`  Domains: ${DOMAINS.map(d => d.name).join(', ')}\n`);
  
  if (MODELS.length === 0) {
    console.log('⚠️ No cloud API keys configured. Cannot run tests.');
    process.exit(1);
  }

  console.log(`Models to test: ${MODELS.map(m => `${m.provider}/${m.name}`).join(', ')}`);
  console.log(`Total tests: ${DOMAINS.length} domains × ${MODELS.length} models = ${DOMAINS.length * MODELS.length}\n`);

  // Ensure output directory exists
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  // Run tests sequentially for stability
  const results: Result[] = [];
  for (const model of MODELS) {
    console.log(`\n🧪 Testing ${model.provider} - ${model.name}`);
    for (const domain of DOMAINS) {
      const result = await runTest(domain, model);
      results.push(result);
    }
  }

  // Calculate summary
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  // Add notes for unconfigured providers
  if (!OPENROUTER_KEY) {
    results.push({
      provider: 'OpenRouter',
      model: 'N/A',
      domain: 'N/A',
      success: false,
      duration: 0,
      notes: 'OPENROUTER_API_KEY not configured - skipped all OpenRouter tests'
    });
  }

  const report = {
    agent: 'A',
    timestamp: new Date().toISOString(),
    providers: ['MiniMax', 'OpenRouter'],
    domains: DOMAINS.map(d => d.name),
    total: results.length,
    success: successCount,
    failed: failCount,
    rate: ((successCount / (successCount + failCount)) * 100).toFixed(1) + '%',
    totalDuration: totalDuration + 'ms',
    results
  };

  // Save report
  const reportPath = path.join(PROJECT_ROOT, 'dogfood-results-cloud-a.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary table
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    RESULTS SUMMARY                         ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║ Provider   │ Model           │ Domain  │ Success │ Notes   ║');
  console.log('╠════════════╪═════════════════╪═════════╪═════════╪═════════╣');
  
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const notes = r.error ? r.error.slice(0, 25) : (r.notes || '-');
    console.log(`║ ${r.provider.padEnd(10)} │ ${r.model.padEnd(15)} │ ${r.domain.padEnd(7)} │ ${status.padEnd(7)} │ ${notes.slice(0, 25).padEnd(25)} ║`);
  }
  
  console.log('╠════════════╧═════════════════╧═════════╧═════════╧═════════╣');
  console.log(`║ Total: ${successCount + failCount} tests | ✅ ${successCount} passed | ❌ ${failCount} failed        ║`);
  console.log(`║ Success Rate: ${report.rate.padEnd(6)} | Duration: ${(totalDuration/1000).toFixed(1)}s                  ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

main().catch(console.error);
