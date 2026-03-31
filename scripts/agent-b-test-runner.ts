#!/usr/bin/env tsx
/**
 * Agent B Test Runner - Simple sequential runner with timeouts
 */

import { run } from '../src/index.js';
import fs from 'fs';

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement' },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors' },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting' },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums' },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect' },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb' },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action' },
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape' },
  { name: 'remotion', prompt: 'Create a typing text animation video component' },
];

const MODELS = [
  { name: 'granite4:1b', tag: 'granite-1b' },
  { name: 'granite4:350m', tag: 'granite-350m' },
  { name: 'gemma3:4b', tag: 'gemma' },
  { name: 'qwen3.5:2b', tag: 'qwen35' },
  { name: 'phi4-mini:latest', tag: 'phi4' },
  { name: 'lfm2.5-thinking:1.2b', tag: 'lfm' },
];

const RESULTS: Array<{
  domain: string;
  model: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT';
  duration: number;
  size: number;
  error?: string;
}> = [];

async function runTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]) {
  const startTime = Date.now();
  const outputPath = `./landing-live/b-${domain.name}-${model.tag}.html`;
  
  process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
  process.env.LIMINAL_LLM_MODEL = model.name;
  
  try {
    const result = await run(domain.prompt, {
      maxIterations: 3,
      output: outputPath,
      project: `b-${domain.name}-${model.tag}`,
    });
    
    const duration = Date.now() - startTime;
    let size = 0;
    try {
      size = fs.statSync(outputPath).size;
    } catch {}
    
    RESULTS.push({ 
      domain: domain.name, 
      model: model.tag, 
      status: 'PASS', 
      duration, 
      size 
    });
    console.log(`✅ PASS | ${size}b | ${duration}ms`);
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it was a timeout (took >110s)
    const status = duration > 110000 ? 'TIMEOUT' : 'FAIL';
    
    RESULTS.push({ 
      domain: domain.name, 
      model: model.tag, 
      status, 
      duration, 
      size: 0, 
      error: errorMsg 
    });
    console.log(`❌ ${status} | ${duration}ms | ${errorMsg.slice(0, 80)}`);
  }
}

async function main() {
  console.log('\nAGENT B TEST RUNNER');
  console.log('====================');
  console.log(`Models: ${MODELS.length}, Domains: ${DOMAINS.length}, Total: ${MODELS.length * DOMAINS.length}\n`);
  
  let testNum = 0;
  const totalTests = MODELS.length * DOMAINS.length;
  
  for (const model of MODELS) {
    console.log(`\n📦 Model: ${model.name}`);
    console.log('-'.repeat(50));
    
    let consecutiveFailures = 0;
    
    for (const domain of DOMAINS) {
      testNum++;
      process.stdout.write(`[${testNum}/${totalTests}] ${domain.name}... `);
      
      await runTest(domain, model);
      
      // Track consecutive failures
      const lastResult = RESULTS[RESULTS.length - 1];
      if (lastResult.status !== 'PASS') {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          console.log(`   ⚠️  3 consecutive failures, skipping remaining domains for ${model.name}`);
          // Mark remaining as skipped
          const remainingDomains = DOMAINS.slice(DOMAINS.indexOf(domain) + 1);
          for (const d of remainingDomains) {
            testNum++;
            RESULTS.push({
              domain: d.name,
              model: model.tag,
              status: 'FAIL',
              duration: 0,
              size: 0,
              error: 'Skipped due to consecutive failures'
            });
          }
          break;
        }
      } else {
        consecutiveFailures = 0;
      }
    }
  }
  
  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('AGENT B RESULTS');
  console.log('='.repeat(60));
  
  const passed = RESULTS.filter(r => r.status === 'PASS').length;
  const failed = RESULTS.filter(r => r.status === 'FAIL').length;
  const timedOut = RESULTS.filter(r => r.status === 'TIMEOUT').length;
  
  console.log(`\nTotal Tests: ${RESULTS.length} (6 models × 9 domains)`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Timed Out: ${timedOut}\n`);
  
  // Results by model
  console.log('RESULTS BY MODEL:\n');
  for (const model of MODELS) {
    const modelResults = RESULTS.filter(r => r.model === model.tag);
    console.log(`${model.name} (${modelResults.length} tests):`);
    for (const r of modelResults) {
      const sizeStr = r.size > 0 ? `${r.size}b` : (r.error ? r.error.slice(0, 40) : '-');
      console.log(`- ${r.domain}: ${r.status} - ${sizeStr}`);
    }
    console.log();
  }
  
  // Summary stats
  console.log('SUMMARY:');
  
  // Best/Worst model
  const modelScores = MODELS.map(m => {
    const mr = RESULTS.filter(r => r.model === m.tag);
    const passed = mr.filter(r => r.status === 'PASS').length;
    return { name: m.name, tag: m.tag, passed };
  });
  modelScores.sort((a, b) => b.passed - a.passed);
  console.log(`- Best Model: ${modelScores[0].name} - ${modelScores[0].passed}/9 passed`);
  console.log(`- Worst Model: ${modelScores[modelScores.length - 1].name} - ${modelScores[modelScores.length - 1].passed}/9 passed`);
  
  // Best/Worst domain
  const domainScores = DOMAINS.map(d => {
    const dr = RESULTS.filter(r => r.domain === d.name);
    const passed = dr.filter(r => r.status === 'PASS').length;
    return { name: d.name, passed };
  });
  domainScores.sort((a, b) => b.passed - a.passed);
  console.log(`- Best Domain: ${domainScores[0].name} - ${domainScores[0].passed}/6 passed`);
  console.log(`- Worst Domain: ${domainScores[domainScores.length - 1].name} - ${domainScores[domainScores.length - 1].passed}/6 passed`);
  
  // Save results
  fs.writeFileSync('./agent-b-results.json', JSON.stringify(RESULTS, null, 2));
  console.log('\n📄 Results saved to agent-b-results.json');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
