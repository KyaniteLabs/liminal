// Allow explicit local-provider proof runs against LM Studio.
process.env.LIMINAL_ALLOW_LOCALHOST_LLM = 'true';

import { afterAll, describe, expect, it } from 'vitest';

import { getEffectiveConfig } from '../../src/config/ConfigLoader.js';
import type { LLMClient } from '../../src/llm/LLMClient.js';
import {
  backupProviderEnv,
  createLiveProviderClient,
  createLmStudioClient,
  restoreProviderEnv,
  selectLmStudioModel,
} from '../e2e/helpers/liveProviderTestEnv.js';

const RUN_DUAL_LLM =
  process.env.RUN_DUAL_LLM_TESTS === '1' || process.env.RUN_DUAL_LLM_TESTS === 'true';
const LOCAL_TIMEOUT_MS = 60000;
const CLOUD_TIMEOUT_MS = 90000;

async function expectBoundedGeneration(
  client: LLMClient,
  userPrompt: string,
  timeoutMs: number,
): Promise<Awaited<ReturnType<LLMClient['generate']>>> {
  const response = await client.generate(
    'Output final JavaScript only. Do not include reasoning text.',
    userPrompt,
    AbortSignal.timeout(timeoutMs),
  );

  expect(response.success).toBe(true);
  expect(response.code).not.toContain('<think');
  expect(response.code.length).toBeGreaterThan(0);
  return response;
}

describe.skipIf(process.env.CI || !RUN_DUAL_LLM)('Dual LLM provider paths', () => {
  const envBackup = backupProviderEnv(['RUN_DUAL_LLM_TESTS']);

  afterAll(() => {
    restoreProviderEnv(envBackup);
  });

  it('proves the local LM Studio config path with an explicit model', async () => {
    const model = await selectLmStudioModel([/qwen3\.5/i, /qwen35/i, /qwen/i]);
    const client = createLmStudioClient(model);

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('lmstudio');
    expect(config.model).toBe(model);

    const response = await expectBoundedGeneration(
      client,
      'Return only this JavaScript line: function setup(){createCanvas(120,120);}',
      LOCAL_TIMEOUT_MS,
    );
    expect(response.provenance?.model).toBe(model);
  }, LOCAL_TIMEOUT_MS + 15000);

  it('proves the live cloud provider config path', async () => {
    const live = createLiveProviderClient('glm');
    if (!live) {
      throw new Error('RUN_DUAL_LLM_TESTS requires a configured GLM provider credential.');
    }

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('glm');
    expect(config.model).toBe(live.config.model);

    const response = await expectBoundedGeneration(
      live.client,
      'Return only this JavaScript line: function draw(){background(0);circle(60,60,24);}',
      CLOUD_TIMEOUT_MS,
    );
    expect(response.provenance?.model).toBe(live.config.model);
  }, CLOUD_TIMEOUT_MS + 15000);
});
