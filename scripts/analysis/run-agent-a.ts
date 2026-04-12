#!/usr/bin/env tsx
/**
 * Agent A Dogfood Test Runner
 * Runs all 36 tests (9 domains × 4 models) for Agent A configuration
 * Models: minimax-m2.7, minimax-m2.5, lm-coder-40b, lm-qwen-9b
 */

import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';

// Domain definitions with prompts
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

// Agent A Models configuration
const MODELS = [
  { 
    name: 'minimax-m2.7', 
    tag: 'minimax-m27', 
    type: 'cloud',
    baseUrl: undefined, // Uses default cloud endpoint
    timeout: 180000 
  },
  { 
    name: 'minimax-m2.5', 
    tag: 'minimax-m25', 
    type: 'cloud',
    baseUrl: undefined, // Uses default cloud endpoint
    timeout: 180000 
  },
  { 
    name: 'lm-coder-40b', 
    tag: 'lm-coder-40b', 
    type: 'local',
    baseUrl: 'http://localhost:1234/v1', // LM Studio default
    timeout: 300000 // 40B model needs more time
  },
  { 
    name: 'lm-qwen-9b', 
    tag: 'lm-qwen-9b', 
    type: 'local',
    baseUrl: 'http://localhost:1234/v1', // LM Studio default
    timeout: 180000 
  },
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

function log(line: string) {
  console.log(line);
  fs.appendFileSync('./dogfood-telemetry-agent-a.log', line + '\n');
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  description: string
): Promise<{ result?: T; timedOut: boolean; duration: number }> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
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
        const duration = Date.now() - startTime;
        throw { error: err, duration };
      });
  });
}

async function runTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]) {
  const startTime = Date.now();
  const outputPath = `./landing-live/${domain.name}-${model.tag}.html`;
  
  // Calculate timeout based on model speed and domain complexity
  const baseTimeout = model.timeout;
  const multiplier = COMPLEXITY_MULTIPLIER[domain.complexity];
  const timeoutMs = Math.floor(baseTimeout * multiplier);
  
  console.log(`  Timeout: ${(timeoutMs/1000).toFixed(0)}s (${model.type} model × ${domain.complexity} domain)`);
  
  // Set env for this test
  if (model.baseUrl) {
    process.env.LIMINAL_LLM_BASE_URL = model.baseUrl;
  } else {
    delete process.env.LIMINAL_LLM_BASE_URL; // Use default for cloud
  }
  process.env.LIMINAL_LLM_MODEL = model.name;
  
  try {
    const { result, timedOut, duration } = await runWithTimeout(
      () => run(domain.prompt, {
        maxIterations: 3,  // Fixed harness: 3 iterations
        output: outputPath,
        project: `dogfood-${domain.name}-${model.tag}`,
      }),
      timeoutMs,
      `${domain.name} × ${model.tag}`
    );
    
    if (timedOut) {
      // Check if partial output was created
      let size = 0;
      let partialOutput = false;
      try {
        size = fs.statSync(outputPath).size;
        partialOutput = size > 500;
      } catch {}
      
      if (partialOutput) {
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
          size: 0,
          error: 'Timeout - no output'
        });
        log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ❌ | Duration: ${duration}ms | Score: 0.00 | Error: Timeout`);
      }
      return;
    }
    
    // Success
    const score = result?.finalScore || 0;
    
    let size = 0;
    try {
      size = fs.statSync(outputPath).size;
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
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    RESULTS.push({ 
      domain: domain.name, 
      model: model.tag, 
      status: '❌', 
      duration, 
      score: 0, 
      size: 0, 
      error: errorMsg 
    });
    log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ❌ | Duration: ${duration}ms | Score: 0.00 | Error: ${errorMsg}`);
  }
}

async function main() {
  console.log('\n🎨 Agent A - Dogfood Test Runner');
  console.log('=================================\n');
  console.log(`Tests: ${DOMAINS.length} domains × ${MODELS.length} models = ${DOMAINS.length * MODELS.length} tests`);
  console.log('Models: MiniMax M2.7, MiniMax M2.5, LM Studio Coder 40B, LM Studio Qwen 9B');
  console.log('Timeout strategy: Model type × Domain complexity');
  console.log('Output: ./landing-live/');
  console.log('Log: ./dogfood-telemetry-agent-a.log\n');
  
  // Clear old log
  if (fs.existsSync('./dogfood-telemetry-agent-a.log')) {
    fs.unlinkSync('./dogfood-telemetry-agent-a.log');
  }
  
  let testNum = 0;
  const totalTests = DOMAINS.length * MODELS.length;
  
  for (const domain of DOMAINS) {
    console.log(`\n📦 Domain: ${domain.name} (${domain.complexity} complexity)`);
    
    for (const model of MODELS) {
      testNum++;
      console.log(`\n[${testNum}/${totalTests}] ${domain.name} × ${model.tag} (${model.type})`);
      
      await runTest(domain, model);
      
      // Delay between tests to let system cool down
      if (testNum < totalTests) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  
  // Print summary
  console.log('\n\n================================================');
  console.log('📊 AGENT A SUMMARY');
  console.log('================================================\n');
  
  const passed = RESULTS.filter(r => r.status === '✅').length;
  const slow = RESULTS.filter(r => r.status === '⏱️').length;
  const failed = RESULTS.filter(r => r.status === '❌').length;
  
  console.log(`Total: ${RESULTS.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⏱️  Slow (but produced output): ${slow}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nSuccess Rate: ${(((passed + slow) / RESULTS.length) * 100).toFixed(1)}% (including slow)\n`);
  
  // Results per model
  console.log('📈 Results per Model:');
  for (const model of MODELS) {
    const modelResults = RESULTS.filter(r => r.model === model.tag);
    const modelPassed = modelResults.filter(r => r.status === '✅').length;
    const modelSlow = modelResults.filter(r => r.status === '⏱️').length;
    const modelFailed = modelResults.filter(r => r.status === '❌').length;
    console.log(`  ${model.tag}: ✅${modelPassed} ⏱️${modelSlow} ❌${modelFailed}`);
  }
  
  // Results per domain
  console.log('\n📈 Results per Domain:');
  for (const domain of DOMAINS) {
    const domainResults = RESULTS.filter(r => r.domain === domain.name);
    const domainPassed = domainResults.filter(r => r.status === '✅').length;
    const domainSlow = domainResults.filter(r => r.status === '⏱️').length;
    const domainFailed = domainResults.filter(r => r.status === '❌').length;
    console.log(`  ${domain.name}: ✅${domainPassed} ⏱️${domainSlow} ❌${domainFailed}`);
  }
  
  // Best per domain
  console.log('\n🏆 Best Results per Domain:');
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
  
  // Failed tests details
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    const failedTests = RESULTS.filter(r => r.status === '❌');
    for (const test of failedTests) {
      console.log(`  - ${test.domain} × ${test.model}: ${test.error || 'Unknown error'}`);
    }
  }
  
  console.log('\n✨ Done! Check dogfood-telemetry-agent-a.log for full details.\n');
  
  // Save JSON results for analysis
  fs.writeFileSync('./dogfood-results-agent-a.json', JSON.stringify(RESULTS, null, 2));
  console.log('📄 Results saved to dogfood-results-agent-a.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
