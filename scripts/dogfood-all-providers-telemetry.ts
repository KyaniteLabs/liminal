#!/usr/bin/env node
/**
 * 🔬 ALL PROVIDERS - MAXIMUM TELEMETRY
 * 
 * Runs EVERY available model with full reasoning trace capture:
 * - MiniMax (Cloud)
 * - GLM (Cloud)
 * - Kimi (Cloud)
 * - LM Studio (Local)
 * - Ollama (Local - 12 models)
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

// TELEMETRY DIRECTORIES
const TELEMETRY_DIR = path.join(PROJECT_ROOT, 'dogfood-telemetry');
const REASONING_DIR = path.join(TELEMETRY_DIR, 'reasoning');
const RESPONSES_DIR = path.join(TELEMETRY_DIR, 'responses');
const TRACES_DIR = path.join(TELEMETRY_DIR, 'traces');
const SUMMARIES_DIR = path.join(TELEMETRY_DIR, 'summaries');

[TELEMETRY_DIR, REASONING_DIR, RESPONSES_DIR, TRACES_DIR, SUMMARIES_DIR].forEach(dir => {
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

// ALL MODELS CONFIGURATION
interface ModelConfig {
  name: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  provider: string;
  type: 'cloud' | 'local';
}

async function getAllModels(): Promise<ModelConfig[]> {
  const models: ModelConfig[] = [];
  
  // Load config
  const configPath = path.join(process.env.HOME || '', '.liminal/config.json');
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch { /* ignore */ }
  }
  
  // 1. MiniMax Cloud
  if (config.minimax?.apiKey || process.env.MINIMAX_API_KEY) {
    models.push(
      { name: 'minimax-m27', model: 'MiniMax-M2.7', baseUrl: 'https://api.minimaxi.chat/v1', apiKey: config.minimax?.apiKey || process.env.MINIMAX_API_KEY, provider: 'minimax', type: 'cloud' },
      { name: 'minimax-m25', model: 'MiniMax-M2.5', baseUrl: 'https://api.minimaxi.chat/v1', apiKey: config.minimax?.apiKey || process.env.MINIMAX_API_KEY, provider: 'minimax', type: 'cloud' },
    );
  }
  
  // 2. GLM Cloud
  if (config.glm?.apiKey) {
    models.push(
      { name: 'glm-5.1', model: 'glm-5.1', baseUrl: 'https://api.z.ai/api/coding/paas/v4', apiKey: config.glm.apiKey, provider: 'glm', type: 'cloud' },
    );
  }
  
  // 3. Kimi Cloud
  if (config.kimi?.apiKey) {
    models.push(
      { name: 'kimi-k2p5', model: 'kimi-k2p5', baseUrl: 'https://api.kimi.com/coding/v1', apiKey: config.kimi.apiKey, provider: 'kimi', type: 'cloud' },
    );
  }
  
  // 4. LM Studio Local
  try {
    const res = await fetch('http://localhost:1234/v1/models');
    const data = await res.json();
    for (const m of data.data) {
      models.push({
        name: `lmstudio-${m.id.replace(/[/:]/g, '-')}`,
        model: m.id,
        baseUrl: 'http://localhost:1234/v1',
        provider: 'lmstudio',
        type: 'local',
      });
    }
  } catch { /* LM Studio not available */ }
  
  // 5. Ollama Local
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    const data = await res.json();
    for (const m of data.models) {
      models.push({
        name: `ollama-${m.name.replace(/:/g, '-')}`,
        model: m.name,
        baseUrl: 'http://localhost:11434/v1',
        provider: 'ollama',
        type: 'local',
      });
    }
  } catch { /* Ollama not available */ }
  
  return models;
}

// Instrumented LLM Client with full telemetry
class TelemetryLLMClient extends LLMClient {
  private testId: string;
  private telemetryStartTime: number;
  
