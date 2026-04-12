#!/usr/bin/env tsx
/**
 * Dogfood Test: Minimax M2.7 Through All Generators
 * 
 * Runs Minimax M2.7 through every Liminal generator with stress test prompts.
 * Collects detailed telemetry for diagnostics.
 * 
 * ONE TEST AT A TIME - foreground execution only
 */

import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';
import { RuntimeHealthMonitor } from '../src/guardrails/RuntimeHealthMonitor.js';

// Stress test prompts for each domain
const STRESS_TESTS = [
  {
    name: 'p5',
    prompt: 'Create an interactive particle system with mouse attraction, collision detection between particles, and dynamic color trails that fade over time. Add a gravity toggle on click.',
  },
  {
    name: 'three',
    prompt: 'Create a procedural terrain generator with Perlin noise, water reflection, day/night cycle lighting, and orbiting camera. Add floating particles above the terrain.',
  },
  {
    name: 'glsl',
    prompt: 'Create a ray-marched 3D scene with multiple SDF primitives (sphere, box, torus), soft shadows, ambient occlusion, and a colorful gradient sky. Animate the camera orbit.',
  },
  {
    name: 'strudel',
    prompt: 'Create a complex drum and bass pattern with layered breakbeats, sub bass wobbles, atmospheric pads, and a filtered amen break. Add swing and use Euclidean rhythms.',
  },
  {
    name: 'hydra',
    prompt: 'Create a feedback video synthesizer with multiple oscillators, color shifting, delay trails, and reactive scaling to an imagined audio input. Use geometric masks.',
  },
  {
    name: 'tone',
    prompt: 'Create a polysynth arpeggiator with reverb, delay, filter LFO, and sidechain compression. Add a generative melody that changes every 4 bars using a scale quantizer.',
  },
  {
    name: 'revideo',
    prompt: 'Create a Revideo kinetic typography scene with word-by-word reveal, elastic easing, gradient text fill, and a progress bar synced to a 120bpm beat grid.',
  },
  {
    name: 'html',
    prompt: 'Create a glassmorphism dashboard with animated charts, draggable widgets, dark mode toggle, and CSS grid layout. Add micro-interactions on hover and click.',
  },
  {
    name: 'ascii',
    prompt: 'Create an animated ASCII art scene of a bustling city with moving cars, blinking building lights, a scrolling marquee, and a day/night cycle effect.',
  },
];

const TELEMETRY_FILE = './logs/telemetry-minimax-m27.jsonl';
const OUTPUT_DIR = './dogfood-temp/minimax-m27';

interface TelemetryEntry {
  phase: 'test-runner';
  timestamp: string;
  model: string;
  domain: string;
  prompt: string;
  promptLength: number;
  success: boolean;
  iterations?: number;
  finalScore?: number;
  runtimeValid?: boolean;
  consoleErrors?: number;
  durationMs: number;
  generationMs?: number;
  runtimeMs?: number;
  error?: string;
  errorType?: string;
  codeLength?: number;
  outputPath?: string;
}

function logTelemetry(entry: TelemetryEntry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(TELEMETRY_FILE, line);
  console.log(`   [telemetry logged]`);
}

