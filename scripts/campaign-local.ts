#!/usr/bin/env tsx
/**
 * Local Model Campaign Runner
 *
 * Runs Ollama local models across all 9 domains × N rounds.
 *
 * Usage: tsx scripts/campaign-local.ts [--rounds N] [--models model1,model2]
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

import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

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

// All local Ollama models available
const LOCAL_MODELS = [
  { name: 'gemma4:latest', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'gemma3:4b', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'phi4-mini:latest', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'qwen3.5:2b', baseUrl: 'http://localhost:11434', apiStyle: 'ollama' as const },
  { name: 'qwen3.5:0.8b', baseUrl: 'http://localhost:11434', apiStyle: 'ollama' as const },
  { name: 'granite4:1b', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'granite4:350m', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
  { name: 'lfm2.5-thinking:1.2b', baseUrl: 'http://localhost:11434/v1', apiStyle: 'openai' as const },
];

interface CampaignResult {
  model: string;
  round: number;
  domain: string;
  success: boolean;
  duration: number;
  codeLength: number;
  code?: string;
  error?: string;
  reasoning?: string;
  thinkingSource?: string;
  timestamp: string;
}

interface CampaignReport {
  models: string[];
  timestamp: string;
  totalRuns: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number;
  avgCodeLength: number;
  resultsByModel: Record<string, {
    successes: number;
    failures: number;
    successRate: number;
    avgDuration: number;
    avgCodeLength: number;
    byDomain: Record<string, { success: boolean; duration: number; codeLength: number; error?: string }[]>;
  }>;
  results: CampaignResult[];
}

function parseArgs(): { rounds: number; models: string[] } {
  const args = process.argv.slice(2);
  let rounds = 3;
  let modelFilter: string[] | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rounds' && args[i + 1]) {
      rounds = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--models' && args[i + 1]) {
      modelFilter = args[i + 1].split(',');
      i++;
    }
  }

  const models = modelFilter
    ? LOCAL_MODELS.filter(m => modelFilter!.includes(m.name))
    : LOCAL_MODELS;

  return { rounds, models: models.map(m => m.name) };
}

async function generateWithLLM(
  prompt: string,
  domain: string,
  llm: LLMClient
): Promise<{ code: string; reasoning?: string }> {
  switch (domain) {
    case 'p5': {
      const gen = new P5GeneratorLLM(llm);
      const code = await gen.generate(prompt);
      return { code };
    }
    case 'glsl': {
      const gen = new ShaderGenerator();
      (gen as any).llm = llm;
      const code = await gen.generate(prompt);
      return { code };
    }
    case 'three': {
      const gen = new ThreeGenerator();
      (gen as any).llm = llm;
      const code = await gen.generate(prompt);
      return { code };
    }
    case 'strudel': {
      const gen = new StrudelGenerator(llm);
      const code = await gen.generate(prompt);
      return { code };
    }
    case 'hydra': {
      const gen = new HydraGenerator(llm);
      const code = await gen.generate(prompt);
      return { code };
    }
    case 'revideo':
    case 'remotion': {
      const gen = new RemotionGenerator();
      (gen as any).llm = llm;
      const code = await gen.generate(prompt);
      return { code };
    }
    case 'html': {
      const gen = new HTMLWebGenerator(llm);
      const code = await gen.generate(prompt, { responsive: true, includeAnimations: true });
      return { code };
    }
    case 'ascii': {
      const gen = new ASCIIArtGenerator(llm);
      const code = await gen.generate(prompt, { style: 'abstract', width: 60, height: 30 });
      return { code };
    }
    case 'tone': {
      const gen = new ToneGenerator(llm);
      const code = await gen.generate(prompt);
      return { code };
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }
}

async function main() {
  const { rounds, models: modelNames } = parseArgs();

  const selectedModels = LOCAL_MODELS.filter(m => modelNames.includes(m.name));
  if (selectedModels.length === 0) {
    console.error('No matching local models found');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputBase = `dogfood-campaign-local-${timestamp}`;
  mkdirSync(outputBase, { recursive: true });
  mkdirSync(join(outputBase, 'code'), { recursive: true });
  mkdirSync(join(outputBase, 'traces'), { recursive: true });

  const results: CampaignResult[] = [];
  const totalRuns = DOMAINS.length * rounds * selectedModels.length;
  let completed = 0;

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Local Model Campaign`);
  console.log(`║  Models: ${selectedModels.length}`);
  for (const m of selectedModels) {
    console.log(`║    - ${m.name}`);
  }
  console.log(`║  Domains: ${DOMAINS.length} × Rounds: ${rounds}`);
  console.log(`║  Total: ${totalRuns} runs`);
  console.log(`║  Output: ${outputBase}/`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  for (const modelConfig of selectedModels) {
    console.log(`\n══ Model: ${modelConfig.name} ══`);

    for (let round = 1; round <= rounds; round++) {
      console.log(`  ── Round ${round}/${rounds} ──`);

      for (const domain of DOMAINS) {
        completed++;
        const prompt = DOMAIN_PROMPTS[domain];
        const runTimestamp = new Date().toISOString();
        const safeModel = modelConfig.name.replace(/[^a-zA-Z0-9]/g, '_');

        process.stdout.write(`    [${completed}/${totalRuns}] ${domain}... `);

        const llm = new LLMClient({
          baseUrl: modelConfig.baseUrl,
          apiKey: 'ollama',
          model: modelConfig.name,
          temperature: 0.7,
          maxTokens: 4000,
          apiStyle: modelConfig.apiStyle,
        });
        llm.disableCache();

        const startTime = Date.now();
        let result: CampaignResult;

        try {
          const { code, reasoning } = await generateWithLLM(prompt, domain, llm);
          const duration = Date.now() - startTime;

          const codeFile = join(outputBase, 'code', `${safeModel}-round${round}-${domain}.js`);
          writeFileSync(codeFile, code);

          if (reasoning) {
            writeFileSync(join(outputBase, 'traces', `${safeModel}-round${round}-${domain}-reasoning.txt`), reasoning);
          }

          result = {
            model: modelConfig.name,
            round,
            domain,
            success: true,
            duration,
            codeLength: code.length,
            code: codeFile,
            reasoning: reasoning || undefined,
            thinkingSource: 'local',
            timestamp: runTimestamp,
          };

          console.log(`OK (${(duration / 1000).toFixed(1)}s, ${code.length} chars)`);

        } catch (error: any) {
          const duration = Date.now() - startTime;
          const errMsg = error?.message || String(error);

          result = {
            model: modelConfig.name,
            round,
            domain,
            success: false,
            duration,
            codeLength: 0,
            error: errMsg.slice(0, 200),
            thinkingSource: 'local',
            timestamp: runTimestamp,
          };

          console.log(`FAIL (${(duration / 1000).toFixed(1)}s): ${errMsg.slice(0, 60)}`);
        }

        results.push(result);
        appendFileSync(join(outputBase, 'results.jsonl'), JSON.stringify(result) + '\n');
      }
    }
  }

  // ── Build aggregate report ──
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  const byModel: CampaignReport['resultsByModel'] = {};
  for (const modelConfig of selectedModels) {
    const modelResults = results.filter(r => r.model === modelConfig.name);
    const modelSuccesses = modelResults.filter(r => r.success);

    const byDomain: Record<string, { success: boolean; duration: number; codeLength: number; error?: string }[]> = {};
    for (const domain of DOMAINS) {
      byDomain[domain] = modelResults
        .filter(r => r.domain === domain)
        .map(r => ({ success: r.success, duration: r.duration, codeLength: r.codeLength, error: r.error }));
    }

    byModel[modelConfig.name] = {
      successes: modelSuccesses.length,
      failures: modelResults.length - modelSuccesses.length,
      successRate: modelSuccesses.length / modelResults.length,
      avgDuration: modelResults.reduce((s, r) => s + r.duration, 0) / modelResults.length,
      avgCodeLength: modelSuccesses.length > 0
        ? modelSuccesses.reduce((s, r) => s + r.codeLength, 0) / modelSuccesses.length
        : 0,
      byDomain,
    };
  }

  const report: CampaignReport = {
    models: selectedModels.map(m => m.name),
    timestamp: new Date().toISOString(),
    totalRuns: results.length,
    successes: successes.length,
    failures: failures.length,
    successRate: successes.length / results.length,
    avgDuration: results.reduce((s, r) => s + r.duration, 0) / results.length,
    avgCodeLength: successes.length > 0
      ? successes.reduce((s, r) => s + r.codeLength, 0) / successes.length
      : 0,
    resultsByModel: byModel,
    results,
  };

  writeFileSync(join(outputBase, 'report.json'), JSON.stringify(report, null, 2));

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  LOCAL CAMPAIGN COMPLETE`);
  console.log(`║  ${successes.length}/${results.length} successful (${(report.successRate * 100).toFixed(1)}%)`);
  console.log(`╠══════════════════════════════════════════════════╣`);

  for (const [modelName, data] of Object.entries(byModel)) {
    const bar = '█'.repeat(Math.min(data.successes, 9)) + '░'.repeat(Math.min(data.failures, 9));
    console.log(`║  ${modelName.padEnd(25)} ${bar}`);
    console.log(`║    ${data.successes}/${data.successes + data.failures} (${(data.successRate * 100).toFixed(0)}%) avg ${(data.avgDuration / 1000).toFixed(1)}s`);
  }

  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`\nOutput: ${outputBase}/`);
}

main().catch(err => {
  console.error('Campaign failed:', err);
  process.exit(1);
});
