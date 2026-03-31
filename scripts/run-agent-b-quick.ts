#!/usr/bin/env tsx
/**
 * Agent B Dogfood Test Runner - Quick Verification
 * Runs 12 tests (4 domains × 3 fast models) for quick verification
 */

import { run } from '../src/index.js';
import fs from 'fs';

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error);
});

const DOMAINS = [
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape' },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action' },
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement' },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb' },
];

const MODELS = [
  { name: 'granite4:350m', tag: 'granite-350m', timeout: 90000 },
  { name: 'qwen3.5:2b', tag: 'qwen35', timeout: 120000 },
  { name: 'gemma3:4b', tag: 'gemma', timeout: 120000 },
];

const RESULTS: Array<{
  domain: string;
  model: string;
  status: '✅' | '❌' | '⏱️';
  duration: number;
  error?: string;
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
  
  console.log(`  Testing ${domain.name} with ${model.tag} (timeout: ${model.timeout/1000}s)`);
  
  process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
  process.env.LIMINAL_LLM_MODEL = model.name;
  delete process.env.LIMINAL_LLM_API_KEY;
  
  try {
    await Promise.race([
      run(domain.prompt, {
        maxIterations: 2,
        output: outputPath,
        project: `dogfood-${domain.name}-${model.tag}`,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), model.timeout)
      )
    ]);
    
    const duration = Date.now() - startTime;
    RESULTS.push({ domain: domain.name, model: model.tag, status: '✅', duration });
    log(`[${timestamp()}] ${domain.name} × ${model.tag} | ✅ | ${duration}ms`);
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const status = errorMsg.includes('Timeout') ? '⏱️' : '❌';
    
    RESULTS.push({ domain: domain.name, model: model.tag, status, duration, error: errorMsg });
    log(`[${timestamp()}] ${domain.name} × ${model.tag} | ${status} | ${duration}ms | ${errorMsg.slice(0, 60)}`);
  }
}

async function main() {
  console.log('\n🎨 Agent B - Quick Verification (12 tests)');
  console.log('===========================================\n');
  
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
  
  let testNum = 0;
  const totalTests = DOMAINS.length * MODELS.length;
  
  for (const domain of DOMAINS) {
    console.log(`\n📦 Domain: ${domain.name}`);
    for (const model of MODELS) {
      testNum++;
      console.log(`\n[${testNum}/${totalTests}] ${domain.name} × ${model.tag}`);
      await runTest(domain, model);
      if (testNum < totalTests) await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Summary
  console.log('\n\n========================================');
  console.log('📊 RESULTS');
  console.log('========================================\n');
  
  const passed = RESULTS.filter(r => r.status === '✅').length;
  const slow = RESULTS.filter(r => r.status === '⏱️').length;
  const failed = RESULTS.filter(r => r.status === '❌').length;
  
  console.log(`Total: ${RESULTS.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`⏱️  Timeout: ${slow}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / RESULTS.length) * 100).toFixed(1)}%\n`);
  
  // By model
  console.log('By Model:');
  MODELS.forEach(m => {
    const r = RESULTS.filter(x => x.model === m.tag);
    console.log(`  ${m.tag}: ${r.filter(x => x.status === '✅').length}/${r.length} passed`);
  });
  
  // By domain
  console.log('\nBy Domain:');
  DOMAINS.forEach(d => {
    const r = RESULTS.filter(x => x.domain === d.name);
    console.log(`  ${d.name}: ${r.filter(x => x.status === '✅').length}/${r.length} passed`);
  });
  
  fs.writeFileSync('./dogfood-results-agent-b.json', JSON.stringify(RESULTS, null, 2));
  console.log('\n📄 Results saved to dogfood-results-agent-b.json');
  console.log('📝 Log saved to dogfood-telemetry-agent-b.log\n');
}

main().catch(console.error);
