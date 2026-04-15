#!/usr/bin/env node
/**
 * 🔥 ULTRA SUPREME DOGFOOD - LM STUDIO FOCUS 🔥
 * 
 * Focus on LM Studio local models with parallel execution
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
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement', Generator: P5GeneratorV2, icon: '🎨' },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', Generator: ShaderGenerator, icon: '✨' },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', Generator: ThreeGenerator, icon: '🧊' },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums', Generator: StrudelGenerator, icon: '🎵' },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', Generator: HydraGenerator, icon: '📺' },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb', Generator: ToneGenerator, icon: '🎹' },
  { name: 'revideo', prompt: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle', Generator: RemotionGenerator, icon: '🎬' },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', Generator: HTMLWebGenerator, icon: '🌐' },
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape', Generator: ASCIIArtGenerator, icon: '🏔️' },
];

interface ModelConfig {
  name: string;
  model: string;
  baseUrl: string;
}

async function detectLMStudioModels(): Promise<ModelConfig[]> {
  try {
    const res = await fetch('http://localhost:1234/v1/models');
    const data = await res.json();
    return data.data.map((m: { id: string }) => ({
      name: m.id.replace(/[/:]/g, '-'),
      model: m.id,
      baseUrl: 'http://localhost:1234/v1',
    }));
  } catch {
    console.error('❌ LM Studio not available at localhost:1234');
    process.exit(1);
  }
}

interface Result {
  domain: string;
  model: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runTest(domain: typeof DOMAINS[0], model: ModelConfig): Promise<Result> {
  const start = Date.now();
  const outputPath = `landing-live/lmstudio-${domain.name}-${model.name}.html`;
  
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: model.baseUrl,
      model: model.model,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;

    // Generate styled HTML output
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${domain.icon} ${domain.name} - ${model.name}</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #fff; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .meta { display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap; }
    .badge { background: #2a2a2a; padding: 5px 15px; border-radius: 4px; border: 1px solid #444; }
    .success { color: #4ade80; }
    pre { background: #1a1a1a; padding: 20px; border-radius: 8px; overflow-x: auto; border: 1px solid #333; }
    code { font-family: 'SF Mono', Monaco, monospace; }
  </style>
</head>
<body>
  <h1>${domain.icon} ${domain.name.toUpperCase()} - ${model.name}</h1>
  <div class="meta">
    <span class="badge">🎯 ${model.name}</span>
    <span class="badge">⏱️ ${duration}ms</span>
    <span class="badge success">✅ SUCCESS</span>
  </div>
  <p><strong>Prompt:</strong> ${domain.prompt}</p>
  <pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
</body>
</html>`;

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), html);
    console.log(`  ✅ ${domain.name} × ${model.name} (${duration}ms)`);
    
    return { domain: domain.name, model: model.name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    const html = `<!DOCTYPE html><html><head><title>ERROR</title></head><body><h1>❌ ${domain.name} × ${model.name}</h1><p>${errorMsg}</p></body></html>`;
    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), html);
    
    console.log(`  ❌ ${domain.name} × ${model.name} (${duration}ms): ${errorMsg.slice(0, 100)}`);
    return { domain: domain.name, model: model.name, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log('🔥🔥🔥 ULTRA SUPREME LM STUDIO DOGFOOD 🔥🔥🔥\n');
  
  const models = await detectLMStudioModels();
  console.log(`📦 LM Studio Models: ${models.length}`);
  for (const m of models) console.log(`  • ${m.name}`);
  
  const totalTests = DOMAINS.length * models.length;
  console.log(`\n📊 Total: ${DOMAINS.length} domains × ${models.length} models = ${totalTests} tests\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  // Run ALL tests in parallel for maximum speed
  const promises: Promise<Result>[] = [];
  for (const domain of DOMAINS) {
    for (const model of models) {
      promises.push(runTest(domain, model));
    }
  }

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Generate report
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    success,
    failed,
    successRate: ((success / results.length) * 100).toFixed(1) + '%',
    duration: totalDuration + 'ms',
    models: models.map(m => m.name),
    results,
  };

  fs.writeFileSync(path.join(PROJECT_ROOT, 'dogfood-report-lmstudio.json'), JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('🔥 LM STUDIO DOGFOOD COMPLETE 🔥');
  console.log('='.repeat(60));
  console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`📊 Total: ${totalTests}`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Rate: ${report.successRate}`);
  console.log(`\n📁 Output: landing-live/lmstudio-*.html`);
}

main().catch(console.error);
