import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { LLMClient } from '../../src/llm/LLMClient.js';
import type { ProviderType } from '../../src/harness/MultiProviderConfig.js';
import {
  backupProviderEnv,
  createLiveProviderClient,
  createLmStudioClient,
  restoreProviderEnv,
  selectLmStudioModel,
} from './helpers/liveProviderTestEnv.js';

/**
 * Provider comparison proof.
 *
 * This is a bounded launch gate, not a benchmark harness. It compares the
 * currently configured providers on the same tiny code prompt and records the
 * result. MiniMax highspeed stays in its own entitlement-gated test because the
 * current token plan rejects that model with provider error 2061.
 */

const RUN_MODEL_COMPARISON =
  process.env.RUN_MODEL_COMPARISON === '1' || process.env.RUN_MODEL_COMPARISON === 'true';
const REQUEST_TIMEOUT_MS = 90000;
const TEST_TIMEOUT_MS = 240000;
const CLOUD_PROVIDER_ORDER: ProviderType[] = ['glm', 'kimi', 'minimax'];

interface ComparisonCandidate {
  name: string;
  type: 'local' | 'cloud';
  model: string;
  client: LLMClient;
}

interface ComparisonResult {
  name: string;
  type: 'local' | 'cloud';
  model: string;
  success: boolean;
  durationMs: number;
  codeLength: number;
  hasThinkTags: boolean;
  provenanceModel?: string;
}

async function buildCandidates(): Promise<ComparisonCandidate[]> {
  const candidates: ComparisonCandidate[] = [];

  const localModel = await selectLmStudioModel([/qwen3\.5/i, /qwen35/i, /qwen/i]).catch(() => null);
  if (localModel) {
    candidates.push({
      name: 'lmstudio-local',
      type: 'local',
      model: localModel,
      client: createLmStudioClient(localModel),
    });
  }

  for (const provider of CLOUD_PROVIDER_ORDER) {
    const live = createLiveProviderClient(provider);
    if (!live) continue;
    candidates.push({
      name: provider,
      type: 'cloud',
      model: live.config.model,
      client: live.client,
    });
  }

  if (candidates.length < 2) {
    throw new Error(
      `RUN_MODEL_COMPARISON requires at least two configured candidates; found ${candidates.map(candidate => candidate.name).join(', ') || 'none'}.`,
    );
  }

  return candidates;
}

describe.skipIf(process.env.CI || !RUN_MODEL_COMPARISON)('Provider comparison proof', () => {
  const envBackup = backupProviderEnv(['RUN_MODEL_COMPARISON']);
  const outputDir = path.join(process.cwd(), 'test-results', 'model-comparison');

  beforeAll(async () => {
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(() => {
    restoreProviderEnv(envBackup);
  });

  it('compares configured providers on the same bounded code prompt', async () => {
    const candidates = await buildCandidates();
    const results: ComparisonResult[] = [];

    for (const candidate of candidates) {
      const started = Date.now();
      const response = await candidate.client.generate(
        'Output final JavaScript only. Do not include reasoning text.',
        'Return only this JavaScript line: function setup(){createCanvas(120,120);}',
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      );

      const hasThinkTags = response.code.includes('<think');
      results.push({
        name: candidate.name,
        type: candidate.type,
        model: candidate.model,
        success: response.success,
        durationMs: Date.now() - started,
        codeLength: response.code.length,
        hasThinkTags,
        provenanceModel: response.provenance?.model,
      });

      expect(response.success).toBe(true);
      expect(response.code).toContain('createCanvas');
      expect(hasThinkTags).toBe(false);
      expect(response.provenance?.model).toBe(candidate.model);
    }

    await fs.writeFile(
      path.join(outputDir, 'comparison-report.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
    );

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(result => result.type === 'local')).toBe(true);
    expect(results.some(result => result.type === 'cloud')).toBe(true);
  }, TEST_TIMEOUT_MS);
});
