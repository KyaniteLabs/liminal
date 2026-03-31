#!/usr/bin/env node
/**
 * Generate REAL dogfood examples using MiniMax API
 */

import { run, generateMusic, generateVisuals } from '../dist/index.js';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = './landing-assets';

// Real prompts for dogfood examples
const examples = [
  {
    name: 'p5-neon-cyberpunk',
    type: 'p5',
    prompt: 'p5.js cyberpunk city with neon lights, rain, and flying cars',
    options: { maxIterations: 1, project: 'dogfood-p5-neon' }
  },
  {
    name: 'p5-ocean-waves',
    type: 'p5', 
    prompt: 'p5.js realistic ocean waves with foam and seagulls',
    options: { maxIterations: 1, project: 'dogfood-p5-ocean' }
  },
  {
    name: 'p5-fireworks',
    type: 'p5',
    prompt: 'p5.js fireworks display with particle explosions',
    options: { maxIterations: 1, project: 'dogfood-p5-fireworks' }
  },
  {
    name: 'shader-plasma',
    type: 'shader',
    prompt: 'GLSL shader with animated plasma effect',
    options: { maxIterations: 1, project: 'dogfood-shader-plasma', collabDomain: 'glsl' }
  },
  {
    name: 'shader-nebula',
    type: 'shader',
    prompt: 'GLSL shader with cosmic nebula and stars',
    options: { maxIterations: 1, project: 'dogfood-shader-nebula', collabDomain: 'glsl' }
  },
  {
    name: 'three-abstract',
    type: 'three',
    prompt: 'Three.js abstract geometric sculpture with iridescent materials',
    options: { maxIterations: 1, project: 'dogfood-three-abstract', collabDomain: 'three' }
  },
  {
    name: 'music-ambient-drone',
    type: 'music',
    prompt: 'ambient drone soundscape with slowly evolving textures',
    musicOpts: { platform: 'strudel', bpm: 60 }
  },
  {
    name: 'music-techno-driving',
    type: 'music',
    prompt: 'driving techno beat with industrial percussion',
    musicOpts: { platform: 'strudel', bpm: 130 }
  },
  {
    name: 'hydra-liquid',
    type: 'hydra',
    prompt: 'liquid morphing shapes with feedback trails',
    visualOpts: { platform: 'hydra' }
  },
  {
    name: 'hydra-geometric',
    type: 'hydra',
    prompt: 'geometric patterns with rotating grid',
    visualOpts: { platform: 'hydra' }
  }
];

// Set MiniMax config
process.env.LIMINAL_LLM_PROVIDER = 'minimax';
process.env.LIMINAL_LLM_MODEL = 'MiniMax-M2.7';

async function generateExample(example) {
  console.log(`\n🎨 Generating: ${example.name}`);
  console.log(`   Prompt: "${example.prompt}"`);
  
  const start = Date.now();
  
  try {
    let result;
    
    if (example.type === 'p5' || example.type === 'shader' || example.type === 'three') {
      // Use main run() for visual outputs
      result = await run(example.prompt, {
        ...example.options,
        output: OUTPUT_DIR,
        tolerateErrors: true
      });
    } else if (example.type === 'music') {
      // Use generateMusic for music
      result = await generateMusic(example.prompt, example.musicOpts);
      result = { code: result.code };
    } else if (example.type === 'hydra') {
      // Use generateVisuals for hydra
      result = await generateVisuals({
        prompt: example.prompt,
        ...example.visualOpts
      });
      result = { code: result.code };
    }
    
    const duration = Date.now() - start;
    
    // Save the code
    const ext = example.type === 'music' ? 'strudel.js' : example.type === 'hydra' ? 'js' : 'js';
    const filename = `dogfood-${example.name}.${ext}`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    await fs.writeFile(filepath, result.code);
    
    console.log(`   ✅ Success (${duration}ms) → ${filename}`);
    
    return {
      name: example.name,
      success: true,
      duration,
      filename,
      codeLength: result.code.length
    };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return {
      name: example.name,
      success: false,
      error: err.message
    };
  }
}

async function main() {
  console.log('🚀 Generating REAL dogfood examples with MiniMax-M2.7');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const example of examples) {
    const result = await generateExample(example);
    results.push(result);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${examples.length}`);
  console.log(`❌ Failed: ${failed.length}/${examples.length}`);
  
  if (failed.length > 0) {
    console.log('\nFailed examples:');
    failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }
  
  // Save manifest
  const manifest = {
    generated: new Date().toISOString(),
    provider: 'minimax',
    model: 'MiniMax-M2.7',
    results
  };
  
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'real-dogfood-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('\n✨ Done! Real dogfood examples saved.');
}

main().catch(console.error);
