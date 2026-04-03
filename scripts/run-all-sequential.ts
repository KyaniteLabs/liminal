#!/usr/bin/env tsx
/**
 * Sequential runner with proper timeouts
 * Generates ALL examples (7 models × 5 domains = 35 total)
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { ensureDir } from '../src/utils/fs.js';

const ALL_TASKS = [
  { provider: 'minimax', model: 'MiniMax-M2.7', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  { provider: 'minimax', model: 'MiniMax-M2.5', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  { provider: 'lmstudio', model: 'Qwen3.5-9B', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  { provider: 'ollama', model: 'Gemma3-4B', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  { provider: 'ollama', model: 'Kimi-K2.5', domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
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
    
    // 5 minute timeout per task
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        provider, model, domain,
        success: false,
        duration: Date.now() - startTime,
        error: 'Timeout after 5 minutes'
      });
    }, 5 * 60 * 1000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
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
  console.log('🚀 Sequential Dogfood Generation - All Models & Domains');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const results: any[] = [];
  let taskNum = 0;
  const totalTasks = ALL_TASKS.reduce((sum, t) => sum + t.domains.length, 0);
  
  for (const taskGroup of ALL_TASKS) {
    console.log(`\n🤖 ${taskGroup.model}`);
    for (const domain of taskGroup.domains) {
      taskNum++;
      process.stdout.write(`  [${taskNum}/${totalTasks}] ${domain.padEnd(8)} ... `);
      
      const result = await runTask(taskGroup.provider, taskGroup.model, domain);
      results.push(result);
      
      if (result.success) {
        const r = result.result;
        console.log(`✅ ${(result.duration/1000).toFixed(1)}s score:${r?.score?.toFixed(2) || '?'} iters:${r?.iterations}`);
      } else {
        console.log(`❌ ${(result.duration/1000).toFixed(1)}s ${result.error?.substring(0, 40)}`);
      }
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total: ${successful.length}/${results.length} successful`);
  console.log(`Total time: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed (${failed.length}):`);
    for (const f of failed) {
      console.log(`  - ${f.provider}/${f.model}/${f.domain}`);
    }
  }
  
  // Save results
  ensureDir('examples/results');
  writeFileSync('examples/results/all-generations.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTasks: results.length,
    successful: successful.length,
    failed: failed.length,
    totalDuration,
    results
  }, null, 2));
  
  console.log('\n📊 Results saved to examples/results/all-generations.json');
}

main().catch(console.error);
