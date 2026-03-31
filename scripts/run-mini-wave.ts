#!/usr/bin/env tsx
/**
 * Mini wave runner - 4 tasks max per wave
 * Usage: tsx run-mini-wave.ts <model-key>
 * 
 * Models: m27, m25, q35, qc4, g4, kk2
 */

import { spawn } from 'child_process';

const MODELS: Record<string, { provider: string; model: string; domains: string[] }> = {
  m27: { provider: 'minimax', model: 'MiniMax-M2.7', 
    domains: ['html', 'ascii'] }, // remaining
  m25: { provider: 'minimax', model: 'MiniMax-M2.5', 
    domains: [] }, // done
  q35: { provider: 'lmstudio', model: 'Qwen3.5-9B', 
    domains: ['three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] }, // remaining
  qc4: { provider: 'lmstudio', model: 'Qwen3-Coder-40B', 
    domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  g4: { provider: 'ollama', model: 'Gemma3-4B', 
    domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
  kk2: { provider: 'ollama', model: 'Kimi-K2.5', 
    domains: ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'] },
};

async function runTask(provider: string, model: string, domain: string): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn('npx', ['tsx', 'scripts/generate-single.ts', provider, model, domain], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => stdout += d.toString());
    child.stderr.on('data', (d) => stderr += d.toString());
    
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ provider, model, domain, success: false, duration: Date.now() - start, error: 'Timeout' });
    }, 4 * 60 * 1000);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - start;
      let result;
      try { const m = stdout.match(/RESULT: ({.+})/); if (m) result = JSON.parse(m[1]); } catch {}
      resolve({ provider, model, domain, success: code === 0 && result?.success, duration, result });
    });
  });
}

async function main() {
  const key = process.argv[2];
  const config = MODELS[key];
  
  if (!config || config.domains.length === 0) {
    console.log(`Nothing to do for ${key}`);
    process.exit(0);
  }
  
  console.log(`🚀 ${config.model} (${config.domains.length} tasks)`);
  console.log('═'.repeat(50));
  
  for (const domain of config.domains) {
    process.stdout.write(`${domain.padEnd(10)} ... `);
    const r = await runTask(config.provider, config.model, domain);
    if (r.success) console.log(`✅ ${(r.duration/1000).toFixed(1)}s`);
    else console.log(`❌ ${(r.duration/1000).toFixed(1)}s`);
  }
  
  console.log('═'.repeat(50));
}

main();
