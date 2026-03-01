#!/usr/bin/env node

/**
 * Performance benchmarks for Atelier
 * Tests iteration speed and memory usage
 */

import { run } from '../src/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Performance requirements
const MAX_ITERATION_TIME = 5 * 60 * 1000; // 5 minutes in ms
const MAX_MEMORY_USAGE = 500 * 1024 * 1024; // 500MB in bytes

// Simple prompts for benchmarking
const BENCHMARK_PROMPTS = [
  'Create a simple particle system',
  'Generate a cellular automata',
  'Make an interactive sketch'
];

async function benchmarkIteration(prompt) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  try {
    const result = await run(prompt, {
      output: './benchmark-output',
      project: `benchmark-${Date.now()}`
    });

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;

    const duration = endTime - startTime;
    const memoryUsed = endMemory - startMemory;

    return {
      success: true,
      duration,
      memoryUsed,
      withinTimeLimit: duration <= MAX_ITERATION_TIME,
      withinMemoryLimit: memoryUsed <= MAX_MEMORY_USAGE,
      result
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: false,
      duration,
      error: error.message,
      withinTimeLimit: duration <= MAX_ITERATION_TIME
    };
  }
}

async function runBenchmarks() {
  console.log('🚀 Atelier Performance Benchmarks');
  console.log('===================================\n');

  console.log('Performance Requirements:');
  console.log(`  • Max iteration time: ${MAX_ITERATION_TIME / 1000}s (${MAX_ITERATION_TIME / 60000}min)`);
  console.log(`  • Max memory usage: ${MAX_MEMORY_USAGE / 1024 / 1024}MB\n`);

  const results = [];

  for (let i = 0; i < BENCHMARK_PROMPTS.length; i++) {
    const prompt = BENCHMARK_PROMPTS[i];
    console.log(`\n📊 Benchmark ${i + 1}/${BENCHMARK_PROMPTS.length}`);
    console.log(`   Prompt: "${prompt}"`);

    const result = await benchmarkIteration(prompt);

    if (result.success) {
      console.log(`   ✅ Success`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`   Memory: ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Time Status: ${result.withinTimeLimit ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Memory Status: ${result.withinMemoryLimit ? '✅ PASS' : '❌ FAIL'}`);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`   Time Status: ${result.withinTimeLimit ? '✅ PASS' : '❌ FAIL'}`);
    }

    results.push({
      prompt,
      ...result
    });

    // Small delay between benchmarks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n📋 Summary');
  console.log('===========');

  const successful = results.filter(r => r.success).length;
  const timePasses = results.filter(r => r.withinTimeLimit).length;
  const memoryPasses = results.filter(r => r.withinMemoryLimit).length;

  console.log(`Successful Iterations: ${successful}/${results.length}`);
  console.log(`Time Limits Passed: ${timePasses}/${results.length}`);
  console.log(`Memory Limits Passed: ${memoryPasses}/${results.length}`);

  const allPassed = successful === results.length &&
                   timePasses === results.length &&
                   memoryPasses === results.length;

  if (allPassed) {
    console.log('\n✅ All benchmarks PASSED!');
  } else {
    console.log('\n❌ Some benchmarks FAILED');
  }

  // Create benchmark output directory
  await fs.mkdir('./benchmark-output', { recursive: true });

  // Save results
  const reportPath = './benchmark-output/report.json';
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    requirements: {
      maxIterationTime: MAX_ITERATION_TIME,
      maxMemoryUsage: MAX_MEMORY_USAGE
    },
    results
  }, null, 2));

  console.log(`\n📄 Report saved to: ${reportPath}`);

  return allPassed;
}

// Run benchmarks
runBenchmarks()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });