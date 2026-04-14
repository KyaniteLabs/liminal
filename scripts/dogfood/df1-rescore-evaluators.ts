#!/usr/bin/env node
/**
 * Rescore a fixed DF1 run with multiple evaluator models.
 *
 * This isolates evaluator behavior: same generated artifacts, same prompts,
 * different evaluator model.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { LLMClient, type LLMConfig } from '../../src/llm/LLMClient.js';

const EVALUATOR_SYSTEM_PROMPT = `You are a deterministic domain-specific code evaluator.
Return compact JSON only. No markdown. No prose outside JSON.
Schema:
{"score":0.85,"correctness":0.9,"relevance":0.8,"quality":0.85,"confidence":0.8,"notes":"short"}
Rules:
- Base correctness primarily on deterministic validation/runtime evidence.
- Penalize code that passes syntax but is semantically weak.
- For audio/text domains with no browser runtime, do not penalize only because runtime is not applicable.`;

interface EvaluatorSpec {
  label: string;
  config: Partial<LLMConfig>;
}

function providerConfig(name: string): { apiKey?: string; baseUrl?: string; model?: string } {
  const configPath = path.join(os.homedir(), '.liminal', 'config.json');
  if (!fsSync.existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
    return parsed.providers?.[name] || {};
  } catch {
    return {};
  }
}

interface DomainResult {
  domain: string;
  success: boolean;
  validationPassed: boolean;
  runtimePassed?: boolean;
  error?: string;
  artifactDir: string;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function evaluatorSpecs(): EvaluatorSpec[] {
  const openai = providerConfig('openai');
  const glm = providerConfig('glm');
  return [
    {
      label: 'openai:gpt-5.4-mini',
      config: {
        baseUrl: openai.baseUrl || 'https://api.openai.com/v1',
        model: 'gpt-5.4-mini',
        apiKey: openai.apiKey || process.env.OPENAI_API_KEY,
        temperature: 0,
        maxTokens: 512,
      },
    },
    {
      label: 'openai:gpt-5.4-nano',
      config: {
        baseUrl: openai.baseUrl || 'https://api.openai.com/v1',
        model: 'gpt-5.4-nano',
        apiKey: openai.apiKey || process.env.OPENAI_API_KEY,
        temperature: 0,
        maxTokens: 512,
      },
    },
    {
      label: 'glm:glm-4.5-air',
      config: {
        baseUrl: glm.baseUrl?.includes('/anthropic') ? glm.baseUrl : 'https://api.z.ai/api/anthropic',
        model: 'glm-4.5-air',
        apiKey: glm.apiKey || process.env.GLM_API_KEY,
        temperature: 0,
        maxTokens: 512,
      },
    },
  ];
}

async function readJson(file: string): Promise<any> {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function evaluate(spec: EvaluatorSpec, domain: string, prompt: string, result: DomainResult, code: string): Promise<any> {
  const llm = new LLMClient({ ...spec.config, role: 'evaluator' });
  const response = await llm.generate(
    EVALUATOR_SYSTEM_PROMPT,
    `Domain: ${domain}
Prompt: ${prompt}
Validation passed: ${result.validationPassed}
Runtime passed: ${result.runtimePassed}
Error: ${result.error || ''}

Generated code:
${code.slice(0, 12000)}`,
  );
  const json = response.code.match(/\{[\s\S]*\}/)?.[0];
  const parsed = json ? JSON.parse(json) : null;
  return {
    evaluator: spec.label,
    response: {
      success: response.success,
      error: response.error,
      usage: response.usage,
    },
    parsed,
    raw: response.code,
  };
}

async function main(): Promise<void> {
  const runDir = argValue('run');
  if (!runDir) throw new Error('Usage: npx tsx scripts/dogfood/df1-rescore-evaluators.ts --run=.omx/logs/df1-runs/<runId>');

  const summary = await readJson(path.join(runDir, 'summary.json'));
  const outputs: any[] = [];

  for (const result of summary.results as DomainResult[]) {
    const prompt = await readJson(path.join(result.artifactDir, 'prompt.json'));
    const code = await fs.readFile(path.join(result.artifactDir, 'code.txt'), 'utf8').catch(() => '');
    const domainScores = [];
    for (const spec of evaluatorSpecs()) {
      domainScores.push(await evaluate(spec, result.domain, prompt.prompt, result, code));
    }
    outputs.push({ domain: result.domain, original: result, evaluations: domainScores });
  }

  const outputPath = path.join(runDir, 'evaluator-comparison.json');
  await fs.writeFile(outputPath, JSON.stringify({
    sourceRun: runDir,
    generatedAt: new Date().toISOString(),
    outputs,
  }, null, 2), 'utf8');
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
