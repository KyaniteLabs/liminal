import { run } from './src/index.ts';
import { promises as fs } from 'fs';
import path from 'path';

const MODELS = [
  { name: 'MiniMax-M2.7', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.7', key: process.env.MINIMAX_API_KEY },
  { name: 'MiniMax-M2.5', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.5', key: process.env.MINIMAX_API_KEY },
  { name: 'MiniMax-M2.1', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.1', key: process.env.MINIMAX_API_KEY },
  { name: 'Qwen3.5-9B', baseUrl: 'http://localhost:1234/v1', model: 'qwen3.5-9b' },
  { name: 'Qwen3-Coder-40B', baseUrl: 'http://localhost:1234/v1', model: 'qwen3-coder-next-reap-40b-a3b-i1' },
  { name: 'Gemma3-4B', baseUrl: 'http://localhost:11434/v1', model: 'gemma3:4b' },
  { name: 'Kimi-K2.5', baseUrl: 'http://localhost:11434/v1', model: 'kimi-k2.5:cloud' },
];

const PROMPTS = [
  { domain: 'p5', prompt: 'Create a p5.js particle fireworks simulation' },
  { domain: 'p5', prompt: 'Create a p5.js generative ocean with Perlin noise' },
  { domain: 'p5', prompt: 'Create a p5.js synthwave neon grid' },
  { domain: 'glsl', prompt: 'Create a GLSL cosmic nebula shader' },
  { domain: 'glsl', prompt: 'Create a GLSL plasma effect shader' },
  { domain: 'three', prompt: 'Create a Three.js abstract geometric sculpture' },
];

async function main() {
  const results = [];
  
  for (const model of MODELS) {
    console.log(`\n🤖 ${model.name}`);
    process.env.LIMINAL_LLM_BASE_URL = model.baseUrl;
    process.env.LIMINAL_LLM_MODEL = model.model;
    if (model.key) process.env.LIMINAL_LLM_API_KEY = model.key;
    
    for (const test of PROMPTS) {
      const outputDir = `examples/generated/${model.name}/${test.domain}`;
      await fs.mkdir(outputDir, { recursive: true });
      
      try {
        console.log(`  Generating: ${test.domain}...`);
        const result = await run(test.prompt, { 
          maxIterations: 3,
          galleryDir: outputDir
        });
        
        const fileName = `${test.domain}-${Date.now()}.js`;
        await fs.writeFile(path.join(outputDir, fileName), result.code);
        
        results.push({
          model: model.name,
          domain: test.domain,
          prompt: test.prompt,
          status: 'success',
          codeLength: result.code.length,
          iterations: result.iterations,
          score: result.finalScore
        });
        
        console.log(`    ✅ ${result.code.length} chars, ${result.iterations} iter, score ${result.finalScore}`);
      } catch (e) {
        results.push({
          model: model.name,
          domain: test.domain,
          prompt: test.prompt,
          status: 'failed',
          error: e instanceof Error ? e.message : String(e)
        });
        console.log(`    ❌ ${e instanceof Error ? e.message.substring(0, 50) : 'Failed'}`);
      }
    }
  }
  
  await fs.writeFile('examples/results.json', JSON.stringify(results, null, 2));
  console.log(`\n✨ Complete: ${results.filter(r => r.status === 'success').length}/${results.length} generated`);
}

main();
