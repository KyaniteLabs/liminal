/**
 * Global test setup — isolate tests from user's LLM environment.
 *
 * Saves and clears all LLM-related env vars before tests run,
 * restores them after all tests complete. This prevents generators
 * from attempting real LLM calls when the server isn't running.
 */

import { beforeAll, afterAll } from 'vitest';
import { withEnv, backupEnv, restoreEnv } from './helpers/env.js';

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

const saved: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const key of LLM_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterAll(() => {
  for (const key of LLM_ENV_KEYS) {
    if (saved[key] !== undefined) {
      process.env[key] = saved[key];
    } else {
      delete process.env[key];
    }
  }
});
