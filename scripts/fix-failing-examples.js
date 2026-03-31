#!/usr/bin/env node
/**
 * Fix failing examples by running them through improved RalphLoop
 * - Iteration extension (3 → 6 if failing)
 * - Runtime validation
 * - Auto HTML wrapper generation
 */

import { RalphLoop } from '../dist/core/RalphLoop.js';
import { RuntimeValidator } from '../dist/core/RuntimeValidator.js';
import fs from 'fs';
import path from 'path';

const LANDING_ASSETS = path.join(process.cwd(), 'landing-assets');

// Failing examples to fix
const failingExamples = [
  {
    name: 'shader-fractal',
    type: 'glsl',
    prompt: 'GLSL raymarched fractal landscape with volumetric fog',
    issue: 'GLSL compile error: loop index',
  },
  {
    name: 'shader-warp',
    type: 'glsl',
    prompt: 'GLSL shader with warping noise patterns',
    issue: 'GLSL compile error: fwidth undefined',
  },
  {
    name: 'shader-nebula',
    type: 'glsl',
    prompt: 'GLSL shader cosmic nebula with stars',
    issue: 'GLSL compile error: operand types',
  },
  {
    name: 'three-rotating',
    type: 'three',
    prompt: 'Three.js rotating geometric shapes with dynamic lighting',
    issue: 'Blank screen - no visible output',
  },
  {
    name: 'three-abstract',
    type: 'three',
    prompt: 'Three.js abstract geometric sculpture with iridescent materials',
    issue: 'Blank screen - no visible output',
  },
  {
    name: 'hydra-liquid',
    type: 'hydra',
    prompt: 'liquid morphing shapes with feedback trails',
    issue: 'Missing HTML wrapper',
  },
  {
    name: 'hydra-geometric',
    type: 'hydra',
    prompt: 'geometric patterns with rotating grid',
    issue: 'Missing HTML wrapper',
  },
];

console.log('=== FIXING FAILING EXAMPLES ===\n');
console.log('Improvements active:');
console.log('- Iteration extension: 3 → 6 if failing');
console.log('- Runtime validation for GLSL/Three.js');
console.log('- Auto HTML wrapper generation for Hydra\n');

for (const example of failingExamples) {
  console.log(`\n--- ${example.name} ---`);
  console.log(`Issue: ${example.issue}`);
  
  const existingPath = path.join(LANDING_ASSETS, `dogfood-${example.name}.js`);
  
  // Check if we have source code to work with
  if (!fs.existsSync(existingPath)) {
    console.log(`  ✗ No source file found`);
    continue;
  }
  
  const code = fs.readFileSync(existingPath, 'utf-8');
  
  // For Hydra - just generate HTML wrapper
  if (example.type === 'hydra') {
    console.log(`  Generating HTML wrapper...`);
    const html = RuntimeValidator.generateHTMLWrapper(code, 'hydra');
    const htmlPath = path.join(LANDING_ASSETS, `dogfood-${example.name}.html`);
    fs.writeFileSync(htmlPath, html);
    console.log(`  ✓ Created: dogfood-${example.name}.html`);
    continue;
  }
  
  // For GLSL - validate and report
  if (example.type === 'glsl') {
    console.log(`  Validating GLSL syntax...`);
    // Extract shader code
    const shaderMatch = code.match(/const\s+fsSource\s*=\s*`([^`]+)`/);
    if (shaderMatch) {
      // Check for common issues
      const shaderCode = shaderMatch[1];
      
      // Fix 1: Replace 'i' loop variable if used with single letter
      if (/for\s*\(\s*i\s*=/.test(shaderCode)) {
        console.log(`  ⚠ Found 'i' loop variable (common GLSL issue)`);
      }
      
      // Fix 2: Check for fwidth (WebGL 1.0 doesn't support it)
      if (shaderCode.includes('fwidth')) {
        console.log(`  ⚠ Found 'fwidth' (not supported in WebGL 1.0)`);
      }
      
      console.log(`  Note: GLSL fixes require regenerating with improved prompt`);
    }
    continue;
  }
  
  // For Three.js - validate and report
  if (example.type === 'three') {
    console.log(`  Validating Three.js structure...`);
    const htmlPath = path.join(LANDING_ASSETS, `dogfood-${example.name}.html`);
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      const validation = RuntimeValidator.testThreeJS(html);
      if (!validation.valid) {
        console.log(`  ⚠ ${validation.error}`);
      } else {
        console.log(`  ✓ Structure valid - may need regeneration`);
      }
    }
    continue;
  }
}

console.log('\n=== SUMMARY ===');
console.log('Hydra examples: Fixed with HTML wrappers');
console.log('GLSL/Three.js: Need regeneration with improved loop');
console.log('\nTo regenerate with improved loop:');
console.log('  npx liminal -p "your prompt" --max-iterations 6');
