#!/usr/bin/env tsx
/**
 * Agent B Batch Test Runner - Runs specific model+domain combinations
 * Usage: npx tsx scripts/agent-b-batch.ts <model_tag> [domain]
 */

import { run } from '../src/index.js';
import fs from 'fs';

const DOMAINS: Record<string, { prompt: string; minSize: number }> = {
  p5: { prompt: 'Create a calming blue particle system with flowing movement', minSize: 500 },
  glsl: { prompt: 'Create an abstract plasma shader with animated colors', minSize: 300 },
  three: { prompt: 'Create a rotating 3D cube with interesting lighting', minSize: 500 },
  strudel: { prompt: 'Create a simple techno beat pattern with drums', minSize: 300 },
  hydra: { prompt: 'Create a geometric video synth pattern with kaleidoscope effect', minSize: 300 },
  tone: { prompt: 'Create an ambient drone synthesizer with reverb', minSize: 300 },
  html: { prompt: 'Create a landing page with hero section and call to action', minSize: 300 },
  ascii: { prompt: 'Create ASCII art of a mountain landscape', minSize: 300 },
  remotion: { prompt: 'Create a typing text animation video component', minSize: 500 },
};

const MODELS: Record<string, { name: string; tag: string }> = {
  'granite-1b': { name: 'granite4:1b', tag: 'granite-1b' },
  'granite-350m': { name: 'granite4:350m', tag: 'granite-350m' },
  'gemma': { name: 'gemma3:4b', tag: 'gemma' },
  'qwen35': { name: 'qwen3.5:2b', tag: 'qwen35' },
  'phi4': { name: 'phi4-mini:latest', tag: 'phi4' },
  'lfm': { name: 'lfm2.5-thinking:1.2b', tag: 'lfm' },
};

const RESULTS_FILE = './agent-b-results.json';

function loadResults(): Array<any> {
  if (fs.existsSync(RESULTS_FILE)) {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  }
  return [];
}

function saveResults(results: Array<any>) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

async function runTest(domainName: string, modelTag: string) {
  const domain = DOMAINS[domainName];
  const model = MODELS[modelTag];
  
  if (!domain || !model) {
    console.error(`Invalid domain '${domainName}' or model '${modelTag}'`);
    process.exit(1);
  }
  
  const startTime = Date.now();
  const outputPath = `./landing-live/b-${domainName}-${modelTag}.html`;
  
  process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
  process.env.LIMINAL_LLM_MODEL = model.name;
  
  console.log(`\n🧪 ${model.name} × ${domainName}`);
  console.log(`   Output: ${outputPath}`);
  
  try {
    const result = await run(domain.prompt, {
      maxIterations: 3,
      output: outputPath,
      project: `b-${domainName}-${modelTag}`,
    });
    
    const duration = Date.now() - startTime;
    
    // Find the actual output file
    let size = 0;
    let finalPath = outputPath;
    
    // Check if output is a directory
    try {
      const stats = fs.statSync(outputPath);
      if (stats.isDirectory()) {
        // Look for the final HTML file inside
        const files = fs.readdirSync(outputPath);
        const htmlFile = files.find(f => f.endsWith('-final.html')) || files.find(f => f.endsWith('.html'));
        if (htmlFile) {
          finalPath = `${outputPath}/${htmlFile}`;
          size = fs.statSync(finalPath).size;
        }
      } else {
        size = stats.size;
      }
    } catch {}
    
    // Check if size meets minimum
    if (size < domain.minSize) {
      const result = {
        domain: domainName,
        model: modelTag,
        status: 'FAIL',
        duration,
        size,
        error: `Output too small (${size}b < ${domain.minSize}b minimum)`
      };
      console.log(`   ❌ FAIL | ${size}b (too small, min ${domain.minSize}b) | ${duration}ms`);
      return result;
    }
    
    const resultData = {
      domain: domainName,
      model: modelTag,
      status: 'PASS',
      duration,
      size
    };
    console.log(`   ✅ PASS | ${size}b | ${duration}ms`);
    return resultData;
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    const result = {
      domain: domainName,
      model: modelTag,
      status: duration > 110000 ? 'TIMEOUT' : 'FAIL',
      duration,
      size: 0,
      error: errorMsg.slice(0, 100)
    };
    console.log(`   ❌ ${result.status} | ${duration}ms | ${errorMsg.slice(0, 60)}`);
    return result;
  }
}

async function main() {
  const modelTag = process.argv[2];
  const specificDomain = process.argv[3];
  
  if (!modelTag || !MODELS[modelTag]) {
    console.log('Usage: npx tsx scripts/agent-b-batch.ts <model_tag> [domain]');
    console.log('');
    console.log('Model tags:');
    Object.keys(MODELS).forEach(t => console.log(`  ${t}`));
    console.log('');
    console.log('Domains (optional - runs all if not specified):');
    Object.keys(DOMAINS).forEach(d => console.log(`  ${d}`));
    process.exit(1);
  }
  
  const results = loadResults();
  
  if (specificDomain) {
    // Run single test
    const result = await runTest(specificDomain, modelTag);
    
    // Remove any existing entry for this combination
    const idx = results.findIndex(r => r.domain === specificDomain && r.model === modelTag);
    if (idx >= 0) results.splice(idx, 1);
    results.push(result);
    saveResults(results);
    
  } else {
    // Run all domains for this model
    console.log(`\n📦 Running all domains for ${MODELS[modelTag].name}`);
    console.log('='.repeat(50));
    
    for (const domainName of Object.keys(DOMAINS)) {
      const result = await runTest(domainName, modelTag);
      
      // Remove any existing entry
      const idx = results.findIndex(r => r.domain === domainName && r.model === modelTag);
      if (idx >= 0) results.splice(idx, 1);
      results.push(result);
      saveResults(results);
      
      // Small delay between tests
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Print summary for this model
    const modelResults = results.filter(r => r.model === modelTag);
    const passed = modelResults.filter(r => r.status === 'PASS').length;
    const failed = modelResults.filter(r => r.status === 'FAIL').length;
    const timedOut = modelResults.filter(r => r.status === 'TIMEOUT').length;
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 ${MODELS[modelTag].name} Summary: ${passed} pass, ${failed} fail, ${timedOut} timeout`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
