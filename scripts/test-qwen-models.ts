#!/usr/bin/env tsx
/**
 * Test Qwen3.5 models (0.8b and 2b) across all domains
 */

import { P5GeneratorLLM } from '../src/generators/p5/P5GeneratorLLM.js';
import { ShaderGenerator } from '../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../src/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../src/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../src/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../src/generators/tone/ToneGenerator.js';
import { LLMClient } from '../src/llm/LLMClient.js';
import { CodeValidator } from '../src/core/CodeValidator.js';
import { writeFileSync } from 'fs';
import { ensureDir } from '../src/utils/fs.js';
import path from 'path';

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'html', 'ascii', 'remotion', 'tone'];

const PROMPTS: Record<string, string> = {
  p5: 'Create a calming blue particle system with flowing movement',
  glsl: 'Create an abstract plasma shader with animated colors',
  three: 'Create a 3D rotating crystal with reflections',
  strudel: 'Create a driving techno beat with drums and bass',
  hydra: 'Create geometric patterns with feedback effects',
  html: 'Create a modern landing page with hero section',
  ascii: 'Create ASCII art of a mountain landscape',
  remotion: 'Create a title card animation with fade in',
  tone: 'Create an ambient drone with reverb and delay'
};

const QWEN_MODELS = [
  { name: 'Qwen3.5-0.8b', modelId: 'qwen3.5:0.8b' },
  { name: 'Qwen3.5-2b', modelId: 'qwen3.5:2b' }
];

const RESULTS: Array<{
  model: string;
  domain: string;
  status: 'success' | 'fail' | 'timeout';
  duration: number;
  size: number;
  errors: string[];
  errorMessage?: string;
}> = [];

async function generateWithDomain(domain: string, prompt: string, llm: LLMClient): Promise<{ code: string; errors: string[] }> {
  let code: string;
  
  switch (domain) {
    case 'p5': {
      const gen = new P5GeneratorLLM(llm);
      code = await gen.generate(prompt);
      break;
    }
    case 'glsl': {
      const gen = new ShaderGenerator(llm);
      code = await gen.generate(prompt);
      break;
    }
    case 'three': {
      const gen = new ThreeGenerator(llm);
      code = await gen.generate(prompt);
      break;
    }
    case 'strudel': {
      const gen = new StrudelGenerator(llm);
      code = await gen.generate(prompt);
      break;
    }
    case 'hydra': {
      const gen = new HydraGenerator(llm);
      code = await gen.generate(prompt);
      break;
    }
    case 'tone': {
      const gen = new ToneGenerator(llm);
      code = await gen.generate(prompt);
      break;
    }
    case 'html': {
      const { HTMLWebGenerator } = await import('../src/generators/html/HTMLWebGenerator.js');
      const gen = new HTMLWebGenerator(llm);
      code = await gen.generate(prompt, { responsive: true, includeAnimations: true });
      break;
    }
    case 'ascii': {
      const { ASCIIArtGenerator } = await import('../src/generators/ascii/ASCIIArtGenerator.js');
      const gen = new ASCIIArtGenerator(llm);
      code = await gen.generate(prompt, { style: 'abstract', width: 60, height: 30 });
      break;
    }
    case 'remotion': {
      const { RemotionGenerator } = await import('../src/generators/remotion/RemotionGenerator.js');
      const gen = new RemotionGenerator(llm);
      code = await gen.generate(prompt);
      break;
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }
  
  const validation = CodeValidator.validate(code, domain);
  return { code, errors: validation.errors };
}

async function runTest(model: typeof QWEN_MODELS[0], domain: string) {
  console.log(`\n🧪 Testing ${model.name} × ${domain}...`);
  
  const llm = new LLMClient({
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    model: model.modelId,
    temperature: 0.7,
    maxTokens: 4000,
    timeout: 120000 // 2 minute timeout
  });
  llm.disableCache();
  
  const startTime = Date.now();
  
  try {
    const { code, errors } = await generateWithDomain(domain, PROMPTS[domain], llm);
    const duration = Date.now() - startTime;
    
    // Save output
    const outputDir = path.join('test-qwen-output', `${model.name}-${domain}`);
    ensureDir(outputDir);
    writeFileSync(path.join(outputDir, 'output.js'), code);
    
    const status = errors.length === 0 ? 'success' : 'fail';
    
    RESULTS.push({
      model: model.name,
      domain,
      status,
      duration,
      size: code.length,
      errors
    });
    
    if (status === 'success') {
      console.log(`  ✅ SUCCESS (${duration}ms, ${code.length}b)`);
    } else {
      console.log(`  ⚠️  VALIDATION ERRORS (${duration}ms)`);
      errors.slice(0, 3).forEach(e => console.log(`     - ${e.substring(0, 80)}`));
      if (errors.length > 3) console.log(`     ... and ${errors.length - 3} more`);
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error instanceof Error && 
      (error.message.includes('timeout') || error.message.includes('aborted'));
    
    RESULTS.push({
      model: model.name,
      domain,
      status: isTimeout ? 'timeout' : 'fail',
      duration,
      size: 0,
      errors: [],
      errorMessage: formatError('QwenModelTest', error)
    });
    
    console.log(`  ❌ ${isTimeout ? 'TIMEOUT' : 'FAIL'} (${duration}ms)`);
    const msg = formatError('QwenModelTest', error);
    console.log(`     ${msg.substring(0, 100)}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  QWEN3.5 MODEL TEST (0.8b and 2b)');
  console.log('  All 9 domains with new fixes');
  console.log('═══════════════════════════════════════════════════');
  
  for (const model of QWEN_MODELS) {
    console.log(`\n📦 Model: ${model.name}`);
    console.log('─'.repeat(50));
    
    for (const domain of DOMAINS) {
      await runTest(model, domain);
      // Small delay between tests
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Print summary
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  
  for (const model of QWEN_MODELS) {
    const modelResults = RESULTS.filter(r => r.model === model.name);
    const success = modelResults.filter(r => r.status === 'success').length;
    const fail = modelResults.filter(r => r.status === 'fail').length;
    const timeout = modelResults.filter(r => r.status === 'timeout').length;
    
    console.log(`\n${model.name}:`);
    console.log(`  ✅ Success: ${success}/${DOMAINS.length}`);
    console.log(`  ⚠️  Validation Fail: ${fail}/${DOMAINS.length}`);
    console.log(`  ⏱️  Timeout: ${timeout}/${DOMAINS.length}`);
    
    // Domain breakdown
    console.log('  Domains:');
    for (const r of modelResults) {
      const icon = r.status === 'success' ? '✅' : r.status === 'timeout' ? '⏱️' : '⚠️';
      console.log(`    ${icon} ${r.domain.padEnd(10)} ${r.status.padEnd(7)} (${r.duration.toString().padStart(5)}ms, ${r.size.toString().padStart(5)}b)`);
    }
  }
  
  // Save results to JSON
  const resultsPath = 'test-qwen-output/results.json';
  ensureDir('test-qwen-output');
  writeFileSync(resultsPath, JSON.stringify(RESULTS, null, 2));
  console.log(`\n💾 Results saved to: ${resultsPath}`);
}

main().catch(console.error);
