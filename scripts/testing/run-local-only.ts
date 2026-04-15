#!/usr/bin/env tsx
/**
 * Agent B Dogfood Test Runner - Local Models Only (6 models)
 */

import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Domain complexity rating affects timeout
const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement', complexity: 'medium' },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', complexity: 'high' },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', complexity: 'high' },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums', complexity: 'medium' },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', complexity: 'medium' },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb', complexity: 'medium' },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', complexity: 'low' },
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape', complexity: 'low' },
  { name: 'revideo', prompt: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle', complexity: 'medium' },
];

// LOCAL MODELS ONLY (excluding kimi-k2.5:cloud)
const MODELS = [
  { name: 'granite4:1b', tag: 'granite-1b', speed: 'fast', timeout: 60000 },
  { name: 'granite4:350m', tag: 'granite-350m', speed: 'fast', timeout: 60000 },
  { name: 'qwen3.5:2b', tag: 'qwen35', speed: 'medium', timeout: 120000 },
  { name: 'phi4-mini:latest', tag: 'phi4', speed: 'medium', timeout: 120000 },
  { name: 'gemma3:4b', tag: 'gemma', speed: 'medium', timeout: 120000 },
  { name: 'lfm2.5-thinking:1.2b', tag: 'lfm', speed: 'slow', timeout: 180000 },
];

const COMPLEXITY_MULTIPLIER: Record<string, number> = {
  'low': 1.0,
  'medium': 1.5,
  'high': 2.5,
};

const RESULTS: Array<any> = [];

function log(line: string) {
  console.log(line);
  fs.appendFileSync('./dogfood-telemetry.log', line + '\n');
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, description: string): Promise<{ result?: T; timedOut: boolean; duration: number }> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const duration = Date.now() - startTime;
      console.log(`  ⏱️  ${description} hit timeout after ${(duration/1000).toFixed(1)}s`);
      resolve({ timedOut: true, duration });
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        resolve({ result, timedOut: false, duration });
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function runTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]) {
  const startTime = Date.now();
  const outputPath = path.join(PROJECT_ROOT, `./landing-live/${domain.name}-${model.tag}.html`);
  const timeoutMs = Math.floor(model.timeout * COMPLEXITY_MULTIPLIER[domain.complexity]);
  
  console.log(`  Timeout: ${(timeoutMs/1000).toFixed(0)}s (${model.speed} model × ${domain.complexity} domain)`);
  
  process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
  process.env.LIMINAL_LLM_MODEL = model.name;
  
  try {
    const { result, timedOut, duration } = await runWithTimeout(
      () => run(domain.prompt, { maxIterations: 1, output: outputPath, project: `dogfood-${domain.name}-${model.tag}` }),
      timeoutMs,
      `${domain.name} × ${model.tag}`
    );
    
    if (timedOut) {
      let size = 0;
      let partialOutput = false;
      try {
        size = fs.statSync(outputPath).size;
        partialOutput = size > 500;
      } catch {}
      
      if (partialOutput) {
        RESULTS.push({ domain: domain.name, model: model.tag, status: '⏱️', duration, score: 0.5, size, wasSlow: true });
        log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ⏱️ | Duration: ${duration}ms | Score: 0.50 | Size: ${size}b | Note: Slow but produced output`);
      } else {
        RESULTS.push({ domain: domain.name, model: model.tag, status: '❌', duration, score: 0, size: 0, error: 'Timeout - no output' });
        log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ❌ | Duration: ${duration}ms | Score: 0.00 | Error: Timeout`);
      }
      return;
    }
    
    const score = (result as any)?.evaluation?.score || (result as any)?.qualityScore || 0;
    
    let size = 0;
    try {
      size = fs.statSync(outputPath).size;
    } catch {}
    
    RESULTS.push({ domain: domain.name, model: model.tag, status: '✅', duration, score, size });
    log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ✅ | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    RESULTS.push({ domain: domain.name, model: model.tag, status: '❌', duration, score: 0, size: 0, error: errorMsg });
    log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ❌ | Duration: ${duration}ms | Score: 0.00 | Error: ${errorMsg}`);
  }
}

async function main() {
  console.log('\n🎨 Agent B - Dogfood Test Runner (Local Models Only)');
  console.log('=====================================================\n');
  console.log(`Tests: ${DOMAINS.length} domains × ${MODELS.length} models = ${DOMAINS.length * MODELS.length} tests`);
  console.log('Output: ./landing-live/');
  console.log('Log: ./dogfood-telemetry.log\n');
  
  if (fs.existsSync('./dogfood-telemetry.log')) {
    fs.unlinkSync('./dogfood-telemetry.log');
  }
  
  let testNum = 0;
  const totalTests = DOMAINS.length * MODELS.length;
  
  for (const domain of DOMAINS) {
    console.log(`\n📦 Domain: ${domain.name} (${domain.complexity} complexity)`);
    for (const model of MODELS) {
      testNum++;
      console.log(`\n[${testNum}/${totalTests}] ${domain.name} × ${model.tag} (${model.speed})`);
      await runTest(domain, model);
      if (testNum < totalTests) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  
  console.log('\n\n================================================');
  console.log('📊 SUMMARY');
  console.log('================================================\n');
  
  const passed = RESULTS.filter(r => r.status === '✅').length;
  const slow = RESULTS.filter(r => r.status === '⏱️').length;
  const failed = RESULTS.filter(r => r.status === '❌').length;
  
  console.log(`Total: ${RESULTS.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⏱️  Slow: ${slow}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nSuccess Rate: ${(((passed + slow) / RESULTS.length) * 100).toFixed(1)}%\n`);
  
  console.log('🏆 Best Results per Domain:');
  for (const domain of DOMAINS) {
    const domainResults = RESULTS.filter(r => r.domain === domain.name && (r.status === '✅' || r.status === '⏱️'));
    if (domainResults.length > 0) {
      const best = domainResults.reduce((a, b) => a.score > b.score ? a : b);
      const slowBadge = best.wasSlow ? ' [SLOW]' : '';
      console.log(`  ${domain.name}: ${best.model} (score: ${best.score.toFixed(2)})${slowBadge}`);
    } else {
      console.log(`  ${domain.name}: ❌ All failed`);
    }
  }
  
  if (slow > 0) {
    console.log('\n🐌 Slow Models:');
    RESULTS.filter(r => r.status === '⏱️').forEach(t => {
      console.log(`  - ${t.domain} × ${t.model}: ${(t.duration/1000).toFixed(1)}s, ${t.size}b`);
    });
  }
  
  fs.writeFileSync('./dogfood-results.json', JSON.stringify(RESULTS, null, 2));
  console.log('\n📄 Results saved to dogfood-results.json\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
