#!/usr/bin/env node
/**
 * Dogfood Campaign - All Domains × All Available Models
 * 
 * Runs every domain through Liminal with every available LLM provider.
 * Populates landing-live/ gallery with results.
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

// Domain definitions with test prompts
const DOMAINS = [
  {
    name: 'p5',
    prompt: 'Create a calming blue particle system with flowing movement',
    Generator: P5GeneratorV2,
    check: (code: string) => code.includes('createCanvas') || code.includes('function setup'),
  },
  {
    name: 'glsl',
    prompt: 'Create an abstract plasma shader with animated colors',
    Generator: ShaderGenerator,
    check: (code: string) => code.includes('void main') && code.includes('gl_FragColor'),
  },
  {
    name: 'three',
    prompt: 'Create a rotating 3D cube with interesting lighting',
    Generator: ThreeGenerator,
    check: (code: string) => code.includes('THREE') || code.includes('Scene'),
  },
  {
    name: 'strudel',
    prompt: 'Create a simple techno beat pattern with drums',
    Generator: StrudelGenerator,
    check: (code: string) => code.includes('stack') || code.includes('sound') || code.includes('s('),
  },
  {
    name: 'hydra',
    prompt: 'Create a geometric video synth pattern with kaleidoscope effect',
    Generator: HydraGenerator,
    check: (code: string) => code.includes('.out(') || code.includes('osc(') || code.includes('shape('),
  },
  {
    name: 'tone',
    prompt: 'Create an ambient drone synthesizer with reverb',
    Generator: ToneGenerator,
    check: (code: string) => code.includes('Tone.') || code.includes('Synth'),
  },
  {
    name: 'revideo',
    prompt: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle',
    Generator: RemotionGenerator,
    check: (code: string) => code.includes('makeScene') || code.includes('@revideo/core'),
  },
  {
    name: 'html',
    prompt: 'Create a landing page with hero section and call to action',
    Generator: HTMLWebGenerator,
    check: (code: string) => code.includes('<!DOCTYPE html>') || code.includes('<html'),
  },
  {
    name: 'ascii',
    prompt: 'Create ASCII art of a mountain landscape',
    Generator: ASCIIArtGenerator,
    check: (code: string) => code.length > 50 && /[█▓▒░@#%*]/.test(code),
  },
];

// Model configurations (Ollama models)
const MODELS = [
  { name: 'gemma3:4b', model: 'gemma3:4b', available: true },
  { name: 'qwen3.5:2b', model: 'qwen3.5:2b', available: true },
  { name: 'phi4-mini', model: 'phi4-mini:latest', available: true },
  { name: 'granite4:1b', model: 'granite4:1b', available: true },
  { name: 'gemma4', model: 'gemma4:latest', available: true },
  { name: 'lfm2.5', model: 'lfm2.5-thinking:1.2b', available: true },
];

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
    // Create LLM client for this model
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: 'http://localhost:11434/v1',
      model: model.model,
      temperature: 0.7,
      maxTokens: 4096,
    });

    // Create generator
    const generator = new domain.Generator(llm);

    // Generate code
    const code = await generator.generate(domain.prompt);

    // Validate
    const isValid = domain.check(code);
    const duration = Date.now() - startTime;

    // Wrap in HTML if needed
    let output = code;
    if (!code.includes('<!DOCTYPE html>') && !code.includes('<html')) {
      output = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${domain.name} - ${model.name}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${domain.name} - ${model.name}</h1>
  <p><strong>Prompt:</strong> ${domain.prompt}</p>
  <p><strong>Valid:</strong> ${isValid ? '✅' : '❌'}</p>
  <pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
</body>
</html>`;
    }

    // Write output
    fs.writeFileSync(fullOutputPath, output);
    console.log(`  ✅ Success (${duration}ms) → ${outputPath}`);

    return {
      domain: domain.name,
      model: model.name,
      success: isValid,
      code,
      outputPath,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = formatError('Generation failed', error);
    console.log(`  ❌ Failed (${duration}ms): ${errorMsg}`);

    // Write error file
    const errorOutput = `<!DOCTYPE html>
<html>
<head>
  <title>${domain.name} - ${model.name} - ERROR</title>
</head>
<body>
  <h1>❌ Generation Failed</h1>
  <p><strong>Domain:</strong> ${domain.name}</p>
  <p><strong>Model:</strong> ${model.name}</p>
  <p><strong>Error:</strong> ${errorMsg}</p>
</body>
</html>`;
    fs.writeFileSync(fullOutputPath, errorOutput);

    return {
      domain: domain.name,
      model: model.name,
      success: false,
      code: '',
      outputPath,
      error: errorMsg,
      duration,
    };
  }
}

async function main() {
  console.log('🐕 Starting Dogfood Campaign');
  console.log(`📊 ${DOMAINS.length} domains × ${MODELS.length} models = ${DOMAINS.length * MODELS.length} tests`);
  console.log('');

  // Ensure landing-live directory exists
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) {
    fs.mkdirSync(landingDir, { recursive: true });
  }

  // Run all combinations
  for (const domain of DOMAINS) {
    for (const model of MODELS) {
      if (!model.available) {
        console.log(`\n⏭️  Skipping ${domain.name} × ${model.name} (not available)`);
        continue;
      }

      const result = await runSingleTest(domain, model);
      RESULTS.push(result);
    }
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    total: RESULTS.length,
    success: RESULTS.filter(r => r.success).length,
    failed: RESULTS.filter(r => !r.success).length,
    results: RESULTS,
  };

  const reportPath = path.join(PROJECT_ROOT, 'dogfood-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 DOGFOOD CAMPAIGN COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total: ${report.total}`);
  console.log(`✅ Success: ${report.success}`);
  console.log(`❌ Failed: ${report.failed}`);
  console.log(`📁 Report: ${reportPath}`);
  console.log('');

  // Domain breakdown
  console.log('📈 By Domain:');
  for (const domain of DOMAINS) {
    const domainResults = RESULTS.filter(r => r.domain === domain.name);
    const domainSuccess = domainResults.filter(r => r.success).length;
    console.log(`  ${domain.name}: ${domainSuccess}/${domainResults.length}`);
  }

  console.log('');
  console.log('📈 By Model:');
  for (const model of MODELS) {
    const modelResults = RESULTS.filter(r => r.model === model.name);
    const modelSuccess = modelResults.filter(r => r.success).length;
    console.log(`  ${model.name}: ${modelSuccess}/${modelResults.length}`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
