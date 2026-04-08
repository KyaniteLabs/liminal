/**
 * Global test setup — isolate tests from user's environment.
 *
 * Saves and clears all LLM-related env vars before tests run,
 * restores them after all tests complete. This prevents generators
 * from attempting real LLM calls when the server isn't running.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Environment variables to isolate
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
  'LLM_PROVIDER',
  'LLM_API_KEY',
  'LLM_BASE_URL',
] as const;

// CI-specific variables that tests might depend on
const CI_ENV_KEYS = [
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'CIRCLECI',
  'TRAVIS',
  'JENKINS_URL',
] as const;

const saved: Record<string, string | undefined> = {};
let originalTestEnv: string | undefined;

beforeAll(() => {
  // Save and clear LLM environment variables
  for (const key of LLM_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  
  // Save CI environment state
  for (const key of CI_ENV_KEYS) {
    saved[key] = process.env[key];
  }
  
  // Save test environment marker
  originalTestEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
});

beforeEach(() => {
  // Reset modules cache for environment-dependent tests
  vi?.resetModules?.();
  
  // Ensure test environment is set
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
});

afterAll(() => {
  // Restore LLM environment variables
  for (const key of LLM_ENV_KEYS) {
    if (saved[key] !== undefined) {
      process.env[key] = saved[key];
    } else {
      delete process.env[key];
    }
  }
  
  // Restore CI environment variables
  for (const key of CI_ENV_KEYS) {
    if (saved[key] !== undefined) {
      process.env[key] = saved[key];
    }
  }
  
  // Restore original test environment
  if (originalTestEnv !== undefined) {
    process.env.NODE_ENV = originalTestEnv;
  } else {
    delete process.env.NODE_ENV;
  }
  
  // Keep VITEST=true during cleanup to prevent side effects
});

// Global test timeout configuration
export const TEST_TIMEOUT = 30000;
export const E2E_TIMEOUT = 120000;
