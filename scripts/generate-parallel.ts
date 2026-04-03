#!/usr/bin/env tsx
/**
 * Parallel Dogfood Generation - Multiple providers simultaneously
 * Usage: tsx generate-parallel.ts [provider1] [provider2] ...
 * Example: tsx generate-parallel.ts minimax lmstudio ollama
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { ensureDir } from '../src/utils/fs.js';
import { join } from 'path';

const PROVIDERS = {
  minimax: { models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.1'], concurrency: 2 },
  lmstudio: { models: ['Qwen3.5-9B', 'Qwen3-Coder-40B'], concurrency: 1 },
  ollama: { models: ['Gemma3-4B', 'Kimi-K2.5'], concurrency: 2 }
};

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra'];

interface Task {
  provider: string;
  model: string;
  domain: string;
  logFile: string;
}

function createTasks(providers: string[]): Task[] {
  const tasks: Task[] = [];
  
  for (const provider of providers) {
    const config = PROVIDERS[provider as keyof typeof PROVIDERS];
    if (!config) {
      console.warn(`⚠️ Unknown provider: ${provider}`);
      continue;
    }
    
    for (const model of config.models) {
      for (const domain of DOMAINS) {
        tasks.push({
          provider,
          model,
          domain,
          logFile: `examples/logs/${provider}-${model.replace(/[^a-zA-Z0-9]/g, '_')}-${domain}.log`
        });
      }
    }
  }
  
  return tasks;
}

async function runTask(task: Task): Promise<{ task: Task; success: boolean; duration: number; result?: any; error?: string }> {
  const startTime = Date.now();
  
  // Ensure log directory exists
  const logDir = task.logFile.substring(0, task.logFile.lastIndexOf('/'));
  ensureDir(logDir);
  
  return new Promise((resolve) => {
    const args = [
      'scripts/generate-single.ts',
      task.provider,
      task.model,
      task.domain
    ];
    
    const child = spawn('npx', ['tsx', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      // Write log
      const log = `
=== ${task.provider}/${task.model}/${task.domain} ===
Exit code: ${code}
Duration: ${(duration / 1000).toFixed(1)}s

STDOUT:
${stdout}

STDERR:
${stderr}
`.trim();
      
      writeFileSync(task.logFile, log);
      
      // Parse result from stdout
      let result;
      try {
        const resultMatch = stdout.match(/RESULT: ({.+})/);
        if (resultMatch) {
          result = JSON.parse(resultMatch[1]);
        }
      } catch {}
      
      resolve({
        task,
        success,
        duration,
        result,
        error: stderr || undefined
      });
    });
    
    // Timeout after 10 minutes
    setTimeout(() => {
      child.kill('SIGTERM');
      const duration = Date.now() - startTime;
      resolve({
        task,
        success: false,
        duration,
        error: 'Timeout after 10 minutes'
      });
    }, 10 * 60 * 1000);
  });
}

async function runParallel(tasks: Task[], concurrency: number): Promise<any[]> {
  const results: any[] = [];
  const executing: Promise<void>[] = [];
  
  for (const task of tasks) {
    const promise = runTask(task).then(result => {
      results.push(result);
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(1);
      const score = result.result?.score ? `score:${result.result.score.toFixed(2)}` : '';
      console.log(`${status} ${task.provider}/${task.model}/${task.domain} (${duration}s) ${score}`);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const providers = args.length > 0 ? args : Object.keys(PROVIDERS);
  
  console.log('🚀 Parallel Dogfood Generation');
  console.log(`Providers: ${providers.join(', ')}`);
  console.log('');
  
  const tasks = createTasks(providers);
  console.log(`Total tasks: ${tasks.length}`);
  console.log(`Concurrency: 4`);
  console.log('');
  
  // Summary stats
  const startTime = Date.now();
  const results = await runParallel(tasks, 4);
  const totalDuration = Date.now() - startTime;
  
  // Report
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('');
  console.log('═'.repeat(60));
  console.log('GENERATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Total time: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Successful: ${successful.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed tasks:');
    for (const f of failed) {
      console.log(`  - ${f.task.provider}/${f.task.model}/${f.task.domain}: ${f.error?.substring(0, 100)}`);
    }
  }
  
  // Save summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalTasks: results.length,
    successful: successful.length,
    failed: failed.length,
    totalDuration: totalDuration,
    results: results.map(r => ({
      provider: r.task.provider,
      model: r.task.model,
      domain: r.task.domain,
      success: r.success,
      duration: r.duration,
      score: r.result?.score,
      iterations: r.result?.iterations,
      codeLength: r.result?.codeLength
    }))
  };
  
  writeFileSync('examples/parallel-results.json', JSON.stringify(summary, null, 2));
  console.log('\n📊 Results saved to examples/parallel-results.json');
}

main().catch(console.error);
