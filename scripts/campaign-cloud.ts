#!/usr/bin/env tsx
/**
 * Cloud Model Campaign Runner
 *
 * Runs MiniMax-M2.7 across all 9 domains × N rounds with full data capture:
 *   - Generated code per domain/round
 *   - Reasoning traces from LLM responses
 *   - Telemetry records (duration, success, code length, model info)
 *   - Aggregate report with statistics
 *
 * Usage: tsx scripts/campaign-cloud.ts [--rounds N] [--model MODEL]
 */

import { P5GeneratorLLM } from '../src/generators/p5/P5GeneratorLLM.js';
import { ShaderGenerator } from '../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../src/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../src/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../src/generators/hydra/HydraGenerator.js';
import { RemotionGenerator } from '../src/generators/remotion/RemotionGenerator.js';
import { HTMLWebGenerator } from '../src/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from '../src/generators/ascii/ASCIIArtGenerator.js';
import { ToneGenerator } from '../src/generators/tone/ToneGenerator.js';
import { LLMClient } from '../src/llm/LLMClient.js';

import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

// ── Domain prompts ──

const DOMAIN_PROMPTS: Record<string, string> = {
  p5: `Create an animated p5.js sketch featuring colorful fireworks exploding in the night sky. Include particle physics, gravity, and fading trails.`,
  glsl: `Create a GLSL fragment shader that renders a mesmerizing plasma effect with animated color shifts. Include noise functions and time-based animation.`,
  three: `Create a Three.js scene with a rotating wireframe torus knot that changes colors. Include orbit controls and animated lighting.`,
  strudel: `Create a Strudel pattern that plays a techno beat with kick, snare, hi-hat, and a bassline. Use pattern functions and effects.`,
  hydra: `Create a Hydra video synth patch with feedback effects, color shifting, and geometric patterns. Make it visually striking.`,
  revideo: `Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle.`,
  html: `Create a responsive landing page for a creative coding portfolio. Include a hero section with animated gradient background, project cards, and contact form.`,
  ascii: `Create simple ASCII art of a mountain landscape. Use only basic characters like @ # % * + = - . and spaces.`,
  tone: `Create a Tone.js synthesizer patch that plays an ambient drone with reverb and delay effects. Use multiple oscillators and LFOs for rich sound.`,
};

const DOMAINS = Object.keys(DOMAIN_PROMPTS);

// ── Types ──

interface CampaignResult {
  round: number;
  domain: string;
  success: boolean;
  duration: number;
  codeLength: number;
  code?: string;
  error?: string;
  reasoning?: string;
  thinking?: string;
  thinkingSource?: string;
  reasoningQuality?: number;
  recoveredFromThinking?: boolean;
  detectedPatterns?: string[];
  tokensUsed?: number;
  timestamp: string;
}

interface CampaignReport {
  model: string;
  timestamp: string;
  totalRuns: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number;
  avgCodeLength: number;
  resultsByDomain: Record<string, { success: number; failure: number; avgDuration: number; avgCodeLength: number }>;
  results: CampaignResult[];
}

// ── Parse args ──

function parseArgs(): { rounds: number; model: string } {
  const args = process.argv.slice(2);
  let rounds = 3;
  let model = 'MiniMax-M2.7';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rounds' && args[i + 1]) {
      rounds = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1];
      i++;
    }
  }

  return { rounds, model };
}

// ── Generator dispatch ──

interface GenerationTelemetry {
  code: string;
  thinking?: string;
  thinkingSource?: string;
  reasoningQuality?: number;
  recoveredFromThinking?: boolean;
  detectedPatterns?: string[];
}

