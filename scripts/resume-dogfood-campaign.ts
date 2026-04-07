#!/usr/bin/env node
/**
 * Resume Dogfood Campaign - Skip completed, continue remaining
 */

import { LLMClient } from '../dist/llm/LLMClient.js';
import { P5GeneratorV2 } from '../dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from '../dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../dist/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../dist/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../dist/generators/tone/ToneGenerator.js';
import { RemotionGenerator } from '../dist/generators/remotion/RemotionGenerator.js';
import { HTMLWebGenerator } from '../dist/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../dist/generators/ascii/ASCIIArtGenerator.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums', Generator: StrudelGenerator },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb', Generator: ToneGenerator },
  { name: 'remotion', prompt: 'Create a typing text animation video component', Generator: RemotionGenerator },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', Generator: HTMLWebGenerator },
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape', Generator: ASCIIArtGenerator },
];

const MODELS = [
  { name: 'gemma3:4b', model: 'gemma3:4b' },
  { name: 'qwen3.5:2b', model: 'qwen3.5:2b' },
  { name: 'phi4-mini', model: 'phi4-mini:latest' },
  { name: 'granite4:1b', model: 'granite4:1b' },
  { name: 'gemma4', model: 'gemma4:latest' },
  { name: 'lfm2.5', model: 'lfm2.5-thinking:1.2b' },
];

function getCompletedTests(): Set<string> {
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  const completed = new Set<string>();
  
  if (!fs.existsSync(landingDir)) return completed;
  
  const files = fs.readdirSync(landingDir);
  for (const file of files) {
    if (file.endsWith('.html') && file !== 'index.html') {
      completed.add(file.replace('.html', ''));
    }
  }
  return completed;
}

interface DogfoodResult {
  domain: string;
  model: string;
  success: boolean;
  code: string;
  outputPath: string;
  error?: string;
  duration: number;
}

const RESULTS: DogfoodResult[] = [];

function formatError(context: string, error: unknown): string {
  if (error instanceof Error) return `${context}: ${error.message}`;
  return `${context}: ${String(error)}`;
}

async function runSingleTest(domain: typeof DOMAINS[0], model: typeof MODELS[0]): Promise<DogfoodResult> {
  console.log(`\n🔄 Running: ${domain.name} × ${model.name}`);

  const startTime = Date.now();
  const outputPath = `landing-live/${domain.name}-${model.name}.html`;
  const fullOutputPath = path.join(PROJECT_ROOT, outputPath);

  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: 'http://localhost:11434/v1',
      model: model.model,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - startTime;

    fs.writeFileSync(fullOutputPath, code);
    console.log(`  ✅ Success (${duration}ms) → ${outputPath}`);

    return { domain: domain.name, model: model.name, success: true, code, outputPath, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = formatError('Generation failed', error);
    console.log(`  ❌ Failed (${duration}ms): ${errorMsg}`);

    const errorOutput = `<!DOCTYPE html><html><head><title>ERROR</title></head><body><h1>❌ ${domain.name} × ${model.name}</h1><p>${errorMsg}</p></body></html>`;
    fs.writeFileSync(fullOutputPath, errorOutput);

    return { domain: domain.name, model: model.name, success: false, code: '', outputPath, error: errorMsg, duration };
  }
}

async function main() {
  const completed = getCompletedTests();
  console.log('🐕 Resuming Dogfood Campaign');
  console.log(`📊 Already completed: ${completed.size} tests`);
  console.log('');

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) {
    fs.mkdirSync(landingDir, { recursive: true });
  }

  let skipped = 0;
  let run = 0;

  for (const domain of DOMAINS) {
    for (const model of MODELS) {
      const testKey = `${domain.name}-${model.name}`;
      
      if (completed.has(testKey)) {
        console.log(`⏭️  Skipping ${testKey} (already completed)`);
        skipped++;
        continue;
      }

      const result = await runSingleTest(domain, model);
      RESULTS.push(result);
      run++;
    }
  }

  // Load existing report if present
  const reportPath = path.join(PROJECT_ROOT, 'dogfood-report.json');
  let existingResults: DogfoodResult[] = [];
  
  if (fs.existsSync(reportPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      existingResults = existing.results || [];
    } catch { /* ignore */ }
  }

  // Merge results
  const allResults = [...existingResults, ...RESULTS];
  
  const report = {
    timestamp: new Date().toISOString(),
    total: allResults.length,
    success: allResults.filter(r => r.success).length,
    failed: allResults.filter(r => !r.success).length,
    results: allResults,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUME COMPLETE');
  console.log('='.repeat(50));
  console.log(`Skipped: ${skipped}`);
  console.log(`New runs: ${run}`);
  console.log(`Total in report: ${report.total}`);
  console.log(`✅ Success: ${report.success}`);
  console.log(`❌ Failed: ${report.failed}`);
  console.log(`📁 Report: ${reportPath}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
