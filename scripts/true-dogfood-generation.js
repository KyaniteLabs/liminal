#!/usr/bin/env node
/**
 * TRUE DOGFOOD: Generate examples using actual Ralph-Wiggum loop
 * NO MANUAL FIXES - show real scores, including failures
 */

import { run } from '../dist/index.js';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = './landing-assets/real-dogfood';

// Create output directory
await fs.mkdir(OUTPUT_DIR, { recursive: true });

// TRUE prompts - what we actually want to see Liminal generate
const dogfoodPrompts = [
  {
    id: 'p5-cyberpunk',
    prompt: 'p5.js cyberpunk city with neon lights and rain',
    iterations: 3,
    minQuality: 0.6
  },
  {
    id: 'p5-fireworks',
    prompt: 'p5.js fireworks with particle physics',
    iterations: 3,
    minQuality: 0.6
  },
  {
    id: 'shader-plasma', 
    prompt: 'GLSL shader animated plasma effect',
    iterations: 3,
    minQuality: 0.7,
    domain: 'glsl'
  },
  {
    id: 'shader-nebula',
    prompt: 'GLSL shader cosmic nebula with stars',
    iterations: 3,
    minQuality: 0.7,
    domain: 'glsl'
  },
  {
    id: 'three-abstract',
    prompt: 'Three.js abstract sculpture with iridescent material',
    iterations: 3,
    minQuality: 0.7,
    domain: 'three'
  },
  {
    id: 'three-particles',
    prompt: 'Three.js 3D particle system with physics',
    iterations: 3,
    minQuality: 0.7,
    domain: 'three'
  }
];

process.env.LIMINAL_LLM_PROVIDER = 'minimax';
process.env.LIMINAL_LLM_MODEL = 'MiniMax-M2.7';

const results = [];

for (const item of dogfoodPrompts) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎨 TRUE DOGFOOD: ${item.id}`);
  console.log(`   Prompt: "${item.prompt}"`);
  console.log(`   Iterations: ${item.iterations}, Min Quality: ${item.minQuality}`);
  console.log('='.repeat(60));
  
  try {
    const result = await run(item.prompt, {
      maxIterations: item.iterations,
      minQualityScore: item.minQuality,
      output: OUTPUT_DIR,
      project: item.id,
      collabDomain: item.domain || 'p5',
      tolerateErrors: true
    });
    
    // Save metadata with HONEST scores
    const metadata = {
      id: item.id,
      prompt: item.prompt,
      iterations: result.iterations,
      finalScore: result.finalScore,
      completed: result.completed,
      reason: result.reason,
      timestamp: result.timestamp,
      duration: result.duration,
      files: {
        js: result.jsPath,
        html: result.htmlPath
      }
    };
    
    await fs.writeFile(
      path.join(OUTPUT_DIR, `${item.id}-metadata.json`),
      JSON.stringify(metadata, null, 2)
    );
    
    results.push({
      id: item.id,
      success: true,
      score: result.finalScore,
      iterations: result.iterations,
      reason: result.reason
    });
    
    console.log(`\n✅ Result: ${result.iterations} iterations, score ${result.finalScore.toFixed(2)}`);
    console.log(`   Status: ${result.completed ? 'Completed' : 'Stopped'} (${result.reason})`);
    
  } catch (err) {
    console.log(`\n❌ FAILED: ${err.message}`);
    
    results.push({
      id: item.id,
      success: false,
      error: err.message
    });
  }
  
  // Delay between runs
  await new Promise(r => setTimeout(r, 2000));
}

// Print honest summary
console.log('\n' + '='.repeat(60));
console.log('TRUE DOGFOOD SUMMARY (No Cherry-Picking)');
console.log('='.repeat(60));

for (const r of results) {
  const status = r.success ? `★ ${r.score.toFixed(2)}` : '❌ FAILED';
  console.log(`${r.id.padEnd(20)} ${status} (${r.iterations || 0} iter)`);
}

const avgScore = results
  .filter(r => r.success)
  .reduce((a, r) => a + r.score, 0) / results.filter(r => r.success).length || 0;

console.log(`\nAverage Score: ${avgScore.toFixed(2)}`);
console.log(`Success Rate: ${results.filter(r => r.success).length}/${results.length}`);

// Save full report
await fs.writeFile(
  path.join(OUTPUT_DIR, 'true-dogfood-report.json'),
  JSON.stringify({
    generated: new Date().toISOString(),
    provider: 'minimax',
    model: 'MiniMax-M2.7',
    averageScore: avgScore,
    results
  }, null, 2)
);

console.log('\n🐕 TRUE DOGFOOD complete - no fixes, just facts.');
