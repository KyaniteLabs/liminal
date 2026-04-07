/**
 * Global test setup — make the default Vitest lane hermetic.
 *
 * Tests should not write to the user's real ~/.liminal or mutate live LLM
 * environment unless an explicit opt-in lane is running.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach } from 'vitest';

const LLM_ENV_KEYS = [
  'LIMINAL_LLM_PROVIDER',
  'LIMINAL_LLM_API_KEY',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_MODEL',
  'ATELIER_LLM_API_KEY',
  'ATELIER_LLM_BASE_URL',
  'OPENAI_API_KEY',
  'MINIMAX_API_KEY',
  'LIMINAL_REASONING_URL',
] as const;

const originalEnv = { ...process.env };
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-test-home-'));
const liminalHome = path.join(testHome, '.liminal');

process.env.NODE_ENV = 'test';
process.env.HOME = testHome;
process.env.LIMINAL_TEST = '1';

for (const dir of [
  liminalHome,
  path.join(liminalHome, 'archive'),
  path.join(liminalHome, 'failures'),
  path.join(liminalHome, 'memory'),
  path.join(liminalHome, 'reasoning'),
  path.join(liminalHome, 'routing'),
  path.join(liminalHome, 'thinking-traces'),
  path.join(liminalHome, 'tool-telemetry'),
]) {
  fs.mkdirSync(dir, { recursive: true });
}

for (const key of LLM_ENV_KEYS) {
  delete process.env[key];
}

afterAll(() => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  fs.rmSync(testHome, { recursive: true, force: true });
});

beforeEach(async () => {
  const { LLMClient } = await import('../src/llm/LLMClient.js');
  if (typeof LLMClient.clearGlobalCache === 'function') {
    LLMClient.clearGlobalCache();
  }
});
