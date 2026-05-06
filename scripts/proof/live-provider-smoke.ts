#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { getProviderConfig, listConfiguredProviders, type ProviderType } from '../../src/harness/MultiProviderConfig.js';
import { P5GeneratorV2 } from '../../src/generators/p5/P5GeneratorV2.js';
import { buildLiveProviderSmokeReceipt, selectLiveSmokeProvider, writeLiveProviderSmokeReceipt } from '../../src/market/LiveProviderSmokeReceipt.js';
import { readCurrentGitCommit } from '../../src/runtime-core/ProofReceiptValidator.js';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};
const explicitProvider = getArg('provider') as ProviderType | undefined;
const timeoutMs = Number(getArg('timeout-ms') ?? 120_000);
const configuredProviders = listConfiguredProviders();
const provider = selectLiveSmokeProvider(configuredProviders, explicitProvider);
const providerConfig = getProviderConfig(provider);
const outDir = path.join(repoRoot, '.omx', 'proof', 'live-provider-smoke');
const artifactPath = path.join(outDir, 'p5.js');
const started = Date.now();

function writeBlocked(reason: string): never {
  const receipt = {
    generatedAt: new Date().toISOString(),
    gitCommit: readCurrentGitCommit(repoRoot),
    status: 'blocked' as const,
    provider,
    model: providerConfig?.model ?? 'unknown',
    durationMs: Date.now() - started,
    artifactPath: path.relative(repoRoot, artifactPath),
    codeBytes: 0,
    checks: { nonEmptyCode: false, p5Setup: false, p5Canvas: false },
    blockers: [reason],
  };
  const outPath = writeLiveProviderSmokeReceipt(repoRoot, receipt);
  console.error(`Live provider smoke blocked: ${reason}`);
  console.error(`Receipt: ${outPath}`);
  process.exit(1);
}

if (!providerConfig) writeBlocked(`Provider ${provider} is not configured`);
if (!providerConfig.apiKey && provider !== 'lmstudio' && provider !== 'ollama') {
  writeBlocked(`Provider ${provider} is missing an API key`);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
try {
  const llm = new LLMClient({
    baseUrl: providerConfig.baseUrl,
    model: providerConfig.model,
    apiKey: providerConfig.apiKey,
    temperature: 0.4,
    maxTokens: 2500,
  });
  const generator = new P5GeneratorV2(llm);
  const code = await generator.generate(
    'Create a concise p5.js sketch of a luminous market-ready Liminal signal: flowing blue-green particles, visible motion, and a dark background. Return raw p5.js code only with setup() and createCanvas().',
    { signal: controller.signal },
  );
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(artifactPath, `${code.trim()}\n`, 'utf8');
  const receipt = buildLiveProviderSmokeReceipt({
    repoRoot,
    provider,
    model: providerConfig.model,
    durationMs: Date.now() - started,
    artifactPath: path.relative(repoRoot, artifactPath),
    code,
  });
  const outPath = writeLiveProviderSmokeReceipt(repoRoot, receipt);
  console.log(`Live provider smoke ${receipt.status}: ${provider}/${providerConfig.model}`);
  console.log(`Artifact: ${receipt.artifactPath}`);
  console.log(`Receipt: ${outPath}`);
  process.exit(receipt.status === 'pass' ? 0 : 1);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  writeBlocked(reason);
} finally {
  clearTimeout(timeout);
}