  constructor(config: any, testId: string) {
    super(config);
    this.testId = testId;
    this.telemetryStartTime = Date.now();
  }

  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal) {
    const callId = `${this.testId}-${Date.now()}`;
    const requestStart = Date.now();
    
    // Log request
    const requestData = {
      timestamp: new Date().toISOString(),
      callId,
      testId: this.testId,
      model: (this as any).config?.model,
      provider: (this as any).config?.provider,
      baseUrl: (this as any).config?.baseUrl,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      systemPrompt: systemPrompt.slice(0, 500),
      userPrompt: userPrompt.slice(0, 500),
      temperature: (this as any).config?.temperature,
      maxTokens: (this as any).config?.maxTokens,
    };
    
    fs.writeFileSync(
      path.join(TRACES_DIR, `${callId}-request.json`),
      JSON.stringify(requestData, null, 2)
    );

    try {
      const response = await super.generate(systemPrompt, userPrompt, signal);
      const duration = Date.now() - requestStart;
      
      // Full response capture
      const responseData = {
        timestamp: new Date().toISOString(),
        callId,
        testId: this.testId,
        duration,
        success: response.success,
        codeLength: response.code?.length,
        hasCode: !!response.code && response.code.length > 0,
        thinkingLength: response.thinking?.length,
        reasoningLength: response.reasoning?.length,
        explanationLength: response.explanation?.length,
        recoveredFromThinking: response.recoveredFromThinking,
        isComplete: response.isComplete,
        model: response.model,
        error: response.error,
        // Full data for analysis
        code: response.code,
        thinking: response.thinking,
        reasoning: response.reasoning,
        explanation: response.explanation,
      };
      
      fs.writeFileSync(
        path.join(RESPONSES_DIR, `${callId}-response.json`),
        JSON.stringify(responseData, null, 2)
      );
      
      // Reasoning trace capture
      if (response.thinking || response.reasoning) {
        const traceData = {
          timestamp: new Date().toISOString(),
          callId,
          testId: this.testId,
          model: response.model,
          provider: (this as any).config?.provider,
          duration,
          hasThinking: !!response.thinking,
          hasReasoning: !!response.reasoning,
          thinking: response.thinking,
          reasoning: response.reasoning,
          recoveredFromThinking: response.recoveredFromThinking,
          prompt: userPrompt,
          generatedCode: response.code,
          codeLength: response.code?.length,
        };
        
        fs.writeFileSync(
          path.join(REASONING_DIR, `${callId}-reasoning.json`),
          JSON.stringify(traceData, null, 2)
        );
        
        // Markdown for human readability
        const md = `# Reasoning Trace: ${this.testId}\n\n` +
          `**Model:** ${response.model}\n` +
          `**Provider:** ${(this as any).config?.provider || 'unknown'}\n` +
          `**Duration:** ${duration}ms\n` +
          `**Recovered from thinking:** ${response.recoveredFromThinking || false}\n` +
          `**Has thinking:** ${!!response.thinking}\n` +
          `**Has reasoning:** ${!!response.reasoning}\n\n` +
          `## Prompt\n\n${userPrompt}\n\n` +
          `## Reasoning/Thinking Process\n\n\`\`\`\n${response.thinking || response.reasoning || 'N/A'}\n\`\`\`\n\n` +
          `## Generated Code\n\n\`\`\`javascript\n${response.code || '// No code generated'}\n\`\`\`\n`;
        
        fs.writeFileSync(path.join(REASONING_DIR, `${callId}-reasoning.md`), md);
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - requestStart;
      const errorData = {
        timestamp: new Date().toISOString(),
        callId,
        testId: this.testId,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        model: (this as any).config?.model,
        provider: (this as any).config?.provider,
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
  type: string;
  success: boolean;
  code: string;
  thinking?: string;
  reasoning?: string;
  recoveredFromThinking?: boolean;
  duration: number;
  error?: string;
  telemetryId: string;
}

async function runTest(domain: typeof DOMAINS[0], modelConfig: ModelConfig): Promise<TestResult> {
  const testId = `${modelConfig.provider}-${domain.name}-${modelConfig.name}`;
  const startTime = Date.now();
  
  process.stdout.write(`    ${domain.name} × ${modelConfig.name}... `);
  
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

    // Save output
    const outputPath = `landing-live/${testId}.html`;
    fs.writeFileSync(path.join(PROJECT_ROOT, outputPath), code);
    
    console.log(`✅ (${duration}ms)`);
    
    return {
      domain: domain.name,
      model: modelConfig.name,
      provider: modelConfig.provider,
      type: modelConfig.type,
      success: true,
      code,
      duration,
      telemetryId: testId,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ (${duration}ms): ${errorMsg.slice(0, 60)}`);
    
    return {
      domain: domain.name,
      model: modelConfig.name,
      provider: modelConfig.provider,
      type: modelConfig.type,
      success: false,
      code: '',
      duration,
      error: errorMsg,
      telemetryId: testId,
    };
  }
}

async function main() {
  console.log('🔬 MAXIMUM TELEMETRY - ALL PROVIDERS\n');
  
  const models = await getAllModels();
  
  console.log(`📦 Detected Models (${models.length}):`);
  const byProvider: Record<string, number> = {};
  for (const m of models) {
    byProvider[m.provider] = (byProvider[m.provider] || 0) + 1;
  }
  for (const [provider, count] of Object.entries(byProvider)) {
    console.log(`  • ${provider}: ${count} models`);
  }
  
  const totalTests = DOMAINS.length * models.length;
  console.log(`\n📊 Total Tests: ${DOMAINS.length} domains × ${models.length} models = ${totalTests}`);
  console.log(`💾 Telemetry: ${TELEMETRY_DIR}\n`);
  
  // Create landing-live directory
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  if (!fs.existsSync(landingDir)) fs.mkdirSync(landingDir, { recursive: true });

  // Run all tests
  const results: TestResult[] = [];
  let completed = 0;
  
  for (const domain of DOMAINS) {
    console.log(`\n  🎯 ${domain.name.toUpperCase()}`);
    for (const model of models) {
      const result = await runTest(domain, model);
      results.push(result);
      completed++;
    }
  }

  // Generate comprehensive report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      successRate: ((results.filter(r => r.success).length / results.length) * 100).toFixed(1) + '%',
      avgDuration: Math.round(results.reduce((a, r) => a + r.duration, 0) / results.length),
      withThinking: results.filter(r => r.thinking || r.reasoning).length,
      recoveredFromThinking: results.filter(r => r.recoveredFromThinking).length,
    },
    byProvider: {} as Record<string, { total: number; success: number; withThinking: number; avgDuration: number }>,
    byDomain: {} as Record<string, { total: number; success: number; withThinking: number }>,
    byType: {} as Record<string, { total: number; success: number }>,
    models: models.map(m => ({ name: m.name, provider: m.provider, type: m.type })),
    results,
  };

  // Calculate provider stats
  for (const provider of Object.keys(byProvider)) {
    const providerResults = results.filter(r => r.provider === provider);
    report.byProvider[provider] = {
      total: providerResults.length,
      success: providerResults.filter(r => r.success).length,
      withThinking: providerResults.filter(r => r.thinking || r.reasoning).length,
      avgDuration: Math.round(providerResults.reduce((a, r) => a + r.duration, 0) / providerResults.length) || 0,
    };
  }

  // Calculate domain stats
  for (const domain of DOMAINS) {
    const domainResults = results.filter(r => r.domain === domain.name);
    report.byDomain[domain.name] = {
      total: domainResults.length,
      success: domainResults.filter(r => r.success).length,
      withThinking: domainResults.filter(r => r.thinking || r.reasoning).length,
    };
  }

  // Cloud vs Local
  report.byType = {
    cloud: {
      total: results.filter(r => r.type === 'cloud').length,
      success: results.filter(r => r.type === 'cloud' && r.success).length,
    },
    local: {
      total: results.filter(r => r.type === 'local').length,
      success: results.filter(r => r.type === 'local' && r.success).length,
    },
  };

  // Save reports
  fs.writeFileSync(
    path.join(PROJECT_ROOT, 'dogfood-report-complete.json'),
    JSON.stringify(report, null, 2)
  );

  // Markdown report
  let md = `# Dogfood Complete Report with Maximum Telemetry\n\n`;
  md += `**Generated:** ${report.timestamp}\n\n`;
  md += `## Summary\n\n| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Tests | ${report.summary.total} |\n`;
  md += `| ✅ Success | ${report.summary.success} |\n`;
  md += `| ❌ Failed | ${report.summary.failed} |\n`;
  md += `| 📈 Success Rate | ${report.summary.successRate} |\n`;
  md += `| 💭 With Thinking | ${report.summary.withThinking} |\n`;
  md += `| 🔄 Recovered | ${report.summary.recoveredFromThinking} |\n`;
  md += `| ⏱️ Avg Duration | ${report.summary.avgDuration}ms |\n\n`;
  
  md += `## By Provider\n\n| Provider | Total | Success | With Thinking | Avg Duration |\n|----------|-------|---------|---------------|--------------|\n`;
  for (const [provider, stats] of Object.entries(report.byProvider)) {
    md += `| ${provider} | ${stats.total} | ${stats.success} | ${stats.withThinking} | ${stats.avgDuration}ms |\n`;
  }
  
  md += `\n## By Domain\n\n| Domain | Total | Success | With Thinking |\n|--------|-------|---------|---------------|\n`;
  for (const [domain, stats] of Object.entries(report.byDomain)) {
    md += `| ${domain} | ${stats.total} | ${stats.success} | ${stats.withThinking} |\n`;
  }
  
  md += `\n## Cloud vs Local\n\n| Type | Total | Success |\n|------|-------|---------|\n`;
  md += `| Cloud | ${report.byType.cloud.total} | ${report.byType.cloud.success} |\n`;
  md += `| Local | ${report.byType.local.total} | ${report.byType.local.success} |\n`;
  
  fs.writeFileSync(path.join(PROJECT_ROOT, 'dogfood-report-complete.md'), md);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('🔬 MAXIMUM TELEMETRY CAPTURE COMPLETE');
  console.log('='.repeat(70));
  console.log(`📊 Tests: ${report.summary.total}`);
  console.log(`✅ Success: ${report.summary.success} (${report.summary.successRate})`);
  console.log(`💭 With Thinking: ${report.summary.withThinking}`);
  console.log(`⏱️ Avg Duration: ${report.summary.avgDuration}ms`);
  console.log(`\n📁 Telemetry collected:`);
  console.log(`   ${REASONING_DIR}`);
  console.log(`   ${RESPONSES_DIR}`);
  console.log(`   ${TRACES_DIR}`);
  console.log(`\n📄 Reports:`);
  console.log(`   - dogfood-report-complete.json`);
  console.log(`   - dogfood-report-complete.md`);
  
  // Count telemetry files
  const reasoningCount = fs.readdirSync(REASONING_DIR).filter(f => f.endsWith('.json')).length;
  const responseCount = fs.readdirSync(RESPONSES_DIR).filter(f => f.endsWith('.json')).length;
  const traceCount = fs.readdirSync(TRACES_DIR).filter(f => f.endsWith('.json')).length;
  
  console.log(`\n📈 Telemetry Files:`);
  console.log(`   Reasoning traces: ${reasoningCount}`);
  console.log(`   Response captures: ${responseCount}`);
  console.log(`   Request traces: ${traceCount}`);
  console.log(`   Total: ${reasoningCount + responseCount + traceCount}`);
}

main().catch(console.error);
