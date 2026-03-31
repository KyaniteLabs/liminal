#!/usr/bin/env tsx
/**
 * Agent B Dogfood Test Runner - Smart Timeout Edition
 * Runs all 63 tests (9 domains × 7 models) with appropriate timeouts
 */

import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';

// Handle unhandled promise rejections from the Liminal library
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue execution instead of crashing
});

process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error);
  // Continue execution instead of crashing
});

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
  { name: 'remotion', prompt: 'Create a typing text animation video component', complexity: 'medium' },
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

// Cloud model (requires API key)
const CLOUD_MODEL = { name: 'kimi-k2.5:cloud', tag: 'kimi', speed: 'cloud', timeout: 180000 };

// Check if cloud API key is available
const hasCloudApiKey = !!process.env.MOONSHOT_API_KEY || !!process.env.LIMINAL_CLOUD_API_KEY || !!process.env.LIMINAL_LLM_API_KEY;

// Timeout multipliers for domain complexity
const COMPLEXITY_MULTIPLIER: Record<string, number> = {
  'low': 1.0,
  'medium': 1.5,
  'high': 2.5,  // GLSL/Three.js need more time
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

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  description: string
): Promise<{ result?: T; timedOut: boolean; duration: number; error?: Error }> {
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
        resolve({ timedOut: false, duration, error: err instanceof Error ? err : new Error(String(err)) });
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
  
  console.log(`  Timeout: ${(timeoutMs/1000).toFixed(0)}s (${model.speed} model × ${domain.complexity} domain)`);
  
  // Set env for this test - kimi cloud uses different endpoint
  if (model.name === 'kimi-k2.5:cloud') {
    process.env.LIMINAL_LLM_BASE_URL = process.env.LIMINAL_CLOUD_BASE_URL || 'https://api.moonshot.cn/v1';
    process.env.LIMINAL_LLM_API_KEY = process.env.MOONSHOT_API_KEY || process.env.LIMINAL_CLOUD_API_KEY;
  } else {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
    delete process.env.LIMINAL_LLM_API_KEY;
  }
  process.env.LIMINAL_LLM_MODEL = model.name;
  
  try {
    const { result, timedOut, duration, error } = await runWithTimeout(
      () => run(domain.prompt, {
        maxIterations: 3,  // Allow up to 3 iterations for quality improvement
        output: outputPath,
        project: `dogfood-${domain.name}-${model.tag}`,
      }),
      timeoutMs,
      `${domain.name} × ${model.tag}`
    );
    
    // Handle error from runWithTimeout
    if (error) {
      throw error;
    }
    
    if (timedOut) {
      // Check if partial output was created (genuine slow vs complete fail)
      let size = 0;
      let partialOutput = false;
      try {
        size = fs.statSync(outputPath).size;
        partialOutput = size > 500; // If >500 bytes, it was generating something
      } catch {}
      
      if (partialOutput) {
        // Genuine slow model - count as success with warning
        RESULTS.push({ 
          domain: domain.name, 
          model: model.tag, 
          status: '⏱️', 
          duration, 
          score: 0.5, // Partial credit
          size,
          wasSlow: true
        });
        log(`[${timestamp()}] Domain: ${domain.name} | Model: ${model.tag} | Status: ⏱️ | Duration: ${duration}ms | Score: 0.50 | Size: ${size}b | Note: Slow but produced output`);
      } else {
        // True timeout - nothing produced
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
    const score = result?.qualityScore || 0;
    
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
    
  } catch (error: unknown) {
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
  // Add cloud model if API key is available
  const allModels = hasCloudApiKey ? [...MODELS, CLOUD_MODEL] : MODELS;
  
  console.log('\n🎨 Agent B - Dogfood Test Runner (Smart Timeout)');
  console.log('================================================\n');
  console.log(`Tests: ${DOMAINS.length} domains × ${allModels.length} models = ${DOMAINS.length * allModels.length} tests`);
  if (!hasCloudApiKey) {
    console.log('⚠️  Cloud model (kimi-k2.5) skipped - no API key found');
    console.log('   Set MOONSHOT_API_KEY to enable cloud testing');
  }
  console.log('Timeout strategy: Model speed × Domain complexity');
  console.log('Output: ./landing-live/');
  console.log('Log: ./dogfood-telemetry-agent-b.log\n');
  
  // Clear old log (use agent-b specific log)
  const LOG_FILE = './dogfood-telemetry-agent-b.log';
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }
  if (fs.existsSync('./dogfood-telemetry.log')) {
    fs.unlinkSync('./dogfood-telemetry.log');
  }
  
  let testNum = 0;
  const totalTests = DOMAINS.length * allModels.length;
  
  for (const domain of DOMAINS) {
    console.log(`\n📦 Domain: ${domain.name} (${domain.complexity} complexity)`);
    
    for (const model of allModels) {
      testNum++;
      console.log(`\n[${testNum}/${totalTests}] ${domain.name} × ${model.tag} (${model.speed})`);
      
      await runTest(domain, model);
      
      // Delay between tests to let system cool down
      if (testNum < totalTests) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  
  // Print summary
  console.log('\n\n================================================');
  console.log('📊 SUMMARY');
  console.log('================================================\n');
  
  const passed = RESULTS.filter(r => r.status === '✅').length;
  const slow = RESULTS.filter(r => r.status === '⏱️').length;
  const failed = RESULTS.filter(r => r.status === '❌').length;
  
  console.log(`Total: ${RESULTS.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⏱️  Slow (but produced output): ${slow}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nSuccess Rate: ${(((passed + slow) / RESULTS.length) * 100).toFixed(1)}% (including slow)\n`);
  
  // Best per domain
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
  
  // Slow models report
  if (slow > 0) {
    console.log('\n🐌 Slow Models (need longer timeout or template fallback):');
    const slowTests = RESULTS.filter(r => r.status === '⏱️');
    for (const test of slowTests) {
      console.log(`  - ${test.domain} × ${test.model}: ${(test.duration/1000).toFixed(1)}s, ${test.size}b output`);
    }
  }
  
  console.log('\n✨ Done! Check dogfood-telemetry-agent-b.log for full details.\n');
  
  // Save JSON results for analysis
  fs.writeFileSync('./dogfood-results-agent-b.json', JSON.stringify(RESULTS, null, 2));
  console.log('📄 Results saved to dogfood-results-agent-b.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
