#!/usr/bin/env node
/**
 * 🔬 DOGFOOD WITH FULL TELEMETRY & REASONING TRACES
 * 
 * Captures:
 * - Generated code
 * - Thinking/reasoning traces from LLM
 * - Full LLM responses
 * - Timing metrics
 * - Error details with stack traces
 * - Model metadata
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

// Create telemetry directory
const TELEMETRY_DIR = path.join(PROJECT_ROOT, 'dogfood-telemetry');
const REASONING_DIR = path.join(TELEMETRY_DIR, 'reasoning');
const RESPONSES_DIR = path.join(TELEMETRY_DIR, 'responses');
const TRACES_DIR = path.join(TELEMETRY_DIR, 'traces');

[TELEMETRY_DIR, REASONING_DIR, RESPONSES_DIR, TRACES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system with flowing movement', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader with animated colors', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube with interesting lighting', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a simple techno beat pattern with drums', Generator: StrudelGenerator },
  { name: 'hydra', prompt: 'Create a geometric video synth pattern with kaleidoscope effect', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create an ambient drone synthesizer with reverb', Generator: ToneGenerator },
  { name: 'revideo', prompt: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle', Generator: RemotionGenerator },
  { name: 'html', prompt: 'Create a landing page with hero section and call to action', Generator: HTMLWebGenerator },
  { name: 'ascii', prompt: 'Create ASCII art of a mountain landscape', Generator: ASCIIArtGenerator },
];

// Intercept LLM responses to capture telemetry
class InstrumentedLLMClient extends LLMClient {
  private testId: string;
  
  constructor(config: any, testId: string) {
    super(config);
    this.testId = testId;
  }

  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal) {
    const startTime = Date.now();
    const callId = `${this.testId}-${Date.now()}`;
    
    // Log the request
    const requestData = {
      timestamp: new Date().toISOString(),
      callId,
      testId: this.testId,
      model: (this as any).config?.model,
      baseUrl: (this as any).config?.baseUrl,
      systemPrompt,
      userPrompt,
      temperature: (this as any).config?.temperature,
      maxTokens: (this as any).config?.maxTokens,
    };
    
    fs.writeFileSync(
      path.join(TRACES_DIR, `${callId}-request.json`),
      JSON.stringify(requestData, null, 2)
    );

    try {
      // Call parent generate
      const response = await super.generate(systemPrompt, userPrompt, signal);
      const duration = Date.now() - startTime;
      
      // Capture full response with thinking
      const responseData = {
        timestamp: new Date().toISOString(),
        callId,
        testId: this.testId,
        duration,
        success: response.success,
        code: response.code,
        codeLength: response.code?.length,
        thinking: response.thinking,
        thinkingLength: response.thinking?.length,
        reasoning: response.reasoning,
        explanation: response.explanation,
        recoveredFromThinking: response.recoveredFromThinking,
        isComplete: response.isComplete,
        model: response.model,
        error: response.error,
      };
      
      // Save full response
      fs.writeFileSync(
        path.join(RESPONSES_DIR, `${callId}-response.json`),
        JSON.stringify(responseData, null, 2)
      );
      
      // Save reasoning trace separately
      if (response.thinking || response.reasoning) {
        const reasoningData = {
          timestamp: new Date().toISOString(),
          callId,
          testId: this.testId,
          model: response.model,
          thinking: response.thinking,
          reasoning: response.reasoning,
          recoveredFromThinking: response.recoveredFromThinking,
          prompt: userPrompt,
          generatedCode: response.code,
        };
        fs.writeFileSync(
          path.join(REASONING_DIR, `${callId}-reasoning.json`),
          JSON.stringify(reasoningData, null, 2)
        );
        
        // Also save as markdown for readability
        const md = `# Reasoning Trace: ${this.testId}\n\n**Model:** ${response.model}\n**Timestamp:** ${new Date().toISOString()}\n**Recovered from thinking:** ${response.recoveredFromThinking || false}\n\n## Prompt\n\n${userPrompt}\n\n## Thinking/Reasoning\n\n\`\`\`\n${response.thinking || response.reasoning || 'N/A'}\n\`\`\`\n\n## Generated Code\n\n\`\`\`${response.code?.includes('function') ? 'javascript' : ''}\n${response.code}\n\`\`\`\n`;
        fs.writeFileSync(path.join(REASONING_DIR, `${callId}-reasoning.md`), md);
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorData = {
        timestamp: new Date().toISOString(),
        callId,
        testId: this.testId,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        systemPrompt,
        userPrompt,
      };
      
      fs.writeFileSync(
        path.join(TRACES_DIR, `${callId}-error.json`),
        JSON.stringify(errorData, null, 2)
      );
      
      throw error;
    }
  }
}

interface TestResult {
  domain: string;
  model: string;
  provider: string;
  success: boolean;
  code: string;
  thinking?: string;
  reasoning?: string;
  recoveredFromThinking?: boolean;
  duration: number;
  error?: string;
  outputPath: string;
  telemetryId: string;
}

async function runTest(
  domain: typeof DOMAINS[0], 
  modelConfig: { name: string; model: string; baseUrl: string; apiKey?: string; provider: string }
): Promise<TestResult> {
  const startTime = Date.now();
  const testId = `${modelConfig.provider}-${domain.name}-${modelConfig.name}`;
  const outputPath = `landing-live/${testId}.html`;
  
  console.log(`  🔄 ${testId}`);
  
  try {
    const llm = new InstrumentedLLMClient({
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

    // Get the last response for thinking data
    // Note: We need to access this from the InstrumentedLLMClient
    // For now, we'll capture it in the intercepted method above

    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    console.log(`     ✅ (${duration}ms)`);
    
    return {
      domain: domain.name,
      model: modelConfig.name,
      provider: modelConfig.provider,
      success: true,
      code,
      duration,
      outputPath,
      telemetryId: testId,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`     ❌ (${duration}ms): ${errorMsg.slice(0, 80)}`);
    
    return {
      domain: domain.name,
      model: modelConfig.name,
      provider: modelConfig.provider,
      success: false,
      code: '',
      duration,
      error: errorMsg,
      outputPath,
      telemetryId: testId,
    };
  }
}

async function main() {
  console.log('🔬 DOGFOOD WITH FULL TELEMETRY\n');
  
  // Configure models
  const models: Array<{ name: string; model: string; baseUrl: string; apiKey?: string; provider: string }> = [];
  
  // MiniMax Cloud
  if (process.env.MINIMAX_API_KEY) {
    models.push(
      { name: 'minimax-m27', model: 'MiniMax-M2.7', baseUrl: 'https://api.minimaxi.chat/v1', apiKey: process.env.MINIMAX_API_KEY, provider: 'cloud-minimax' },
      { name: 'minimax-m25', model: 'MiniMax-M2.5', baseUrl: 'https://api.minimaxi.chat/v1', apiKey: process.env.MINIMAX_API_KEY, provider: 'cloud-minimax' },
    );
  }
  
  // LM Studio
  try {
    const res = await fetch('http://localhost:1234/v1/models');
    const data = await res.json();
    for (const m of data.data) {
      models.push({
        name: m.id.replace(/[/:]/g, '-'),
        model: m.id,
        baseUrl: 'http://localhost:1234/v1',
        provider: 'local-lmstudio',
      });
    }
  } catch { /* LM Studio not available */ }
  
  // Ollama
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    const data = await res.json();
    for (const m of data.models) {
      models.push({
        name: m.name.replace(/:/g, '-'),
        model: m.name,
        baseUrl: 'http://localhost:11434/v1',
        provider: 'local-ollama',
      });
    }
  } catch { /* Ollama not available */ }
  
  console.log(`Models: ${models.length}`);
  console.log(`Tests: ${DOMAINS.length} domains × ${models.length} models = ${DOMAINS.length * models.length}`);
  console.log(`Telemetry: ${TELEMETRY_DIR}\n`);
  
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  // Run all tests
  const results: TestResult[] = [];
  let completed = 0;
  const total = DOMAINS.length * models.length;
  
  for (const domain of DOMAINS) {
    for (const model of models) {
      const result = await runTest(domain, model);
      results.push(result);
      completed++;
      console.log(`     📊 ${completed}/${total} complete`);
    }
  }

  // Generate comprehensive report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      avgDuration: Math.round(results.reduce((a, r) => a + r.duration, 0) / results.length),
      withThinking: results.filter(r => r.thinking || r.reasoning).length,
      recoveredFromThinking: results.filter(r => r.recoveredFromThinking).length,
    },
    byDomain: {} as Record<string, { total: number; success: number; withThinking: number }>,
    byProvider: {} as Record<string, { total: number; success: number; withThinking: number }>,
    results,
    telemetry: {
      directory: TELEMETRY_DIR,
      reasoningDir: REASONING_DIR,
      responsesDir: RESPONSES_DIR,
      tracesDir: TRACES_DIR,
    },
  };

  // By domain stats
  for (const domain of DOMAINS) {
    const domainResults = results.filter(r => r.domain === domain.name);
    report.byDomain[domain.name] = {
      total: domainResults.length,
      success: domainResults.filter(r => r.success).length,
      withThinking: domainResults.filter(r => r.thinking || r.reasoning).length,
    };
  }

  // By provider stats
  const providers = [...new Set(results.map(r => r.provider))];
  for (const provider of providers) {
    const providerResults = results.filter(r => r.provider === provider);
    report.byProvider[provider] = {
      total: providerResults.length,
      success: providerResults.filter(r => r.success).length,
      withThinking: providerResults.filter(r => r.thinking || r.reasoning).length,
    };
  }

  // Save reports
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-report-telemetry.json'),
    JSON.stringify(report, null, 2)
  );

  // Generate markdown report
  let md = `# Dogfood Report with Telemetry\n\n**Generated:** ${report.timestamp}\n\n`;
  md += `## Summary\n\n| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Tests | ${report.summary.total} |\n`;
  md += `| ✅ Success | ${report.summary.success} |\n`;
  md += `| ❌ Failed | ${report.summary.failed} |\n`;
  md += `| 💭 With Thinking | ${report.summary.withThinking} |\n`;
  md += `| 🔄 Recovered | ${report.summary.recoveredFromThinking} |\n`;
  md += `| ⏱️ Avg Duration | ${report.summary.avgDuration}ms |\n\n`;
  
  md += `## By Provider\n\n| Provider | Total | Success | With Thinking |\n|----------|-------|---------|---------------|\n`;
  for (const [provider, stats] of Object.entries(report.byProvider)) {
    md += `| ${provider} | ${stats.total} | ${stats.success} | ${stats.withThinking} |\n`;
  }
  
  md += `\n## By Domain\n\n| Domain | Total | Success | With Thinking |\n|--------|-------|---------|---------------|\n`;
  for (const [domain, stats] of Object.entries(report.byDomain)) {
    md += `| ${domain} | ${stats.total} | ${stats.success} | ${stats.withThinking} |\n`;
  }
  
  fs.writeFileSync(path.join(PROJECT_ROOT, 'dogfood-report-telemetry.md'), md);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🔬 TELEMETRY DOGFOOD COMPLETE');
  console.log('='.repeat(60));
  console.log(`📊 Tests: ${report.summary.total}`);
  console.log(`✅ Success: ${report.summary.success}`);
  console.log(`💭 With Thinking: ${report.summary.withThinking}`);
  console.log(`⏱️ Avg Duration: ${report.summary.avgDuration}ms`);
  console.log(`\n📁 Telemetry: ${TELEMETRY_DIR}`);
  console.log(`   - Reasoning: ${REASONING_DIR}`);
  console.log(`   - Responses: ${RESPONSES_DIR}`);
  console.log(`   - Traces: ${TRACES_DIR}`);
  console.log(`\n📄 Reports:`);
  console.log(`   - dogfood-report-telemetry.json`);
  console.log(`   - dogfood-report-telemetry.md`);
}

main().catch(console.error);