async function generateWithLLM(
  prompt: string,
  domain: string,
  llm: LLMClient
): Promise<GenerationTelemetry> {
  const toTelemetry = (resp: any): GenerationTelemetry => ({
    code: resp.code,
    thinking: resp.thinking,
    thinkingSource: resp.thinkingSource,
    reasoningQuality: resp.reasoningQuality,
    recoveredFromThinking: resp.recoveredFromThinking,
    detectedPatterns: resp.detectedPatterns,
  });

  switch (domain) {
    case 'p5': {
      const gen = new P5GeneratorLLM(llm);
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'glsl': {
      const gen = new ShaderGenerator();
      (gen as any).llm = llm;
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'three': {
      const gen = new ThreeGenerator();
      (gen as any).llm = llm;
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'strudel': {
      const gen = new StrudelGenerator(llm);
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'hydra': {
      const gen = new HydraGenerator(llm);
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'revideo':
    case 'remotion': {
      const gen = new RemotionGenerator();
      (gen as any).llm = llm;
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'html': {
      const gen = new HTMLWebGenerator(llm);
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'ascii': {
      const gen = new ASCIIArtGenerator(llm);
      return toTelemetry(await gen.generateFull(prompt));
    }
    case 'tone': {
      const gen = new ToneGenerator(llm);
      return toTelemetry(await gen.generateFull(prompt));
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }
}

// ── Main ──

async function main() {
  const { rounds, model } = parseArgs();

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('ERROR: MINIMAX_API_KEY not set');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputBase = `dogfood-campaign-${timestamp}`;
  mkdirSync(outputBase, { recursive: true });
  mkdirSync(join(outputBase, 'code'), { recursive: true });
  mkdirSync(join(outputBase, 'traces'), { recursive: true });

  const results: CampaignResult[] = [];
  const totalRuns = DOMAINS.length * rounds;
  let completed = 0;

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Cloud Campaign: ${model}`);
  console.log(`║  Domains: ${DOMAINS.length} × Rounds: ${rounds} = ${totalRuns} runs`);
  console.log(`║  Output: ${outputBase}/`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n── Round ${round}/${rounds} ──`);

    for (const domain of DOMAINS) {
      completed++;
      const prompt = DOMAIN_PROMPTS[domain];
      const runTimestamp = new Date().toISOString();

      console.log(`  [${completed}/${totalRuns}] ${domain}... `, { newline: false });

      const llm = new LLMClient({
        baseUrl: 'https://api.minimax.io/v1',
        apiKey,
        model,
        temperature: 0.7,
        maxTokens: 4000,
      });
      llm.disableCache();

      const startTime = Date.now();
      let result: CampaignResult;

      try {
        const telemetry = await generateWithLLM(prompt, domain, llm);
        const duration = Date.now() - startTime;

        // Save code
        const codeFile = join(outputBase, 'code', `round${round}-${domain}.js`);
        writeFileSync(codeFile, telemetry.code);

        // Save thinking trace if present
        if (telemetry.thinking) {
          const traceFile = join(outputBase, 'traces', `round${round}-${domain}-thinking.txt`);
          writeFileSync(traceFile, telemetry.thinking);
        }

        result = {
          round,
          domain,
          success: true,
          duration,
          codeLength: telemetry.code.length,
          code: codeFile,
          reasoning: telemetry.thinking || undefined,
          thinking: telemetry.thinking || undefined,
          thinkingSource: telemetry.thinkingSource || 'cloud',
          reasoningQuality: telemetry.reasoningQuality,
          recoveredFromThinking: telemetry.recoveredFromThinking,
          detectedPatterns: telemetry.detectedPatterns,
          timestamp: runTimestamp,
        };

        const thinkingTag = telemetry.thinking ? ` [thinking: ${telemetry.thinking.length} chars]` : '';
        console.log(`OK (${duration}ms, ${telemetry.code.length} chars${thinkingTag})`);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errMsg = error?.message || String(error);

        result = {
          round,
          domain,
          success: false,
          duration,
          codeLength: 0,
          error: errMsg,
          thinkingSource: 'cloud',
          timestamp: runTimestamp,
        };

        console.log(`FAIL (${duration}ms): ${errMsg.slice(0, 80)}`);
      }

      results.push(result);

      // Append to running JSONL log
      appendFileSync(join(outputBase, 'results.jsonl'), JSON.stringify(result) + '\n');
    }
  }

  // ── Build aggregate report ──

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  const byDomain: CampaignReport['resultsByDomain'] = {};
  for (const domain of DOMAINS) {
    const domainResults = results.filter(r => r.domain === domain);
    const domainSuccesses = domainResults.filter(r => r.success);
    byDomain[domain] = {
      success: domainSuccesses.length,
      failure: domainResults.length - domainSuccesses.length,
      avgDuration: domainResults.reduce((s, r) => s + r.duration, 0) / domainResults.length,
      avgCodeLength: domainSuccesses.length > 0
        ? domainSuccesses.reduce((s, r) => s + r.codeLength, 0) / domainSuccesses.length
        : 0,
    };
  }

  const report: CampaignReport = {
    model,
    timestamp: new Date().toISOString(),
    totalRuns: results.length,
    successes: successes.length,
    failures: failures.length,
    successRate: successes.length / results.length,
    avgDuration: results.reduce((s, r) => s + r.duration, 0) / results.length,
    avgCodeLength: successes.length > 0
      ? successes.reduce((s, r) => s + r.codeLength, 0) / successes.length
      : 0,
    resultsByDomain: byDomain,
    results,
  };

  writeFileSync(join(outputBase, 'report.json'), JSON.stringify(report, null, 2));

  // ── Print summary ──

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  CAMPAIGN COMPLETE`);
  console.log(`║  ${successes.length}/${results.length} successful (${(report.successRate * 100).toFixed(1)}%)`);
  console.log(`║  Avg duration: ${(report.avgDuration / 1000).toFixed(1)}s`);
  console.log(`║  Avg code length: ${Math.round(report.avgCodeLength)} chars`);
  console.log(`╠══════════════════════════════════════════════════╣`);

  for (const domain of DOMAINS) {
    const d = byDomain[domain];
    const bar = '█'.repeat(d.success) + '░'.repeat(d.failure);
    console.log(`║  ${domain.padEnd(10)} ${bar} ${d.success}/${d.success + d.failure} (${(d.avgDuration / 1000).toFixed(1)}s avg)`);
  }

  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`\nOutput: ${outputBase}/`);
  console.log(`  report.json      — aggregate statistics`);
  console.log(`  results.jsonl    — per-run results (JSONL)`);
  console.log(`  code/            — generated code files`);
  console.log(`  traces/          — reasoning traces`);
}

main().catch(err => {
  console.error('Campaign failed:', err);
  process.exit(1);
});
