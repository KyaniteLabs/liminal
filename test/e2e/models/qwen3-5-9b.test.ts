import { describe, it, expect, beforeAll } from 'vitest';
/**
 * Qwen-compatible LM Studio proof.
 *
 * The local launch claim is "a configured Qwen-like LM Studio model works",
 * not that every developer has the old hard-coded qwen3.5-9b model ID.
 */

import { createLmStudioClient, selectLmStudioModel } from '../helpers/liveProviderTestEnv.js';
import type { LLMClient } from '../../../src/llm/LLMClient.js';

const TEST_TIMEOUT = 45000;
const LOCAL_REQUEST_TIMEOUT_MS = 30000;

describe.skipIf(process.env.CI || !process.env.RUN_LOCAL_MODEL_TESTS)('Qwen-compatible LM Studio model', () => {
  let model: string;
  let client: LLMClient;

  beforeAll(async () => {
    model = await selectLmStudioModel([/qwen3\.5/i, /qwen35/i, /qwen/i]);
    client = createLmStudioClient(model);
  });

  it('generates bounded p5.js setup code', async () => {
    const response = await client.generate(
      'You are a p5.js coder. Output final JavaScript only, with no reasoning text.',
      'Return only this JavaScript line: function setup(){createCanvas(120,120);}',
      AbortSignal.timeout(LOCAL_REQUEST_TIMEOUT_MS),
    );

    expect(response.success).toBe(true);
    expect(response.provenance?.model).toBe(model);
    expect(response.code).toContain('function setup');
    expect(response.code).toContain('createCanvas');
    expect(response.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('records which local model satisfied the Qwen-compatible proof', () => {
    expect(model.toLowerCase()).toMatch(/qwen|repo-pipeline/);
  });
});
