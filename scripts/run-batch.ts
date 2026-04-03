#!/usr/bin/env tsx
/**
 * Batch runner - runs tasks sequentially in foreground
 * Usage: tsx run-batch.ts <start_index> <count>
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { ensureDir } from '../src/utils/fs.js';

const ALL_TASKS = [
  // MiniMax
  { provider: 'minimax', model: 'MiniMax-M2.7', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
  { provider: 'minimax', model: 'MiniMax-M2.5', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
  { provider: 'minimax', model: 'MiniMax-M2.1', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
  // LM Studio
  { provider: 'lmstudio', model: 'Qwen3.5-9B', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
  { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
  // Ollama
  { provider: 'ollama', model: 'Gemma3-4B', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
  { provider: 'ollama', model: 'Kimi-K2.5', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra'] },
];

async function runTask(provider: string, model: string, domain: string): Promise<any> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn('npx', ['tsx', 'scripts/generate-single.ts', provider, model, domain], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      let result;
      try {
        const match = stdout.match(/RESULT: ({.+})/);
        if (match) result = JSON.parse(match[1]);
      } catch {}
      
      resolve({
        provider, model, domain,
        success: code === 0 && result?.success,
        duration,
        result,
        error: stderr || undefined
      });
    });
  });
}

async function main() {
  const startIdx = parseInt(process.argv[2] || '0');
  const count = parseInt(process.argv[3] || '5');
  
  // Flatten tasks
  const tasks: { provider: string; model: string; domain: string }[] = [];
  for (const t of ALL_TASKS) {
    for (const d of t.domains) {
      tasks.push({ provider: t.provider, model: t.model, domain: d });
    }
  }
  
  const batch = tasks.slice(startIdx, startIdx + count);
  
  console.log(`Running batch ${startIdx}-${startIdx + count - 1} of ${tasks.length} tasks`);
  console.log('');
  
  const results = [];
  for (const task of batch) {
    process.stdout.write(`${task.provider}/${task.model}/${task.domain}... `);
    const result = await runTask(task.provider, task.model, task.domain);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${(result.duration / 1000).toFixed(1)}s score:${result.result?.score?.toFixed(2) || '?'}`);
    } else {
      console.log(`❌ ${(result.duration / 1000).toFixed(1)}s`);
    }
  }
  
  // Save batch results
  ensureDir('examples/batches');
  writeFileSync(`examples/batches/batch-${startIdx}.json`, JSON.stringify(results, null, 2));
  
  console.log('');
  console.log(`Batch complete: ${results.filter(r => r.success).length}/${results.length} successful`);
  console.log(`Next batch: tsx scripts/run-batch.ts ${startIdx + count} ${count}`);
}

main().catch(console.error);