async function runStressTest(domain: typeof STRESS_TESTS[0], testNum: number, total: number) {
  console.log(`\n[${testNum}/${total}] Testing ${domain.name.toUpperCase()}`);
  console.log(`Prompt: ${domain.prompt.slice(0, 80)}...`);
  console.log('-'.repeat(70));
  
  const startTime = Date.now();
  const outputPath = path.join(OUTPUT_DIR, `${domain.name}.html`);
  
  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  try {
    console.log('   [calling Liminal generate...]');
    
    const result = await run(domain.prompt, {
      maxIterations: 5,
      output: outputPath,
      project: `dogfood-minimax-${domain.name}`,
      collabDomain: domain.name as any,
      chatMode: false,
    });
    
    const generationDuration = Date.now() - startTime;
    console.log(`   [generated in ${generationDuration}ms, ${result.code?.length || 0} chars]`);
    
    // Runtime validation
    console.log('   [runtime validation...]');
    const runtimeStart = Date.now();
    
    let runtimeValid = true;
    let consoleErrors = 0;
    let runtimeError = '';
    
    // Only validate visual domains
    const testableDomains = ['p5', 'three', 'glsl', 'html'];
    
    if (testableDomains.includes(domain.name) && result.code && result.code.length > 100) {
      try {
        const healthMonitor = new RuntimeHealthMonitor({ 
          durationMs: 3000, 
          disableSandbox: true 
        });
        const healthResult = await healthMonitor.quickCheck(result.code, domain.name);
        
        runtimeValid = healthResult.healthy && healthResult.metrics.consoleErrorCount === 0;
        consoleErrors = healthResult.metrics.consoleErrorCount;
        
        if (!runtimeValid) {
          runtimeError = healthResult.issues.join('; ') || `${consoleErrors} console errors`;
        }
      } catch (healthErr) {
        runtimeValid = false;
        runtimeError = healthErr instanceof Error ? healthErr.message : 'Runtime check failed';
      }
    }
    
    const runtimeDuration = Date.now() - runtimeStart;
    const totalDuration = Date.now() - startTime;
    
    // Determine success
    const success = runtimeValid;
    
    if (success) {
      console.log(`   ✅ SUCCESS | Score: ${result.finalScore?.toFixed(2) || 'N/A'} | Iterations: ${result.iterations}`);
    } else {
      console.log(`   ❌ FAILED | Runtime error: ${runtimeError.slice(0, 60)}`);
    }
    
    // Log telemetry
    logTelemetry({
      phase: 'test-runner',
      timestamp: new Date().toISOString(),
      model: 'minimax-m2.7',
      domain: domain.name,
      prompt: domain.prompt,
      promptLength: domain.prompt.length,
      success,
      iterations: result.iterations,
      finalScore: result.finalScore,
      runtimeValid,
      consoleErrors,
      durationMs: totalDuration,
      generationMs: generationDuration,
      runtimeMs: runtimeDuration,
      error: runtimeError || undefined,
      codeLength: result.code?.length,
      outputPath: fs.existsSync(outputPath) ? outputPath : undefined,
    });
    
    return success;
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
    
    console.log(`   ❌ ERROR | ${errorType}: ${errorMsg.slice(0, 80)}`);
    
    logTelemetry({
      phase: 'test-runner',
      timestamp: new Date().toISOString(),
      model: 'minimax-m2.7',
      domain: domain.name,
      prompt: domain.prompt,
      promptLength: domain.prompt.length,
      success: false,
      durationMs: duration,
      error: errorMsg,
      errorType,
    });
    
    return false;
  }
}

async function main() {
  console.log('\n🐕 DOGFOOD: Minimax M2.7 Through All Generators');
  console.log('='.repeat(70));
  console.log(`Model: Minimax M2.7`);
  console.log(`Total Tests: ${STRESS_TESTS.length}`);
  console.log(`Telemetry: ${TELEMETRY_FILE}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(70));
  
  // Clear telemetry file
  fs.mkdirSync(path.dirname(TELEMETRY_FILE), { recursive: true });
  fs.writeFileSync(TELEMETRY_FILE, '');
  
  // Verify Minimax API key
  if (!process.env.MINIMAX_API_KEY) {
    console.error('\n❌ MINIMAX_API_KEY not set in environment!');
    process.exit(1);
  }
  
  // Set Minimax configuration
  process.env.LIMINAL_LLM_PROVIDER = 'minimax';
  process.env.LIMINAL_LLM_MODEL = 'MiniMax-M2.7';
  process.env.LIMINAL_LLM_API_KEY = process.env.MINIMAX_API_KEY;
  process.env.LIMINAL_LLM_BASE_URL = 'https://api.minimaxi.chat/v1';
  
  console.log('\n📡 Configuration:');
  console.log(`   Provider: ${process.env.LIMINAL_LLM_PROVIDER}`);
  console.log(`   Model: ${process.env.LIMINAL_LLM_MODEL}`);
  console.log(`   Base URL: ${process.env.LIMINAL_LLM_BASE_URL}`);
  console.log(`   API Key: ${process.env.LIMINAL_LLM_API_KEY?.slice(0, 10)}...`);
  
  console.log('\n🚀 Starting tests (one at a time)...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < STRESS_TESTS.length; i++) {
    const success = await runStressTest(STRESS_TESTS[i], i + 1, STRESS_TESTS.length);
    if (success) passed++; else failed++;
    
    // Small delay between tests
    if (i < STRESS_TESTS.length - 1) {
      console.log('   [waiting 2s before next test...]');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total:  ${STRESS_TESTS.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / STRESS_TESTS.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));
  console.log(`\nTelemetry saved to: ${TELEMETRY_FILE}`);
  console.log('Outputs saved to: ${OUTPUT_DIR}');
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
