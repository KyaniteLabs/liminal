#!/usr/bin/env node
/**
 * 100% Dogfood Test - All Domains × All Models
 * 
 * Runs every domain through Liminal with every available LLM provider.
 * One by one, sequential execution.
 */

import { run } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Domain definitions with test prompts
const DOMAINS = [
  {
    name: 'p5',
    prompt: 'Create a calming blue particle system with flowing movement',
    check: (code: string) => code.includes('createCanvas') || code.includes('function setup'),
  },
  {
    name: 'glsl',
    prompt: 'Create an abstract plasma shader with animated colors',
    check: (code: string) => code.includes('void main') && code.includes('gl_FragColor'),
  },
  {
    name: 'three',
    prompt: 'Create a rotating 3D cube with interesting lighting',
    check: (code: string) => code.includes('THREE') || code.includes('Scene'),
  },
  {
    name: 'strudel',
    prompt: 'Create a simple techno beat pattern with drums',
    check: (code: string) => code.includes('stack') || code.includes('sound') || code.includes('s('),
  },
  {
    name: 'hydra',
    prompt: 'Create a geometric video synth pattern with kaleidoscope effect',
    check: (code: string) => code.includes('.out(') || code.includes('osc(') || code.includes('shape('),
  },
  {
    name: 'tone',
    prompt: 'Create an ambient drone synthesizer with reverb',
    check: (code: string) => code.includes('Tone.') || code.includes('Synth'),
  },
  {
    name: 'remotion',
    prompt: 'Create a typing text animation video component',
    check: (code: string) => code.includes('useCurrentFrame') || code.includes('AbsoluteFill'),
  },
  {
    name: 'html',
    prompt: 'Create a landing page with hero section and call to action',
    check: (code: string) => code.includes('<!DOCTYPE html>') || code.includes('<html'),
  },
  {
    name: 'ascii',
    prompt: 'Create ASCII art of a mountain landscape',
    check: (code: string) => code.length > 50 && /[█▓▒░@#%*]/.test(code),
  },
];

// Model configurations
const MODELS = [
  {
    name: 'minimax-m27',
    env: { LIMINAL_LLM_BASE_URL: 'https://api.minimax.io/v1', LIMINAL_LLM_MODEL: 'MiniMax-M2.7' },
    available: !!process.env.MINIMAX_API_KEY,
  },
  {
    name: 'minimax-m25',
    env: { LIMINAL_LLM_BASE_URL: 'https://api.minimax.io/v1', LIMINAL_LLM_MODEL: 'MiniMax-M2.5' },
    available: !!process.env.MINIMAX_API_KEY,
  },
  {
    name: 'qwen35',
    env: { LIMINAL_LLM_BASE_URL: 'http://localhost:11434/v1', LIMINAL_LLM_MODEL: 'qwen3.5:2b' },
    available: true, // Ollama
  },
  {
    name: 'gemma',
    env: { LIMINAL_LLM_BASE_URL: 'http://localhost:11434/v1', LIMINAL_LLM_MODEL: 'gemma3:4b' },
    available: true, // Ollama
  },
  {
    name: 'phi4',
    env: { LIMINAL_LLM_BASE_URL: 'http://localhost:11434/v1', LIMINAL_LLM_MODEL: 'phi4-mini:latest' },
    available: true, // Ollama
  },
  {
    name: 'granite',
    env: { LIMINAL_LLM_BASE_URL: 'http://localhost:11434/v1', LIMINAL_LLM_MODEL: 'granite4:350m' },
    available: true, // Ollama
  },
];

interface DogfoodResult {
  domain: string;
  model: string;
  success: boolean;
  code: string;
  outputPath: string;
  error?: string;
  duration: number;
}

const RESULTS: DogfoodResult[] = [];

function formatError(context: string, error: unknown): string {
  if (error instanceof Error) return `${context}: ${error.message}`;
  return `${context}: ${String(error)}`;
}

/**
 * Clear all LLM-related caches to ensure clean state between model runs.
 * This prevents configuration leakage between different models.
 */
function clearLLMCaches(): void {
  LLMClient.clearGlobalCache();
}

async function runSingleTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]): Promise<DogfoodResult> {
  console.log(`\n🔄 Running: ${domain.name} × ${model.name}`);

  const startTime = Date.now();
  const timestamp = Date.now();
  const outputPath = `landing-live/${domain.name}-${model.name}.html`;
  const tempOutputDir = path.join(PROJECT_ROOT, `dogfood-temp/${domain.name}-${model.name}-${timestamp}`);
  const fullOutputPath = path.join(PROJECT_ROOT, outputPath);

  // Clear LLM caches before setting environment to ensure clean state
  clearLLMCaches();

  // Clean up temp dir if exists
  if (fs.existsSync(tempOutputDir)) {
    fs.rmSync(tempOutputDir, { recursive: true });
  }
  
  // Snapshot current environment before applying model overrides
  const originalEnv = { ...process.env };
  
  try {
    // Set environment for this model
    for (const [key, value] of Object.entries(model.env)) {
      process.env[key] = value;
    }
    
    const result = await run(domain.prompt, {
      maxIterations: 1, // Single iteration for speed
      output: tempOutputDir,
      project: `dogfood-${domain.name}-${model.name}`,
    });
    
    // Copy generated HTML to landing-live
    const generatedFiles = fs.readdirSync(tempOutputDir).filter(f => f.endsWith('.html') || f.endsWith('.js'));
    if (generatedFiles.length > 0) {
      // Find the main output file (usually v1.js or similar)
      const mainFile = generatedFiles.find(f => f.endsWith('.html')) || generatedFiles[0];
      fs.copyFileSync(path.join(tempOutputDir, mainFile), fullOutputPath);
    }
    
    const duration = Date.now() - startTime;
    const success = domain.check(result.code);
    
    console.log(`  ${success ? '✅' : '❌'} ${duration}ms - ${success ? 'Valid output' : 'Check failed'}`);
    
    return {
      domain: domain.name,
      model: model.name,
      success,
      code: result.code,
      outputPath,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = formatError('DogfoodRunner', error);
    console.log(`  ❌ ${duration}ms - ERROR: ${errorMsg.substring(0, 100)}`);
    
    return {
      domain: domain.name,
      model: model.name,
      success: false,
      code: '',
      outputPath,
      error: errorMsg,
      duration,
    };
  } finally {
    // Restore original environment so subsequent tests get clean state
    for (const key of Object.keys(model.env)) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  }
}

async function runAllTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('100% DOGFOOD TEST - All Domains × All Models');
  console.log('='.repeat(80));
  console.log(`\nDomains: ${DOMAINS.length} (${DOMAINS.map(d => d.name).join(', ')})`);
  console.log(`Models: ${MODELS.filter(m => m.available).length} / ${MODELS.length}`);
  console.log(`Total runs: ${DOMAINS.length} × ${MODELS.filter(m => m.available).length} = ${DOMAINS.length * MODELS.filter(m => m.available).length}`);
  console.log('\nStarting sequential execution...\n');
  
  const availableModels = MODELS.filter(m => m.available);
  let completed = 0;
  const total = DOMAINS.length * availableModels.length;
  
  for (const domain of DOMAINS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`DOMAIN: ${domain.name.toUpperCase()}`);
    console.log(`Prompt: "${domain.prompt}"`);
    console.log('='.repeat(80));
    
    for (const model of availableModels) {
      const result = await runSingleTest(domain, model);
      RESULTS.push(result);
      completed++;
      console.log(`  Progress: ${completed}/${total} (${Math.round((completed/total)*100)}%)`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const successful = RESULTS.filter(r => r.success);
  const failed = RESULTS.filter(r => !r.success);
  
  console.log(`\nTotal: ${RESULTS.length}`);
  console.log(`✅ Success: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`Success Rate: ${((successful.length / RESULTS.length) * 100).toFixed(1)}%`);
  
  // Domain breakdown
  console.log('\nBy Domain:');
  for (const domain of DOMAINS) {
    const domainResults = RESULTS.filter(r => r.domain === domain.name);
    const domainSuccess = domainResults.filter(r => r.success).length;
    console.log(`  ${domain.name}: ${domainSuccess}/${domainResults.length}`);
  }
  
  // Model breakdown
  console.log('\nBy Model:');
  for (const model of availableModels) {
    const modelResults = RESULTS.filter(r => r.model === model.name);
    const modelSuccess = modelResults.filter(r => r.success).length;
    console.log(`  ${model.name}: ${modelSuccess}/${modelResults.length}`);
  }
  
  // Failed details
  if (failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const f of failed) {
      console.log(`  - ${f.domain} × ${f.model}${f.error ? ': ' + f.error.substring(0, 80) : ''}`);
    }
  }
  
  // Save results
  const reportPath = path.join(PROJECT_ROOT, 'dogfood-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: RESULTS.length,
    success: successful.length,
    failed: failed.length,
    results: RESULTS,
  }, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  console.log('\n' + '='.repeat(80));
  console.log(failed.length === 0 ? '🎉 100% SUCCESS!' : `⚠️  ${failed.length} failures need attention`);
  console.log('='.repeat(80));
  
  process.exit(failed.length > 0 ? 1 : 0);
}

// Run
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
