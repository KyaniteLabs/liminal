#!/usr/bin/env node
/**
 * ☁️ AGENT A - CLOUD PROVIDERS DOGFOOD (FAST VERSION)
 */

import { LLMClient } from './dist/llm/LLMClient.js';
import { P5GeneratorV2 } from './dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from './dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from './dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from './dist/generators/strudel/StrudelGenerator.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = __dirname;

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
];

const MINIMAX_KEY = process.env.MINIMAX_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

interface Result {
  provider: string;
  model: string;
  domain: string;
  success: boolean;
  duration: number;
  error?: string;
  notes?: string;
}

async function runTest(domain: typeof DOMAINS[0], modelConfig: any): Promise<Result> {
  const start = Date.now();
  try {
    const llm = new LLMClient({
      role: 'generator',
      baseUrl: modelConfig.baseUrl,
      model: modelConfig.model,
      apiKey: modelConfig.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    });

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - start;
    
    fs.writeFileSync(
      path.join(PROJECT_ROOT, 'landing-live', `cloud-a-${modelConfig.name}-${domain.name}.html`),
      code
    );
    
    console.log(`✅ ${modelConfig.name}/${domain.name} (${duration}ms)`);
    return { provider: modelConfig.provider, model: modelConfig.name, domain: domain.name, success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    const shortError = errorMsg.includes('529') ? 'API overloaded (529)' : 
                       errorMsg.includes('timeout') ? 'Timeout' : 
                       errorMsg.slice(0, 40);
    console.log(`❌ ${modelConfig.name}/${domain.name} (${duration}ms): ${shortError}`);
    return { provider: modelConfig.provider, model: modelConfig.name, domain: domain.name, success: false, duration, error: shortError };
  }
}

async function main() {
  console.log('☁️ AGENT A CLOUD DOGFOOD\n');
  console.log(`MiniMax: ${MINIMAX_KEY ? '✅' : '❌'} | OpenRouter: ${OPENROUTER_KEY ? '✅' : '❌'}\n`);

  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const results: Result[] = [];
  
  // MiniMax M2.7
  if (MINIMAX_KEY) {
    console.log('Testing MiniMax-M2.7...');
    const m27 = { provider: 'MiniMax', name: 'minimax-m27', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.7', apiKey: MINIMAX_KEY };
    for (const domain of DOMAINS) {
      results.push(await runTest(domain, m27));
    }
  }

  // MiniMax M2.5
  if (MINIMAX_KEY) {
    console.log('Testing MiniMax-M2.5...');
    const m25 = { provider: 'MiniMax', name: 'minimax-m25', baseUrl: 'https://api.minimaxi.chat/v1', model: 'MiniMax-M2.5', apiKey: MINIMAX_KEY };
    for (const domain of DOMAINS) {
      results.push(await runTest(domain, m25));
    }
  }

  // Note unconfigured providers
  if (!OPENROUTER_KEY) {
    results.push({ provider: 'OpenRouter', model: 'claude-3.5-sonnet', domain: 'all', success: false, duration: 0, notes: 'API key not configured' });
    results.push({ provider: 'OpenRouter', model: 'gpt-4o', domain: 'all', success: false, duration: 0, notes: 'API key not configured' });
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success && r.provider !== 'OpenRouter').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const report = {
    agent: 'A',
    timestamp: new Date().toISOString(),
    providersTested: MINIMAX_KEY ? ['MiniMax'] : [],
    providersSkipped: !OPENROUTER_KEY ? ['OpenRouter'] : [],
    domains: DOMAINS.map(d => d.name),
    summary: { total: results.length, success: successCount, failed: failCount, rate: ((successCount / Math.max(1, successCount + failCount)) * 100).toFixed(1) + '%' },
    totalDuration: totalDuration + 'ms',
    results
  };

  fs.writeFileSync(path.join(PROJECT_ROOT, 'dogfood-results-cloud-a.json'), JSON.stringify(report, null, 2));

  // Summary table
  console.log('\n┌────────────┬─────────────────┬─────────┬─────────┬────────────────────────┐');
  console.log('│ Provider   │ Model           │ Domain  │ Status  │ Notes                  │');
  console.log('├────────────┼─────────────────┼─────────┼─────────┼────────────────────────┤');
  for (const r of results) {
    const status = r.success ? '✅ PASS' : '❌ FAIL';
    const note = r.notes || r.error || '-';
    console.log(`│ ${r.provider.padEnd(10)} │ ${r.model.padEnd(15)} │ ${r.domain.padEnd(7)} │ ${status.padEnd(7)} │ ${note.slice(0, 22).padEnd(22)} │`);
  }
  console.log('├────────────┴─────────────────┴─────────┴─────────┴────────────────────────┤');
  console.log(`│ Total: ${(successCount + failCount).toString().padEnd(2)} tests │ ✅ ${successCount.toString().padEnd(2)} passed │ ❌ ${failCount.toString().padEnd(2)} failed │ Rate: ${report.summary.rate.padEnd(6)}            │`);
  console.log('└───────────────────────────────────────────────────────────────────────────┘');
  
  console.log('\n📄 Saved to: dogfood-results-cloud-a.json');
}

main().catch(console.error);
