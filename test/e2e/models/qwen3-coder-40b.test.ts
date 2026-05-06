import { describe, it, expect, beforeAll } from 'vitest';
/**
 * Qwen coder-compatible LM Studio proof.
 *
 * Prefer a coder/repo-pipeline model when present, then fall back to any
 * Qwen-compatible local model so the test proves the available local surface.
 */

import { createLmStudioClient, selectLmStudioModel } from '../helpers/liveProviderTestEnv.js';
import type { LLMClient } from '../../../src/llm/LLMClient.js';

const TEST_TIMEOUT = 75000;
const LOCAL_REQUEST_TIMEOUT_MS = 60000;

describe.skipIf(process.env.CI || !process.env.RUN_LOCAL_MODEL_TESTS)('Qwen coder-compatible LM Studio model', () => {
  let model: string;
  let client: LLMClient;

  beforeAll(async () => {
    model = await selectLmStudioModel([/coder/i, /repo-pipeline/i, /qwen/i]);
    client = createLmStudioClient(model);
  });

  it('generates bounded p5.js draw code', async () => {
    const response = await client.generate(
      'You are a creative-coding assistant. Output final JavaScript only, with no reasoning text.',
      'Return only this JavaScript line: function draw(){background(0);circle(60,60,24);}',
      AbortSignal.timeout(LOCAL_REQUEST_TIMEOUT_MS),
    );

    expect(response.success).toBe(true);
    expect(response.provenance?.model).toBe(model);
    expect(response.code).toContain('function draw');
    expect(response.code).toContain('circle');
    expect(response.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('records which local model satisfied the coder-compatible proof', () => {
    expect(model.toLowerCase()).toMatch(/coder|repo-pipeline|qwen/);
  });
});
