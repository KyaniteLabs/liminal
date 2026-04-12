#!/usr/bin/env node
/**
 * Evaluate all landing page examples with CreativeEvaluator
 * Get REAL quality scores (not estimates)
 */

import { CreativeEvaluator } from '../../dist/core/CreativeEvaluator.js';
import fs from 'fs';
import path from 'path';

const CANDIDATE_DIRS = [
  path.join(process.cwd(), 'landing-assets'),
  path.join(process.cwd(), 'landing-live'),
  path.join(process.cwd(), 'artifacts', 'landing-live'),
];

const OUTPUT_DIR = CANDIDATE_DIRS.find((dir) => fs.existsSync(dir)) ?? path.join(process.cwd(), 'landing-live');

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function findByBasename(...names) {
  for (const dir of CANDIDATE_DIRS) {
    for (const file of walkFiles(dir)) {
      if (names.includes(path.basename(file))) return file;
    }
  }
  return null;
}

// Extract inline code from HTML files
function decodeHtmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractCodeFromHTML(htmlPath) {
  const content = fs.readFileSync(htmlPath, 'utf-8');

  // Many historical gallery artifacts render generated code inside <pre>.
  // Decode that code before evaluation so the evaluator judges the artifact,
  // not just the wrapper page around it.
  const preMatch = content.match(/<pre>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    return decodeHtmlEntities(preMatch[1]).trim();
  }

  // Strudel and similar wrappers often place the visible artifact in a code div
  // while reserving <script> for helper UI like "open in REPL".
  const codeDivMatch = content.match(/<div[^>]*class=["'][^"']*code[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (codeDivMatch) {
    return decodeHtmlEntities(codeDivMatch[1]).trim();
  }

  // Extract code between <script> tags only after trying visible code containers.
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    return scriptMatch[1].trim();
  }
  
  return null;
}

// Get code from file (HTML inline or JS file)
function getCode(fileName) {
  const htmlPath = findByBasename(fileName + '.html');
  const jsPath = findByBasename(fileName + '.js');
  
  if (htmlPath && fs.existsSync(htmlPath)) {
    const inline = extractCodeFromHTML(htmlPath);
    if (inline) return { code: inline, source: 'html-inline' };
    return { code: fs.readFileSync(htmlPath, 'utf-8'), source: 'html-file' };
  }
  
  if (jsPath && fs.existsSync(jsPath)) {
    return { code: fs.readFileSync(jsPath, 'utf-8'), source: 'js-file' };
  }
  
  // Check for .strudel.js files
  const strudelPath = findByBasename(fileName + '.strudel.js');
  if (strudelPath && fs.existsSync(strudelPath)) {
    return { code: fs.readFileSync(strudelPath, 'utf-8'), source: 'strudel' };
  }
  
  return null;
}

// Determine domain from filename.
// Keep historical file names like `dogfood-remotion-title`, but evaluate them
// using the active Revideo domain hint.
function getDomain(fileName) {
  if (fileName.includes('ascii')) return 'ascii';
  if (fileName.includes('html')) return 'html';
  if (fileName.includes('tone')) return 'tone';
  if (fileName.includes('p5')) return 'p5';
  if (fileName.includes('shader')) return 'glsl';
  if (fileName.includes('three')) return 'three';
  if (fileName.includes('hydra')) return 'hydra';
  if (fileName.includes('strudel') || fileName.includes('music')) return 'music';
  if (fileName.includes('revideo') || fileName.includes('remotion')) return 'revideo';
  return 'p5';
}

function discoverExamples() {
  const stems = new Set();
  const ignored = new Set(['index', 'gallery-data', 'real-evaluation-results']);
  for (const dir of CANDIDATE_DIRS) {
    for (const file of walkFiles(dir)) {
      const base = path.basename(file);
      let stem = null;
      if (base.endsWith('.strudel.js')) stem = base.slice(0, -'.strudel.js'.length);
      else if (base.endsWith('.html')) stem = base.slice(0, -'.html'.length);
      else if (base.endsWith('.js')) stem = base.slice(0, -'.js'.length);
      if (!stem || ignored.has(stem)) continue;
      if (!/(p5|glsl|shader|three|hydra|strudel|music|tone|html|ascii|remotion|revideo)/.test(stem)) continue;
      stems.add(stem);
    }
  }
  return [...stems].sort();
}

const examples = discoverExamples();

console.log(`Asset roots: ${CANDIDATE_DIRS.filter((dir) => fs.existsSync(dir)).join(', ')}`);
console.log(`Discovered examples: ${examples.length}`);
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
const outputPath = path.join(OUTPUT_DIR, 'real-evaluation-results.json');
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
