#!/usr/bin/env node
/**
 * Focused QA Test - Key domains only
 */

import { run } from './dist/index.js';
import fs from 'fs';

const TESTS = [
  { domain: 'p5', prompt: 'Blue particle system', expected: 'createCanvas', desc: 'Core visual domain' },
  { domain: 'html', prompt: 'Landing page hero', expected: '<!DOCTYPE', desc: 'Fixed routing' },
  { domain: 'three', prompt: '3D cube with lighting', expected: 'THREE.', desc: '3D domain' },
  { domain: 'glsl', prompt: 'Plasma shader', expected: 'void main', desc: 'Shader domain' },
];

console.log('🧪 FOCUSED QA TEST - 4 Key Domains\n');

for (let i = 0; i < TESTS.length; i++) {
  const test = TESTS[i];
  console.log(`[${i+1}/4] ${test.domain}: ${test.desc}`);
  
  try {
    const start = Date.now();
    const result = await run(test.prompt, {
      maxIterations: 1,
      output: `output/qa-focus/${test.domain}`,
      project: `qa-${test.domain}`,
    });
    const duration = Date.now() - start;
    
    const hasExpected = result.code?.includes(test.expected);
    console.log(`   ${hasExpected ? '✅' : '❌'} ${duration}ms | Score: ${result.finalScore?.toFixed(2) || 'N/A'}`);
    console.log(`      Generator used: ${result.code?.includes(test.expected) ? 'Correct' : 'Check manually'}`);
  } catch (err) {
    console.log(`   ❌ ERROR: ${err.message.substring(0, 60)}`);
  }
  
  if (i < TESTS.length - 1) await new Promise(r => setTimeout(r, 1000));
}

console.log('\n✅ Focused QA complete');
