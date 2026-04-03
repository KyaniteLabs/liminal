#!/usr/bin/env tsx
/**
 * Run p5.js generation on all 7 models
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { ensureDir } from '../src/utils/fs.js';

const MODELS = [
  { provider: 'minimax', model: 'MiniMax-M2.7' },
  { provider: 'minimax', model: 'MiniMax-M2.5' },
  { provider: 'minimax', model: 'MiniMax-M2.1' },
  { provider: 'lmstudio', model: 'Qwen3.5-9B' },
  { provider: 'lmstudio', model: 'Qwen3-Coder-40B' },
  { provider: 'ollama', model: 'Gemma3-4B' },
  { provider: 'ollama', model: 'Kimi-K2.5' },
];

async function runTask(provider: string, model: string): Promise<any> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn('npx', ['tsx', 'scripts/generate-single.ts', provider, model, 'p5'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());
    
    // Timeout after 2 minutes
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ provider, model, success: false, error: 'Timeout', duration: Date.now() - startTime });
    }, 120000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      let result;
      try {
        const match = stdout.match(/RESULT: ({.+})/);
        if (match) result = JSON.parse(match[1]);
      } catch {}
      
      // Consider success if we got a valid result with iterations > 0, regardless of exit code
      const hasValidResult = result && result.iterations > 0 && result.codeLength > 0;
      resolve({ provider, model, success: hasValidResult, duration, result, error: stderr || undefined });
    });
  });
}

async function main() {
  console.log('🎨 Running p5.js generation on all 7 models\n');
  
  const results = [];
  for (const { provider, model } of MODELS) {
    process.stdout.write(`${provider}/${model}... `);
    const result = await runTask(provider, model);
    results.push(result);
    
    if (result.success) {
      const r = result.result;
      console.log(`✅ ${(result.duration/1000).toFixed(1)}s iter:${r?.iterations} score:${r?.score?.toFixed(2)} chars:${r?.codeLength}`);
    } else {
      console.log(`❌ ${(result.duration/1000).toFixed(1)}s ${result.error?.substring(0, 50)}`);
    }
  }
  
  ensureDir('examples/results');
  writeFileSync('examples/results/p5-all-models.json', JSON.stringify(results, null, 2));
  
  console.log('\n' + '═'.repeat(60));
  console.log(`Complete: ${results.filter(r => r.success).length}/${results.length} successful`);
  console.log('Results saved to examples/results/p5-all-models.json');
}

main().catch(console.error);
