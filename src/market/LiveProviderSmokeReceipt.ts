import fs from 'node:fs';
import path from 'node:path';
import type { ProviderType } from '../harness/MultiProviderConfig.js';
import { readCurrentGitCommit } from '../runtime-core/ProofReceiptValidator.js';

export type LiveProviderSmokeStatus = 'pass' | 'fail' | 'blocked';

export interface LiveProviderSmokeReceipt {
  generatedAt: string;
  gitCommit: string | null;
  status: LiveProviderSmokeStatus;
  provider: string;
  model: string;
  durationMs: number;
  artifactPath: string;
  codeBytes: number;
  checks: {
    nonEmptyCode: boolean;
    p5Setup: boolean;
    p5Canvas: boolean;
  };
  blockers: string[];
}

const CLOUD_PROVIDER_PREFERENCE: ProviderType[] = ['glm', 'minimax', 'openai', 'openrouter', 'moonshot', 'kimi'];

export function selectLiveSmokeProvider(configuredProviders: ProviderType[], explicitProvider?: ProviderType): ProviderType {
  if (explicitProvider) return explicitProvider;
  return CLOUD_PROVIDER_PREFERENCE.find((provider) => configuredProviders.includes(provider))
    ?? configuredProviders[0]
    ?? 'ollama';
}

export function buildLiveProviderSmokeReceipt(input: {
  repoRoot?: string;
  provider: string;
  model: string;
  durationMs: number;
  artifactPath: string;
  code: string;
  generatedAt?: string;
}): LiveProviderSmokeReceipt {
  const code = input.code.trim();
  const checks = {
    nonEmptyCode: code.length > 0,
    p5Setup: /\bfunction\s+setup\s*\(|\bsetup\s*\(\s*\)\s*=>/.test(code),
    p5Canvas: /\bcreateCanvas\s*\(/.test(code),
  };
  const blockers = [
    checks.nonEmptyCode ? null : 'Provider returned empty code',
    checks.p5Setup ? null : 'Generated p5 code is missing setup()',
    checks.p5Canvas ? null : 'Generated p5 code is missing createCanvas()',
  ].filter(Boolean) as string[];

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    gitCommit: readCurrentGitCommit(input.repoRoot ?? process.cwd()),
    status: blockers.length === 0 ? 'pass' : 'fail',
    provider: input.provider,
    model: input.model,
    durationMs: input.durationMs,
    artifactPath: input.artifactPath,
    codeBytes: Buffer.byteLength(input.code, 'utf8'),
    checks,
    blockers,
  };
}

export function writeLiveProviderSmokeReceipt(repoRoot: string, receipt: LiveProviderSmokeReceipt): string {
  const outPath = path.join(repoRoot, '.omx', 'proof', 'live-provider-smoke.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return outPath;
}
