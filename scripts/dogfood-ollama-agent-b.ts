#!/usr/bin/env node
/**
 * 🦙 OLLAMA DOGFOOD - AGENT B (hydra, tone, revideo, html, ascii)
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

// Agent B domains: hydra, tone, revideo, html, ascii
const DOMAINS = [
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
    // Use qwen3.5:0.8b for faster testing (873M params)
    const models = data.models
      .filter((m: { name: string }) => m.name === 'qwen3.5:0.8b')
      .map((m: { name: string }) => ({
        name: m.name.replace(/:/g, '-'),
        model: m.name,
        baseUrl: 'http://localhost:11434/v1',
      }));
    
    if (models.length === 0) {
      // Fallback to any small model
      const smallModel = data.models.find((m: { name: string }) => 
        m.name.includes('0.8b') || m.name.includes('350m') || m.name.includes('1b')
      );
      if (smallModel) {
        return [{
          name: smallModel.name.replace(/:/g, '-'),
          model: smallModel.name,
          baseUrl: 'http://localhost:11434/v1',
        }];
      }
      // Last resort: use first available
      return data.models.slice(0, 1).map((m: { name: string }) => ({
        name: m.name.replace(/:/g, '-'),
        model: m.name,
        baseUrl: 'http://localhost:11434/v1',
      }));
    }
    return models;
  } catch {
    console.error('❌ Ollama not available at localhost:11434');
    process.exit(1);
  }
}

interface Result {
  domain: string;
  model: string;
  success: boolean;
  duration: number;
  error?: string;
  outputPath?: string;
}

async function runTest(domain: typeof DOMAINS[0], model: { name: string; model: string; baseUrl: string }): Promise<Result> {
  const start = Date.now();
  const outputPath = `dogfood-output/ollama-b-${domain.name}-${model.name}.html`;
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: model.baseUrl,
      model: model.model,
      temperature: 0.7,
      maxTokens: 2048,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    console.log(`  ✅ ${domain.name} × ${model.name} (${duration}ms)`);
    
    return { domain: domain.name, model: model.name, success: true, duration, outputPath };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  ❌ ${domain.name} × ${model.name} (${duration}ms): ${errorMsg.slice(0, 80)}`);
    return { domain: domain.name, model: model.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('🦙 OLLAMA DOGFOOD - AGENT B\n');
  console.log('Domains: hydra, tone, revideo, html, ascii\n');
  
  const models = await getOllamaModels();
  console.log(`Models: ${models.map(m => m.model).join(', ')}`);
  console.log(`Tests: ${DOMAINS.length} domains × ${models.length} models = ${DOMAINS.length * models.length}\n`);

  const outputDir = path.join(PROJECT_ROOT, 'dogfood-output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const results: Result[] = [];
  const startTime = Date.now();
  
  // Run sequentially to avoid overwhelming local Ollama
  for (const domain of DOMAINS) {
    for (const model of models) {
      const result = await runTest(domain, model);
      results.push(result);
    }
  }

  const totalDuration = Date.now() - startTime;
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  const report = {
    timestamp: new Date().toISOString(),
    agent: 'B',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    total: results.length,
    success,
    failed,
    rate: ((success / results.length) * 100).toFixed(1) + '%',
    duration: totalDuration + 'ms',
    results
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-results-ollama-b.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n🦙 OLLAMA AGENT B COMPLETE');
  console.log(`⏱️ ${(totalDuration / 1000 / 60).toFixed(1)}m | ✅ ${success} | ❌ ${failed} | 📈 ${((success / results.length) * 100).toFixed(1)}%`);
  
  // Summary per domain
  console.log('\n📊 Per-Domain Summary:');
  for (const domain of DOMAINS) {
    const domainResults = results.filter(r => r.domain === domain.name);
    const domainSuccess = domainResults.filter(r => r.success).length;
    const status = domainSuccess === domainResults.length ? '✅' : '❌';
    console.log(`  ${status} ${domain.name}: ${domainSuccess}/${domainResults.length}`);
  }
}

main().catch(console.error);
