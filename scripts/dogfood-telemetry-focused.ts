#!/usr/bin/env node
/**
 * 🔬 FOCUSED TELEMETRY CAPTURE
 * 
 * Runs key models only for faster iteration while still capturing full reasoning traces
 */

import { LLMClient } from '../dist/llm/LLMClient.js';
import { P5GeneratorV2 } from '../dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from '../dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../dist/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../dist/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../dist/generators/tone/ToneGenerator.js';
import { HTMLWebGenerator } from '../dist/generators/html/HTMLWebGenerator.js';
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

// KEY MODELS ONLY - representative sample
const KEY_MODELS = [
  { name: 'minimax-m27', model: 'MiniMax-M2.7', baseUrl: 'https://api.minimaxi.chat/v1', provider: 'cloud' },
  { name: 'qwen3.5-2b', model: 'qwen3.5-2b', baseUrl: 'http://localhost:11434/v1', provider: 'ollama' },
  { name: 'phi4-mini', model: 'phi4-mini:latest', baseUrl: 'http://localhost:11434/v1', provider: 'ollama' },
  { name: 'gemma3-4b', model: 'gemma3:4b', baseUrl: 'http://localhost:11434/v1', provider: 'ollama' },
];

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
  { name: 'hydra', prompt: 'Create a kaleidoscope effect', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create ambient drone', Generator: ToneGenerator },
  { name: 'html', prompt: 'Create landing page', Generator: HTMLWebGenerator },
];

class InstrumentedLLMClient extends LLMClient {
  private testId: string;
  
  constructor(config: any, testId: string) {
    super(config);
    this.testId = testId;
  }

  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal) {
    const startTime = Date.now();
    const callId = `${this.testId}-${Date.now()}`;
    
    try {
      const response = await super.generate(systemPrompt, userPrompt, signal);
      const duration = Date.now() - startTime;
      
      // Capture full response with reasoning
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
        isComplete: response.isComplete,
        model: response.model,
        error: response.error,
      };
      
      fs.writeFileSync(
        path.join(RESPONSES_DIR, `${callId}-response.json`),
        JSON.stringify(responseData, null, 2)
      );
      
      // Save reasoning trace
      if (response.thinking || response.reasoning) {
        const reasoningData = {
          timestamp: new Date().toISOString(),
          callId,
          testId: this.testId,
          model: response.model,
          thinking: response.thinking,
          reasoning: response.reasoning,
          prompt: userPrompt,
          generatedCode: response.code,
        };
        fs.writeFileSync(
          path.join(REASONING_DIR, `${callId}-reasoning.json`),
          JSON.stringify(reasoningData, null, 2)
        );
        
        // Markdown for readability
        const md = `# Reasoning: ${this.testId}\n\n**Model:** ${response.model}\n**Duration:** ${duration}ms\n**Recovered:** ${response.recoveredFromThinking || false}\n\n## Prompt\n\n${userPrompt}\n\n## Reasoning/Thinking\n\n\`\`\`\n${response.thinking || response.reasoning || 'N/A'}\n\`\`\`\n\n## Generated Code\n\n\`\`\`javascript\n${response.code}\n\`\`\`\n`;
        fs.writeFileSync(path.join(REASONING_DIR, `${callId}-reasoning.md`), md);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }
}

async function runTest(domain: typeof DOMAINS[0], modelConfig: typeof KEY_MODELS[0]) {
  const testId = `${modelConfig.provider}-${domain.name}-${modelConfig.name}`;
  
  try {
    const llm = new InstrumentedLLMClient({
      role: 'generator',
      baseUrl: modelConfig.baseUrl,
      model: modelConfig.model,
      apiKey: process.env.MINIMAX_API_KEY,
      temperature: 0.7,
      maxTokens: 4096,
    }, testId);

    const generator = new domain.Generator(llm);
    const code = await generator.generate(domain.prompt);
    
    return { testId, success: true };
  } catch (error) {
    return { testId, success: false, error: String(error) };
  }
}

async function main() {
  console.log('🔬 FOCUSED TELEMETRY CAPTURE\n');
  console.log(`Models: ${KEY_MODELS.map(m => m.name).join(', ')}`);
  console.log(`Domains: ${DOMAINS.map(d => d.name).join(', ')}`);
  console.log(`Tests: ${DOMAINS.length} × ${KEY_MODELS.length} = ${DOMAINS.length * KEY_MODELS.length}\n`);
  
  const results = [];
  let completed = 0;
  
  for (const domain of DOMAINS) {
    for (const model of KEY_MODELS) {
      process.stdout.write(`  ${domain.name} × ${model.name}... `);
      const result = await runTest(domain, model);
      results.push(result);
      completed++;
      console.log(`${result.success ? '✅' : '❌'} (${completed}/${DOMAINS.length * KEY_MODELS.length})`);
    }
  }

  const reasoningCount = fs.readdirSync(REASONING_DIR).filter(f => f.endsWith('.json')).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('🔬 TELEMETRY CAPTURE COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Tests: ${results.length}`);
  console.log(`✅ Success: ${results.filter(r => r.success).length}`);
  console.log(`💭 Reasoning traces: ${reasoningCount}`);
  console.log(`\n📁 Telemetry location:`);
  console.log(`   ${TELEMETRY_DIR}`);
  console.log(`\n📄 Reasoning traces:`);
  fs.readdirSync(REASONING_DIR).filter(f => f.endsWith('.md')).forEach(f => {
    console.log(`   - ${f}`);
  });
}

main().catch(console.error);
