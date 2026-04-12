#!/usr/bin/env node
/**
 * Evaluate all landing page examples with CreativeEvaluator
 * Get REAL quality scores (not estimates)
 */

import { CreativeEvaluator } from '../dist/core/CreativeEvaluator.js';
import fs from 'fs';
import path from 'path';

const LANDING_ASSETS = path.join(process.cwd(), 'landing-assets');

// Extract inline code from HTML files
function extractCodeFromHTML(htmlPath) {
  const content = fs.readFileSync(htmlPath, 'utf-8');
  
  // Extract code between <script> tags
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    return scriptMatch[1].trim();
  }
  
  return null;
}

// Get code from file (HTML inline or JS file)
function getCode(fileName) {
  const htmlPath = path.join(LANDING_ASSETS, fileName + '.html');
  const jsPath = path.join(LANDING_ASSETS, fileName + '.js');
  
  if (fs.existsSync(htmlPath)) {
    const inline = extractCodeFromHTML(htmlPath);
    if (inline) return { code: inline, source: 'html-inline' };
  }
  
  if (fs.existsSync(jsPath)) {
    return { code: fs.readFileSync(jsPath, 'utf-8'), source: 'js-file' };
  }
  
  // Check for .strudel.js files
  const strudelPath = path.join(LANDING_ASSETS, fileName + '.strudel.js');
  if (fs.existsSync(strudelPath)) {
    return { code: fs.readFileSync(strudelPath, 'utf-8'), source: 'strudel' };
  }
  
  return null;
}

// Determine domain from filename.
// Keep historical file names like `dogfood-remotion-title`, but evaluate them
// using the active Revideo domain hint.
function getDomain(fileName) {
  if (fileName.includes('shader')) return 'glsl';
  if (fileName.includes('three')) return 'three';
  if (fileName.includes('hydra')) return 'hydra';
  if (fileName.includes('strudel') || fileName.includes('music')) return 'music';
  if (fileName.includes('remotion')) return 'revideo';
  return 'p5';
}

// Examples to evaluate
const examples = [
  'dogfood-p5-jellyfish',
  'dogfood-p5-neon-cyberpunk',
  'dogfood-p5-ocean-final',
  'dogfood-shader-fractal',
  'dogfood-shader-warp',
  'dogfood-shader-nebula-final',
  'dogfood-shader-plasma-final',
  'dogfood-three-crystal',
  'dogfood-three-rotating',
  'dogfood-three-abstract-final',
  'dogfood-hydra-liquid',
  'dogfood-hydra-geometric',
  'dogfood-music-techno-driving',
  'dogfood-music-ambient-drone',
  'dogfood-remotion-title',
];

console.log('='.repeat(60));
console.log('REAL DOGFOOD QUALITY EVALUATION');
console.log('Using CreativeEvaluator.assess() on actual outputs');
console.log('='.repeat(60));
console.log('');

const results = [];

for (const example of examples) {
  const codeData = getCode(example);
  
  if (!codeData) {
    console.log(`❌ ${example}: File not found`);
    continue;
  }
  
  const domain = getDomain(example);
  
  try {
    const assessment = CreativeEvaluator.assess(codeData.code, { domain });
    
    results.push({
      name: example,
      domain,
      score: assessment.score,
      passed: assessment.passed,
      issues: assessment.issues,
      technicalScore: assessment.technicalScore,
      creativeScore: assessment.creativeScore,
      codeLength: codeData.code.length,
      source: codeData.source,
    });
    
    const status = assessment.passed ? '✅ PASS' : '❌ FAIL';
    const scoreStr = assessment.score.toFixed(2);
    console.log(`${status} ${example}`);
    console.log(`   Score: ${scoreStr} | Technical: ${assessment.technicalScore.toFixed(2)} | Creative: ${assessment.creativeScore.toFixed(2)}`);
    if (assessment.issues.length > 0) {
      console.log(`   Issues: ${assessment.issues.slice(0, 2).join(', ')}${assessment.issues.length > 2 ? '...' : ''}`);
    }
    console.log('');
  } catch (err) {
    console.log(`❌ ${example}: Evaluation error - ${err.message}`);
  }
}

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

const passed = results.filter(r => r.passed).length;
const avgScore = results.reduce((a, b) => a + b.score, 0) / results.length;

console.log(`Total Evaluated: ${results.length}`);
console.log(`Passed (≥0.70): ${passed}`);
console.log(`Failed: ${results.length - passed}`);
console.log(`Average Score: ${avgScore.toFixed(2)}`);
console.log('');

// Save results
const outputPath = path.join(LANDING_ASSETS, 'real-evaluation-results.json');
fs.writeFileSync(outputPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  evaluator: 'CreativeEvaluator.assess()',
  summary: {
    total: results.length,
    passed,
    failed: results.length - passed,
    averageScore: avgScore,
  },
  results,
}, null, 2));

console.log(`Results saved to: ${outputPath}`);

// Output in landing page format
console.log('');
console.log('LANDING PAGE SCORES (copy these):');
console.log('-'.repeat(60));
for (const r of results) {
  const shortName = r.name.replace('dogfood-', '');
  console.log(`${shortName}: ★ ${r.score.toFixed(2)} ${r.passed ? '✓' : '✗'}`);
}
