#!/usr/bin/env node
/**
 * ☁️ CLOUD FIRST - Maximum Telemetry
 * Runs all cloud providers first (fast), then local
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

const TELEMETRY_DIR = path.join(PROJECT_ROOT, 'dogfood-telemetry');
const REASONING_DIR = path.join(TELEMETRY_DIR, 'reasoning');
const RESPONSES_DIR = path.join(TELEMETRY_DIR, 'responses');

[TELEMETRY_DIR, REASONING_DIR, RESPONSES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
  { name: 'hydra', prompt: 'Create a kaleidoscope effect', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create ambient drone', Generator: ToneGenerator },
  { name: 'remotion', prompt: 'Create typing animation', Generator: RemotionGenerator },
  { name: 'html', prompt: 'Create landing page', Generator: HTMLWebGenerator },
  { name: 'ascii', prompt: 'Create mountain ASCII art', Generator: ASCIIArtGenerator },
];

// CLOUD PROVIDERS FIRST
const CLOUD_MODELS = [
  { name: 'minimax-m27', model: 'MiniMax-M2.7', baseUrl: 'https://api.minimaxi.chat/v1', apiKey: process.env.MINIMAX_API_KEY, provider: 'minimax' },
  { name: 'minimax-m25', model: 'MiniMax-M2.5', baseUrl: 'https://api.minimaxi.chat/v1', apiKey: process.env.MINIMAX_API_KEY, provider: 'minimax' },
];

// Add GLM if available
const configPath = path.join(process.env.HOME || '', '.liminal/config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (config.glm?.apiKey) {
    CLOUD_MODELS.push({ name: 'glm-5.1', model: 'glm-5.1', baseUrl: 'https://api.z.ai/api/coding/paas/v4', apiKey: config.glm.apiKey, provider: 'glm' });
  }
  if (config.kimi?.apiKey) {
    CLOUD_MODELS.push({ name: 'kimi-k2p5', model: 'kimi-k2p5', baseUrl: 'https://api.kimi.com/coding/v1', apiKey: config.kimi.apiKey, provider: 'kimi' });
  }
}

class TelemetryLLMClient extends LLMClient {
  private testId: string;
  
  constructor(config: any, testId: string) {
    super(config);
    this.testId = testId;
  }

  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal) {
    const callId = `${this.testId}-${Date.now()}`;
    const requestStart = Date.now();
    
    try {
      const response = await super.generate(systemPrompt, userPrompt, signal);
      const duration = Date.now() - requestStart;
      
      // Capture full response
      const responseData = {
        timestamp: new Date().toISOString(),
        callId,
        testId: this.testId,
        duration,
        success: response.success,
        code: response.code,
        codeLength: response.code?.length,
        thinking: response.thinking,
        reasoning: response.reasoning,
        recoveredFromThinking: response.recoveredFromThinking,
        model: response.model,
        error: response.error,
      };
      
      fs.writeFileSync(path.join(RESPONSES_DIR, `${callId}-response.json`), JSON.stringify(responseData, null, 2));
      
      // Save reasoning trace
      if (response.thinking || response.reasoning) {
        const traceData = {
          timestamp: new Date().toISOString(),
          callId,
          testId: this.testId,
          model: response.model,
          thinking: response.thinking,
          reasoning: response.reasoning,
          prompt: userPrompt,
          generatedCode: response.code,
        };
        fs.writeFileSync(path.join(REASONING_DIR, `${callId}-reasoning.json`), JSON.stringify(traceData, null, 2));
        
        const md = `# ${this.testId}\n\n**Model:** ${response.model}\n**Duration:** ${duration}ms\n\n## Prompt\n\n${userPrompt}\n\n## Reasoning\n\n\`\`\`\n${response.thinking || response.reasoning || 'N/A'}\n\`\`\`\n\n## Code\n\n\`\`\`javascript\n${response.code}\n\`\`\`\n`;
        fs.writeFileSync(path.join(REASONING_DIR, `${callId}-reasoning.md`), md);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
}

async function runTest(domain: typeof DOMAINS[0], modelConfig: typeof CLOUD_MODELS[0]) {
  const testId = `${modelConfig.provider}-${domain.name}-${modelConfig.name}`;
  const startTime = Date.now();
  
  process.stdout.write(`  ${domain.name} × ${modelConfig.name}... `);
  
  try {
    const llm = new TelemetryLLMClient({
      role: 'generator',
      baseUrl: modelConfig.baseUrl,
      model: modelConfig.model,
      apiKey: modelConfig.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    }, testId);

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    const duration = Date.now() - startTime;

    fs.writeFileSync(path.join(PROJECT_ROOT, `landing-live/${testId}.html`), code);
    console.log(`✅ (${duration}ms)`);
    
    return { testId, success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ (${duration}ms)`);
    return { testId, success: false, duration, error: String(error) };
  }
}

async function main() {
  console.log('☁️ CLOUD PROVIDERS FIRST - MAXIMUM TELEMETRY\n');
  console.log(`Cloud Models: ${CLOUD_MODELS.map(m => m.name).join(', ')}`);
  console.log(`Tests: ${DOMAINS.length} domains × ${CLOUD_MODELS.length} models = ${DOMAINS.length * CLOUD_MODELS.length}\n`);
  
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  const results = [];
  let completed = 0;
  
  for (const domain of DOMAINS) {
    console.log(`\n🎯 ${domain.name.toUpperCase()}`);
    for (const model of CLOUD_MODELS) {
      const result = await runTest(domain, model);
      results.push(result);
      completed++;
    }
  }

  const success = results.filter(r => r.success).length;
  const reasoningCount = fs.readdirSync(REASONING_DIR).filter(f => f.endsWith('.json')).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('☁️ CLOUD COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Tests: ${results.length}`);
  console.log(`✅ Success: ${success}`);
  console.log(`💭 Reasoning traces: ${reasoningCount}`);
}

main().catch(console.error);
