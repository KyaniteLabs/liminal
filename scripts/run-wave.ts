#!/usr/bin/env tsx
/**
 * Wave-based foreground generation
 * Usage: tsx run-wave.ts <wave-number>
 * Waves: 1-8 (6 tasks each = 48 total)
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';

const WAVES = [
  // Wave 1: MiniMax-M2.7 first 6 domains
  [
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'p5' },
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'glsl' },
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'three' },
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'strudel' },
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'hydra' },
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'remotion' },
  ],
  // Wave 2: MiniMax-M2.7 last 2 + M2.5 first 4
  [
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'html' },
    { provider: 'minimax', model: 'MiniMax-M2.7', domain: 'ascii' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'p5' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'glsl' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'three' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'strudel' },
  ],
  // Wave 3: MiniMax-M2.5 last 4
  [
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'hydra' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'remotion' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'html' },
    { provider: 'minimax', model: 'MiniMax-M2.5', domain: 'ascii' },
  ],
  // Wave 4: LM Studio Qwen3.5-9B all 8
  [
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'p5' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'glsl' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'three' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'strudel' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'hydra' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'remotion' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'html' },
    { provider: 'lmstudio', model: 'Qwen3.5-9B', domain: 'ascii' },
  ],
  // Wave 5: LM Studio Qwen3-Coder-40B all 8
  [
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'p5' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'glsl' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'three' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'strudel' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'hydra' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'remotion' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'html' },
    { provider: 'lmstudio', model: 'Qwen3-Coder-40B', domain: 'ascii' },
  ],
  // Wave 6: Ollama Gemma3-4B all 8
  [
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'p5' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'glsl' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'three' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'strudel' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'hydra' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'remotion' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'html' },
    { provider: 'ollama', model: 'Gemma3-4B', domain: 'ascii' },
  ],
  // Wave 7: Ollama Kimi-K2.5 first 6
  [
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'p5' },
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'glsl' },
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'three' },
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'strudel' },
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'hydra' },
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'remotion' },
  ],
  // Wave 8: Ollama Kimi-K2.5 last 2 + any missing
  [
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'html' },
    { provider: 'ollama', model: 'Kimi-K2.5', domain: 'ascii' },
  ],
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
  const waveNum = parseInt(process.argv[2] || '1');
  const wave = WAVES[waveNum - 1];
  
  if (!wave) {
    console.error(`Invalid wave number: ${waveNum}. Valid: 1-${WAVES.length}`);
    process.exit(1);
  }
  
  console.log(`🌊 WAVE ${waveNum}/${WAVES.length} (${wave.length} tasks)`);
  console.log('═'.repeat(60));
  
  const results = [];
  for (const task of wave) {
    process.stdout.write(`${task.provider}/${task.model}/${task.domain.padEnd(8)} ... `);
    const result = await runTask(task.provider, task.model, task.domain);
    results.push(result);
    
    if (result.success) {
      const r = result.result;
      console.log(`✅ ${(result.duration/1000).toFixed(1)}s ${r?.codeLength ? r.codeLength + ' chars' : ''}`);
    } else {
      console.log(`❌ ${(result.duration/1000).toFixed(1)}s ${result.error?.substring(0, 30)}`);
    }
  }
  
  const successful = results.filter(r => r.success).length;
  console.log('═'.repeat(60));
  console.log(`Wave ${waveNum} complete: ${successful}/${results.length} successful`);
  
  if (waveNum < WAVES.length) {
    console.log(`\nNext: tsx scripts/run-wave.ts ${waveNum + 1}`);
  } else {
    console.log('\n🎉 ALL WAVES COMPLETE!');
  }
}

main().catch(console.error);
