#!/usr/bin/env node
/**
 * Strategic QA Dogfood Test Suite
 * Tests all 9 domains with varied prompts
 */

import { run } from './dist/index.js';
import fs from 'fs';
import path from 'path';

const TESTS = [
  // P5.js - Visual/Animation
  { domain: 'p5', prompt: 'Create a calming blue particle system with flowing movement', expected: 'createCanvas' },
  { domain: 'p5', prompt: 'Animated rainbow spiral with rotating colors', expected: 'setup' },
  
  // HTML - Web pages
  { domain: 'html', prompt: 'Create a landing page with hero section and call to action', expected: '<!DOCTYPE' },
  { domain: 'html', prompt: 'Personal portfolio website with navigation', expected: '<html' },
  
  // ASCII Art
  { domain: 'ascii', prompt: 'ASCII art of a mountain landscape at sunset', expected: '█' },
  { domain: 'ascii', prompt: 'Simple cat face using keyboard characters', expected: '@' },
  
  // Music - Tone.js
  { domain: 'music', prompt: 'Create an ambient drone synthesizer with reverb', expected: 'Tone.' },
  
  // Music - Strudel
  { domain: 'strudel', prompt: 'Create a simple techno beat pattern with drums', expected: 's(' },
  
  // Visual - Hydra
  { domain: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', expected: '.out(' },
  
  // 3D - Three.js
  { domain: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', expected: 'THREE.' },
  
  // Shader - GLSL
  { domain: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', expected: 'void main' },
];

const RESULTS = [];

async function runTest(test, index) {
  const startTime = Date.now();
  const outputDir = `output/qa-dogfood/test-${index}-${test.domain}`;
  
  console.log(`\n🔄 [${index + 1}/${TESTS.length}] ${test.domain}: "${test.prompt.substring(0, 50)}..."`);
  
  try {
    const result = await run(test.prompt, {
      maxIterations: 1,
      output: outputDir,
      project: `qa-${test.domain}-${index}`,
    });
    
    const duration = Date.now() - startTime;
    const success = result.code.includes(test.expected);
    
    console.log(`   ${success ? '✅' : '⚠️'}  ${duration}ms | Score: ${result.finalScore?.toFixed(2) || 'N/A'} | Contains "${test.expected}": ${success}`);
    
    RESULTS.push({
      domain: test.domain,
      prompt: test.prompt,
      success,
      score: result.finalScore,
      duration,
      codeLength: result.code?.length || 0,
      containsExpected: success,
    });
    
    return { success, error: null };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ ${duration}ms | ERROR: ${error.message.substring(0, 80)}`);
    
    RESULTS.push({
      domain: test.domain,
      prompt: test.prompt,
      success: false,
      error: error.message,
      duration,
    });
    
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🧪 STRATEGIC QA DOGFOOD TEST SUITE');
  console.log('='.repeat(80));
  console.log(`\nRunning ${TESTS.length} tests across 9 domains...\n`);
  
  for (let i = 0; i < TESTS.length; i++) {
    await runTest(TESTS[i], i);
    // Small delay between tests to avoid rate limiting
    if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  const successful = RESULTS.filter(r => r.success);
  const failed = RESULTS.filter(r => !r.success);
  
  console.log(`\nTotal: ${RESULTS.length}`);
  console.log(`✅ Success: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`Success Rate: ${((successful.length / RESULTS.length) * 100).toFixed(1)}%`);
  
  // By domain
  console.log('\nBy Domain:');
  const domains = [...new Set(TESTS.map(t => t.domain))];
  for (const domain of domains) {
    const domainTests = RESULTS.filter(r => r.domain === domain);
    const domainSuccess = domainTests.filter(r => r.success).length;
    console.log(`  ${domain}: ${domainSuccess}/${domainTests.length}`);
  }
  
  // Average scores
  const scores = successful.filter(r => r.score).map(r => r.score);
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`\nAverage Quality Score: ${avgScore.toFixed(3)}`);
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    total: RESULTS.length,
    success: successful.length,
    failed: failed.length,
    results: RESULTS,
  };
  fs.writeFileSync('output/qa-dogfood-report.json', JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: output/qa-dogfood-report.json`);
  
  console.log('\n' + '='.repeat(80));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
