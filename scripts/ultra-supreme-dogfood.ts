#!/usr/bin/env node
/**
 * 🔥 ULTRA SUPREME DOGFOOD TESTING 🔥
 * 
 * Runs ALL models - LM Studio (local) + Ollama (local) + Cloud providers
 * All 9 domains × ALL available models
 * Parallel execution with comprehensive reporting
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
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ============ CONFIGURATION ============
const CONCURRENCY = 3; // Run 3 tests in parallel
const TIMEOUT_MS = 120000; // 2 minutes per test

// ============ DOMAINS ============
const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement', Generator: P5GeneratorV2, icon: '🎨' },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', Generator: ShaderGenerator, icon: '✨' },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', Generator: ThreeGenerator, icon: '🧊' },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums', Generator: StrudelGenerator, icon: '🎵' },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', Generator: HydraGenerator, icon: '📺' },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb', Generator: ToneGenerator, icon: '🎹' },
  { name: 'revideo', prompt: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle', Generator: RemotionGenerator, icon: '🎬' },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', Generator: HTMLWebGenerator, icon: '🌐' },
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape', Generator: ASCIIArtGenerator, icon: '🏔️' },
];

// ============ MODEL PROVIDERS ============
interface ModelConfig {
  name: string;
  provider: 'lmstudio' | 'ollama' | 'minimax' | 'openrouter';
  baseUrl: string;
  model: string;
  apiKey?: string;
  available: boolean;
}

async function detectLMStudioModels(): Promise<ModelConfig[]> {
  try {
    const res = await fetch('http://localhost:1234/v1/models');
    const data = await res.json();
    return data.data.map((m: { id: string }) => ({
      name: `lmstudio-${m.id.replace(/[/:]/g, '-')}`,
      provider: 'lmstudio' as const,
      baseUrl: 'http://localhost:1234/v1',
      model: m.id,
      available: true,
    }));
  } catch {
    console.log('⚠️  LM Studio not available');
    return [];
  }
}

async function detectOllamaModels(): Promise<ModelConfig[]> {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    const data = await res.json();
    return data.models.map((m: { name: string }) => ({
      name: `ollama-${m.name.replace(/:/g, '-')}`,
      provider: 'ollama' as const,
      baseUrl: 'http://localhost:11434/v1',
      model: m.name,
      available: true,
    }));
  } catch {
    console.log('⚠️  Ollama not available');
    return [];
  }
}

function getCloudModels(): ModelConfig[] {
  const models: ModelConfig[] = [];
  
  // MiniMax
  if (process.env.MINIMAX_API_KEY) {
    models.push(
      { name: 'minimax-m27', provider: 'minimax', baseUrl: 'https://api.minimax.chat/v1', model: 'MiniMax-M2.7', apiKey: process.env.MINIMAX_API_KEY, available: true },
      { name: 'minimax-m25', provider: 'minimax', baseUrl: 'https://api.minimax.chat/v1', model: 'MiniMax-M2.5', apiKey: process.env.MINIMAX_API_KEY, available: true },
    );
  }
  
  // OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    models.push(
      { name: 'openrouter-claude', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-sonnet', apiKey: process.env.OPENROUTER_API_KEY, available: true },
      { name: 'openrouter-gpt4', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o', apiKey: process.env.OPENROUTER_API_KEY, available: true },
    );
  }
  
  return models;
}

// ============ RESULTS ============
interface DogfoodResult {
  domain: string;
  model: string;
  provider: string;
  success: boolean;
  code: string;
  outputPath: string;
  error?: string;
  duration: number;
  timestamp: string;
}

const RESULTS: DogfoodResult[] = [];
let completed = 0;
let failed = 0;

// ============ TEST EXECUTION ============
async function runSingleTest(domain: typeof DOMAINS[0], model: ModelConfig): Promise<DogfoodResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const outputFile = `${domain.name}-${model.name}.html`;
  const outputPath = `landing-live/${outputFile}`;
  const fullOutputPath = path.join(PROJECT_ROOT, outputPath);

  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: model.baseUrl,
      model: model.model,
      apiKey: model.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
      timeout: TIMEOUT_MS,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - startTime;

    // Wrap in HTML if not already
    let output = code;
    if (!code.includes('<!DOCTYPE html>') && !code.includes('<html')) {
      output = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${domain.icon} ${domain.name} - ${model.name}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px;
      background: #0a0a0a;
      color: #e0e0e0;
    }
    header { 
      border-bottom: 2px solid #333; 
      padding-bottom: 15px; 
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 10px 0; color: #fff; }
    .meta { 
      display: flex; 
      gap: 20px; 
      flex-wrap: wrap;
      color: #888;
      font-size: 14px;
    }
    .badge { 
      background: #2a2a2a; 
      padding: 4px 12px; 
      border-radius: 4px;
      border: 1px solid #444;
    }
    pre { 
      background: #1a1a1a; 
      padding: 20px; 
      border-radius: 8px; 
      overflow-x: auto;
      border: 1px solid #333;
      font-size: 13px;
      line-height: 1.5;
    }
    code { font-family: 'SF Mono', Monaco, monospace; color: #e0e0e0; }
    .success { color: #4ade80; }
    footer { 
      margin-top: 30px; 
      padding-top: 20px;
      border-top: 1px solid #333;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <h1>${domain.icon} ${domain.name.toUpperCase()} Generated Code</h1>
    <div class="meta">
      <span class="badge">🤖 ${model.name}</span>
      <span class="badge">📦 ${model.provider}</span>
      <span class="badge">⏱️ ${duration}ms</span>
      <span class="badge success">✅ SUCCESS</span>
    </div>
  </header>
  <main>
    <p><strong>Prompt:</strong> ${domain.prompt}</p>
    <pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
  </main>
  <footer>
    Generated by Ultra Supreme Dogfood Testing | ${timestamp}
  </footer>
</body>
</html>`;
    }

    fs.writeFileSync(fullOutputPath, output);
    completed++;

    return {
      domain: domain.name,
      model: model.name,
      provider: model.provider,
      success: true,
      code,
      outputPath,
      duration,
      timestamp,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    failed++;

    const errorOutput = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${domain.icon} ${domain.name} - ${model.name} - ERROR</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #ef4444; }
    .error { background: #1a1a1a; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; }
    pre { background: #111; padding: 15px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>❌ Generation Failed</h1>
  <div class="error">
    <p><strong>Domain:</strong> ${domain.name}</p>
    <p><strong>Model:</strong> ${model.name}</p>
    <p><strong>Provider:</strong> ${model.provider}</p>
    <p><strong>Duration:</strong> ${duration}ms</p>
    <pre>${errorMsg}</pre>
  </div>
</body>
</html>`;
    fs.writeFileSync(fullOutputPath, errorOutput);

    return {
      domain: domain.name,
      model: model.name,
      provider: model.provider,
      success: false,
      code: '',
      outputPath,
      error: errorMsg,
      duration,
      timestamp,
    };
  }
}

async function runBatch(tests: Array<{ domain: typeof DOMAINS[0]; model: ModelConfig }>): Promise<DogfoodResult[]> {
  const results: DogfoodResult[] = [];
  
  // Process in batches
  for (let i = 0; i < tests.length; i += CONCURRENCY) {
    const batch = tests.slice(i, i + CONCURRENCY);
    const batchPromises = batch.map(({ domain, model }) => runSingleTest(domain, model));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Progress update
    const progress = Math.min(i + CONCURRENCY, tests.length);
    console.log(`📊 Progress: ${progress}/${tests.length} (${completed} ✅, ${failed} ❌)`);
  }
  
  return results;
}

// ============ REPORTING ============
function generateReport(results: DogfoodResult[]) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      avgDuration: Math.round(results.reduce((a, r) => a + r.duration, 0) / results.length),
    },
    byDomain: {} as Record<string, { total: number; success: number; failed: number }>,
    byProvider: {} as Record<string, { total: number; success: number; failed: number }>,
    byModel: {} as Record<string, { total: number; success: number; failed: number }>,
    results,
  };

  // By domain
  for (const domain of DOMAINS) {
    const domainResults = results.filter(r => r.domain === domain.name);
    report.byDomain[domain.name] = {
      total: domainResults.length,
      success: domainResults.filter(r => r.success).length,
      failed: domainResults.filter(r => !r.success).length,
    };
  }

  // By provider
  const providers = [...new Set(results.map(r => r.provider))];
  for (const provider of providers) {
    const providerResults = results.filter(r => r.provider === provider);
    report.byProvider[provider] = {
      total: providerResults.length,
      success: providerResults.filter(r => r.success).length,
      failed: providerResults.filter(r => !r.success).length,
    };
  }

  // By model
  const models = [...new Set(results.map(r => r.model))];
  for (const model of models) {
    const modelResults = results.filter(r => r.model === model);
    report.byModel[model] = {
      total: modelResults.length,
      success: modelResults.filter(r => r.success).length,
      failed: modelResults.filter(r => !r.success).length,
    };
  }

  return report;
}

function generateMarkdownReport(report: ReturnType<typeof generateReport>): string {
  let md = `# 🔥 Ultra Supreme Dogfood Report

Generated: ${report.timestamp}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${report.summary.total} |
| ✅ Success | ${report.summary.success} |
| ❌ Failed | ${report.summary.failed} |
| Success Rate | ${((report.summary.success / report.summary.total) * 100).toFixed(1)}% |
| Avg Duration | ${report.summary.avgDuration}ms |

## 📈 By Domain

| Domain | Total | ✅ Success | ❌ Failed | Rate |
|--------|-------|------------|-----------|------|
`;

  for (const [domain, stats] of Object.entries(report.byDomain)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    md += `| ${domain} | ${stats.total} | ${stats.success} | ${stats.failed} | ${rate}% |\n`;
  }

  md += `
## 📈 By Provider

| Provider | Total | ✅ Success | ❌ Failed | Rate |
|----------|-------|------------|-----------|------|
`;

  for (const [provider, stats] of Object.entries(report.byProvider)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    md += `| ${provider} | ${stats.total} | ${stats.success} | ${stats.failed} | ${rate}% |\n`;
  }

  md += `
## 📈 By Model

| Model | Total | ✅ Success | ❌ Failed | Rate |
|-------|-------|------------|-----------|------|
`;

  for (const [model, stats] of Object.entries(report.byModel)) {
    const rate = ((stats.success / stats.total) * 100).toFixed(1);
    md += `| ${model} | ${stats.total} | ${stats.success} | ${stats.failed} | ${rate}% |\n`;
  }

  md += `
## 📝 All Results

| Domain | Model | Provider | Status | Duration | File |
|--------|-------|----------|--------|----------|------|
`;

  for (const r of report.results) {
    const status = r.success ? '✅' : '❌';
    md += `| ${r.domain} | ${r.model} | ${r.provider} | ${status} | ${r.duration}ms | [${r.outputPath}](${r.outputPath}) |\n`;
  }

  return md;
}

// ============ MAIN ============
async function main() {
  console.log('🔥🔥🔥 ULTRA SUPREME DOGFOOD TESTING 🔥🔥🔥\n');
  console.log('Detecting available models...\n');

  // Detect all models
  const [lmStudioModels, ollamaModels, cloudModels] = await Promise.all([
    detectLMStudioModels(),
    detectOllamaModels(),
    Promise.resolve(getCloudModels()),
  ]);

  const allModels = [...lmStudioModels, ...ollamaModels, ...cloudModels];

  console.log('📦 Detected Models:');
  console.log(`  LM Studio: ${lmStudioModels.length} models`);
  for (const m of lmStudioModels) console.log(`    - ${m.name}`);
  console.log(`  Ollama: ${ollamaModels.length} models`);
  for (const m of ollamaModels) console.log(`    - ${m.name}`);
  console.log(`  Cloud: ${cloudModels.length} models`);
  for (const m of cloudModels) console.log(`    - ${m.name}`);

  const totalTests = DOMAINS.length * allModels.length;
  console.log(`\n📊 Total tests to run: ${DOMAINS.length} domains × ${allModels.length} models = ${totalTests}`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel tests`);
  console.log(`⏱️  Timeout: ${TIMEOUT_MS}ms per test`);
  console.log('');

  if (allModels.length === 0) {
    console.error('❌ No models available! Start LM Studio or Ollama first.');
    process.exit(1);
  }

  // Prepare output directory
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) {
    fs.mkdirSync(landingDir, { recursive: true });
  }

  // Build test queue
  const tests: Array<{ domain: typeof DOMAINS[0]; model: ModelConfig }> = [];
  for (const domain of DOMAINS) {
    for (const model of allModels) {
      tests.push({ domain, model });
    }
  }

  const startTime = Date.now();
  
  // Run all tests
  const results = await runBatch(tests);
  
  const totalDuration = Date.now() - startTime;

  // Generate reports
  const report = generateReport(results);
  const reportPath = path.join(PROJECT_ROOT, 'dogfood-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const mdReport = generateMarkdownReport(report);
  const mdPath = path.join(PROJECT_ROOT, 'dogfood-report.md');
  fs.writeFileSync(mdPath, mdReport);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🔥 ULTRA SUPREME DOGFOOD TESTING COMPLETE 🔥');
  console.log('='.repeat(60));
  console.log(`⏱️  Total duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`📊 Total tests: ${report.summary.total}`);
  console.log(`✅ Success: ${report.summary.success}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`📈 Success rate: ${((report.summary.success / report.summary.total) * 100).toFixed(1)}%`);
  console.log(`⚡ Avg duration: ${report.summary.avgDuration}ms`);
  console.log('');
  console.log(`📁 Reports saved:`);
  console.log(`  - ${reportPath}`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${landingDir}/ ( ${results.length} HTML files )`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
