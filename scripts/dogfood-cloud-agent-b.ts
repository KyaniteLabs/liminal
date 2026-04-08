#!/usr/bin/env node
/**
 * ☁️ AGENT B - CLOUD PROVIDERS DOGFOOD
 * Providers: MiniMax, OpenRouter (if available)
 * Domains: hydra, tone, remotion, html, ascii
 */

import { LLMClient } from '../dist/llm/LLMClient.js';
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

// Agent B assigned domains only
const DOMAINS = [
  { name: 'hydra', prompt: 'Create a kaleidoscope effect with rotating geometric patterns', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create ambient drone with slowly evolving pads', Generator: ToneGenerator },
  { name: 'remotion', prompt: 'Create typing animation with cursor blink', Generator: RemotionGenerator },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', Generator: HTMLWebGenerator },
  { name: 'ascii', prompt: 'Create mountain landscape ASCII art', Generator: ASCIIArtGenerator },
];

// Cloud providers configuration
const CLOUD_MODELS: Array<{name: string, provider: string, baseUrl: string, model: string, apiKey: string}> = [
  ...(process.env.MINIMAX_API_KEY ? [
    { name: 'minimax-m27', provider: 'MiniMax', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.7', apiKey: process.env.MINIMAX_API_KEY },
    { name: 'minimax-m25', provider: 'MiniMax', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.5', apiKey: process.env.MINIMAX_API_KEY },
  ] : []),
  ...(process.env.OPENROUTER_API_KEY ? [
    { name: 'openrouter-claude', provider: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet', apiKey: process.env.OPENROUTER_API_KEY },
    { name: 'openrouter-gpt4o', provider: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', apiKey: process.env.OPENROUTER_API_KEY },
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

async function runTest(domain: typeof DOMAINS[0], model: typeof CLOUD_MODELS[0]): Promise<Result> {
  const start = Date.now();
  const outputPath = `dogfood-temp/cloud-b-${domain.name}-${model.name}.html`;
  
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
    const outputDir = path.join(PROJECT_ROOT, 'dogfood-temp');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    
    console.log(`  ✅ ${model.provider} | ${model.name} | ${domain.name} (${duration}ms)`);
    
    return { 
      provider: model.provider, 
      model: model.name, 
      domain: domain.name, 
      success: true, 
      duration,
      notes: 'Generated successfully'
    };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${model.provider} | ${model.name} | ${domain.name} (${duration}ms): ${errorMsg.slice(0, 80)}`);
    return { 
      provider: model.provider, 
      model: model.name, 
      domain: domain.name, 
      success: false, 
      duration, 
      error: errorMsg,
      notes: errorMsg.slice(0, 100)
    };
  }
}

async function main() {
  console.log('☁️ AGENT B - CLOUD PROVIDERS DOGFOOD\n');
  console.log('Domains: hydra, tone, remotion, html, ascii\n');
  
  if (CLOUD_MODELS.length === 0) {
    console.log('⚠️ No cloud API keys found. Set MINIMAX_API_KEY or OPENROUTER_API_KEY');
    process.exit(0);
  }

  console.log(`Providers: ${CLOUD_MODELS.map(m => `${m.provider}(${m.name})`).join(', ')}`);
  console.log(`Tests: ${DOMAINS.length} domains × ${CLOUD_MODELS.length} models = ${DOMAINS.length * CLOUD_MODELS.length}\n`);

  // Run all tests in parallel
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

  const report = {
    timestamp: new Date().toISOString(),
    agent: 'B',
    domains: DOMAINS.map(d => d.name),
    providers: [...new Set(CLOUD_MODELS.map(m => m.provider))],
    total: results.length,
    success,
    failed,
    rate: ((success/results.length)*100).toFixed(1)+'%',
    duration: totalDuration+'ms',
    results
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-results-cloud-b.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n☁️ AGENT B - CLOUD COMPLETE');
  console.log(`⏱️ ${(totalDuration/1000).toFixed(1)}s | ✅ ${success} | ❌ ${failed} | 📈 ${((success/results.length)*100).toFixed(1)}%`);
  console.log(`\n📄 Report saved to: dogfood-results-cloud-b.json`);
  
  // Print summary table
  console.log('\n📊 SUMMARY TABLE:');
  console.log('─'.repeat(90));
  console.log(`${'Provider'.padEnd(12)} | ${'Model'.padEnd(18)} | ${'Domain'.padEnd(10)} | ${'Success'.padEnd(8)} | Notes`);
  console.log('─'.repeat(90));
  for (const r of results) {
    const status = r.success ? '✅ Yes' : '❌ No';
    const notes = r.notes?.slice(0, 35) || '';
    console.log(`${r.provider.padEnd(12)} | ${r.model.padEnd(18)} | ${r.domain.padEnd(10)} | ${status.padEnd(8)} | ${notes}`);
  }
  console.log('─'.repeat(90));
}

main().catch(console.error);
