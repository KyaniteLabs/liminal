import { beforeAll, describe, expect, it } from 'vitest';

import { createLmStudioClient, selectLmStudioModel } from '../helpers/liveProviderTestEnv.js';
import type { LLMClient } from '../../../src/llm/LLMClient.js';

/**
 * LFM 2.5 1.2B local-provider proof.
 *
 * This is gated because it requires the LFM model to be loaded in LM Studio.
 * When the gate is enabled, missing model availability is a real failure, not
 * a silent skip.
 */

const RUN_LFM = process.env.RUN_LFM_MODEL_TESTS === '1' || process.env.RUN_LFM_MODEL_TESTS === 'true';
const TEST_TIMEOUT_MS = 75000;
const REQUEST_TIMEOUT_MS = 60000;

describe.skipIf(process.env.CI || !RUN_LFM)('LFM 2.5 1.2B LM Studio model', () => {
  let model: string;
  let client: LLMClient;

  beforeAll(async () => {
    model = await selectLmStudioModel([/lfm2\.5-1\.2b/i, /lfm2\.5/i, /lfm/i]);
    client = createLmStudioClient(model);
  });

  it('generates bounded p5.js setup code', async () => {
    const response = await client.generate(
      'Output final JavaScript only. Do not include reasoning text.',
      'Return only this JavaScript line: function setup(){createCanvas(120,120);}',
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    );

    expect(response.success).toBe(true);
    expect(response.provenance?.model).toBe(model);
    expect(response.code).toContain('function setup');
    expect(response.code).toContain('createCanvas');
    expect(response.code).not.toContain('<think');
  }, TEST_TIMEOUT_MS);

  it('records which local model satisfied the LFM proof', () => {
    expect(model.toLowerCase()).toContain('lfm');
  });
});
