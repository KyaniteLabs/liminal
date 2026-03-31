#!/usr/bin/env node
/**
 * Regenerate all failing examples through improved Liminal pipeline
 * Uses RuntimeValidator + iteration extension (3→6)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANDING_ASSETS = path.join(process.cwd(), 'landing-assets');

// Failing examples to regenerate
const examples = [
  {
    name: 'shader-fractal',
    prompt: 'GLSL raymarched fractal landscape with volumetric fog',
    type: 'glsl',
    options: '--mode=shader'
  },
  {
    name: 'shader-warp',
    prompt: 'GLSL shader with warping noise patterns',
    type: 'glsl',
    options: '--mode=shader'
  },
  {
    name: 'shader-nebula',
    prompt: 'GLSL shader cosmic nebula with stars',
    type: 'glsl',
    options: '--mode=shader'
  },
  {
    name: 'three-rotating',
    prompt: 'Three.js rotating geometric shapes with dynamic lighting',
    type: 'three',
    options: '--mode=three'
  },
  {
    name: 'three-abstract',
    prompt: 'Three.js abstract geometric sculpture with iridescent materials',
    type: 'three',
    options: '--mode=three'
  },
  {
    name: 'hydra-liquid',
    prompt: 'liquid morphing shapes with feedback trails',
    type: 'hydra',
    options: '--mode=hydra'
  },
  {
    name: 'hydra-geometric',
    prompt: 'geometric patterns with rotating grid',
    type: 'hydra',
    options: '--mode=hydra'
  }
];

console.log('=== REGENERATING ALL FAILING EXAMPLES ===\n');
console.log('Pipeline improvements active:');
console.log('- Runtime validation (GLSL compile check, Three.js structure)');
console.log('- Iteration extension (3→6 if failing)');
console.log('- Code completeness check');
console.log('- HTML wrapper auto-generation\n');

const results = [];

for (const example of examples) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generating: ${example.name}`);
  console.log(`Prompt: "${example.prompt}"`);
  console.log(`${'='.repeat(60)}`);
  
  const outputDir = path.join(LANDING_ASSETS, `regen-${example.name}`);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // Run Liminal with improved pipeline
    const cmd = `npx tsx src/cli.ts generate \
      -p "${example.prompt}" \
      ${example.options} \
      --output ${outputDir} \
      --max-iterations 6 \
      --min-quality 0.70 \
      2>&1`;
    
    console.log('Running:', cmd.replace(/\s+/g, ' '));
    console.log('');
    
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe'
    });
    
    console.log(output);
    
    // Check what was generated
    const files = fs.readdirSync(outputDir);
    console.log('Generated files:', files);
    
    results.push({
      name: example.name,
      status: 'success',
      files: files
    });
    
  } catch (err) {
    console.error('Generation failed:', err.message);
    if (err.stdout) console.log('Stdout:', err.stdout.toString());
    if (err.stderr) console.error('Stderr:', err.stderr.toString());
    
    results.push({
      name: example.name,
      status: 'failed',
      error: err.message
    });
  }
}

console.log('\n' + '='.repeat(60));
console.log('REGENERATION COMPLETE');
console.log('='.repeat(60));

const successCount = results.filter(r => r.status === 'success').length;
console.log(`\nSuccess: ${successCount}/${examples.length}`);

results.forEach(r => {
  const icon = r.status === 'success' ? '✓' : '✗';
  console.log(`${icon} ${r.name}`);
  if (r.files) {
    console.log(`  Files: ${r.files.join(', ')}`);
  }
  if (r.error) {
    console.log(`  Error: ${r.error}`);
  }
});
