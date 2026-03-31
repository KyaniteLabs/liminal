#!/usr/bin/env tsx
/**
 * Agent B Dogfood Test Runner - Batched Edition
 * Runs 54 tests (9 domains × 6 local models) in batches
 */

import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';

// Handle unhandled promise rejections from the Liminal library
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error);
});

// Domain complexity rating affects timeout
const DOMAINS = [
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape', complexity: 'low' },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', complexity: 'low' },
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement', complexity: 'medium' },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums', complexity: 'medium' },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', complexity: 'medium' },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb', complexity: 'medium' },
  { name: 'remotion', prompt: 'Create a typing text animation video component', complexity: 'medium' },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', complexity: 'high' },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', complexity: 'high' },
];

// Models with their speed classification
const MODELS = [
  { name: 'granite4:1b', tag: 'granite-1b', speed: 'fast', timeout: 60000 },
  { name: 'granite4:350m', tag: 'granite-350m', speed: 'fast', timeout: 60000 },
  { name: 'qwen3.5:2b', tag: 'qwen35', speed: 'medium', timeout: 120000 },
  { name: 'phi4-mini:latest', tag: 'phi4', speed: 'medium', timeout: 120000 },
  { name: 'gemma3:4b', tag: 'gemma', speed: 'medium', timeout: 120000 },
  { name: 'lfm2.5-thinking:1.2b', tag: 'lfm', speed: 'slow', timeout: 180000 },
];

// Timeout multipliers for domain complexity
const COMPLEXITY_MULTIPLIER: Record<string, number> = {
  'low': 1.0,
  'medium': 1.5,
  'high': 2.5,
};

const RESULTS: Array<{
  domain: string;
  model: string;
  status: '✅' | '❌' | '⏱️';
  duration: number;
  score: number;
  size: number;
  error?: string;
  wasSlow?: boolean;
}> = [];

const LOG_FILE = './dogfood-telemetry-agent-b.log';
function log(line: string) {
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function runTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]) {
  const startTime = Date.now();
  const outputPath = `./landing-live/${domain.name}-${model.tag}.html`;
  
  const baseTimeout = model.timeout;
  const multiplier = COMPLEXITY_MULTIPLIER[domain.complexity];
  const timeoutMs = Math.floor(baseTimeout * multiplier);
  
  console.log(`  Timeout: ${(timeoutMs/1000).toFixed(0)}s (${model.speed} × ${domain.complexity})`);
  
  process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
  process.env.LIMINAL_LLM_MODEL = model.name;
  delete process.env.LIMINAL_LLM_API_KEY;
  
  try {
    const result = await Promise.race([
      run(domain.prompt, {
        maxIterations: 3,
        output: outputPath,
        project: `dogfood-${domain.name}-${model.tag}`,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
    
    const duration = Date.now() - startTime;
    const score = (result as any)?.qualityScore || 0;
    
    let size = 0;
    try {
      const stat = fs.statSync(outputPath);
      size = stat.isFile() ? stat.size : 0;
    } catch {}
    
    RESULTS.push({ 
      domain: domain.name, 
      model: model.tag, 
      status: '✅', 
      duration, 
      score, 
      size 
    });
    log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ✅ | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b`);
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const wasTimeout = errorMsg.includes('Timeout');
    
    // Check if partial output exists
    let size = 0;
    try {
      const stat = fs.statSync(outputPath);
      size = stat.isFile() ? stat.size : 0;
    } catch {}
    
    if (wasTimeout && size > 500) {
      // Slow but produced output
      RESULTS.push({ 
        domain: domain.name, 
        model: model.tag, 
        status: '⏱️', 
        duration, 
        score: 0.5, 
        size,
        wasSlow: true
      });
      log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ⏱️ | Duration: ${duration}ms | Score: 0.50 | Size: ${size}b | Note: Slow but produced output`);
    } else {
      RESULTS.push({ 
        domain: domain.name, 
        model: model.tag, 
        status: '❌', 
        duration, 
        score: 0, 
        size, 
        error: errorMsg 
      });
      log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ❌ | Duration: ${duration}ms | Score: 0.00 | Error: ${errorMsg}`);
    }
  }
}

async function main() {
  console.log('\n🎨 Agent B - Dogfood Test Runner (Batched)');
  console.log('============================================\n');
  console.log(`Tests: ${DOMAINS.length} domains × ${MODELS.length} models = ${DOMAINS.length * MODELS.length} tests`);
  console.log('⚠️  Cloud model (kimi-k2.5) skipped - no API key');
  console.log('Output: ./landing-live/');
  console.log('Log: ./dogfood-telemetry-agent-b.log\n');
  
  // Clear old log
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }
  
  let testNum = 0;
  const totalTests = DOMAINS.length * MODELS.length;
  
  for (const domain of DOMAINS) {
    console.log(`\n📦 Domain: ${domain.name} (${domain.complexity})`);
    
    for (const model of MODELS) {
      testNum++;
      console.log(`\n[${testNum}/${totalTests}] ${domain.name} × ${model.tag}`);
      
      await runTest(domain, model);
      
      // Save intermediate results
      fs.writeFileSync('./dogfood-results-agent-b.json', JSON.stringify(RESULTS, null, 2));
      
      // Cool down between tests
      if (testNum < totalTests) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    // Print domain summary
    const domainResults = RESULTS.filter(r => r.domain === domain.name);
    const passed = domainResults.filter(r => r.status === '✅').length;
    const slow = domainResults.filter(r => r.status === '⏱️').length;
    const failed = domainResults.filter(r => r.status === '❌').length;
    console.log(`  Domain ${domain.name} complete: ✅${passed} ⏱️${slow} ❌${failed}`);
  }
  
  // Print final summary
  console.log('\n\n================================================');
  console.log('📊 FINAL SUMMARY');
  console.log('================================================\n');
  
  const passed = RESULTS.filter(r => r.status === '✅').length;
  const slow = RESULTS.filter(r => r.status === '⏱️').length;
  const failed = RESULTS.filter(r => r.status === '❌').length;
  
  console.log(`Total: ${RESULTS.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⏱️  Slow: ${slow}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${(((passed + slow) / RESULTS.length) * 100).toFixed(1)}%\n`);
  
  // Results by model
  console.log('📊 Results by Model:');
  for (const model of MODELS) {
    const modelResults = RESULTS.filter(r => r.model === model.tag);
    const mPassed = modelResults.filter(r => r.status === '✅').length;
    const mSlow = modelResults.filter(r => r.status === '⏱️').length;
    const mFailed = modelResults.filter(r => r.status === '❌').length;
    console.log(`  ${model.tag}: ✅${mPassed} ⏱️${mSlow} ❌${mFailed}`);
  }
  
  // Results by domain
  console.log('\n📊 Results by Domain:');
  for (const domain of DOMAINS) {
    const domainResults = RESULTS.filter(r => r.domain === domain.name);
    const dPassed = domainResults.filter(r => r.status === '✅').length;
    const dSlow = domainResults.filter(r => r.status === '⏱️').length;
    const dFailed = domainResults.filter(r => r.status === '❌').length;
    console.log(`  ${domain.name}: ✅${dPassed} ⏱️${dSlow} ❌${dFailed}`);
  }
  
  console.log('\n✨ Done! Check dogfood-telemetry-agent-b.log for details.');
  console.log('📄 Results saved to dogfood-results-agent-b.json\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
