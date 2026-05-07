/**
 * Global test setup — isolate tests from user's environment.
 *
 * Saves and clears all LLM-related env vars before tests run,
 * restores them after all tests complete. This prevents generators
 * from attempting real LLM calls when the server isn't running.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

const nativeFetch = globalThis.fetch?.bind(globalThis);
if (nativeFetch) {
  (globalThis as typeof globalThis & { __liminalNativeFetch?: typeof fetch }).__liminalNativeFetch = nativeFetch;
}

function installQuietCanvasFallbacks(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;

  function quietToDataURL(): string {
    return null as unknown as string;
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => null,
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    writable: true,
    // toDataURL is unsupported in jsdom without canvas. Preserve that null
    // behavior without invoking jsdom's not-implemented logger.
    value: quietToDataURL,
  });
}

installQuietCanvasFallbacks();

function installQuietAudioFallbacks(): void {
  if (typeof (globalThis as any).AudioContext === 'undefined') {
    (globalThis as any).AudioContext = class QuietAudioContext {
      close() { return Promise.resolve(); }
      createGain() { return { gain: { value: 0 }, connect: () => {}, disconnect: () => {} }; }
      createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, disconnect: () => {} }; }
      createAnalyser() { return { connect: () => {}, disconnect: () => {} }; }
      get destination() { return {}; }
      get currentTime() { return 0; }
      get sampleRate() { return 44100; }
      get state() { return 'running'; }
      resume() { return Promise.resolve(); }
    };
  }
  if (typeof (globalThis as any).OfflineAudioContext === 'undefined') {
    (globalThis as any).OfflineAudioContext = class QuietOfflineAudioContext {
      constructor(_channels?: number, _length?: number, _sampleRate?: number) {}
      startRendering() { return Promise.resolve({ getChannelData: () => new Float32Array(0) } as any); }
      createGain() { return { gain: { value: 0 }, connect: () => {}, disconnect: () => {} }; }
      get destination() { return {}; }
      get currentTime() { return 0; }
      get sampleRate() { return 44100; }
    };
  }
}

installQuietAudioFallbacks();

// Environment variables to isolate
const LLM_ENV_KEYS = [
  'LIMINAL_LLM_PROVIDER',
  'LIMINAL_LLM_API_KEY',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_MODEL',
  'LIMINAL_HARNESS_API_KEY',
  'LIMINAL_HARNESS_BASE_URL',
  'LIMINAL_HARNESS_MODEL',
  'LIMINAL_EVALUATOR_API_KEY',
  'LIMINAL_EVALUATOR_BASE_URL',
  'LIMINAL_EVALUATOR_MODEL',
  'ATELIER_LLM_API_KEY',
  'ATELIER_LLM_BASE_URL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'GLM_API_KEY',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENROUTER_API_KEY',
  'MINIMAX_API_KEY',
  'MISTRAL_API_KEY',
  'DEEPSEEK_API_KEY',
  'ZAI_API_KEY',
  'LMSTUDIO_API_KEY',
  'OLLAMA_API_KEY',
  'LIMINAL_REASONING_URL',
  'LLM_PROVIDER',
  'LLM_API_KEY',
  'LLM_BASE_URL',
  'LLM_MODEL',
  'HARNESS_API_KEY',
  'HARNESS_BASE_URL',
  'HARNESS_MODEL',
  'EVALUATOR_API_KEY',
  'EVALUATOR_BASE_URL',
  'EVALUATOR_MODEL',
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

function shouldPreserveLiveLLMEnv(): boolean {
  return Boolean(
    process.env.RUN_CLOUD_MODEL_TESTS
    || process.env.RUN_DUAL_LLM_TESTS
    || process.env.RUN_LOCAL_MODEL_TESTS
    || process.env.RUN_LFM_MODEL_TESTS
    || process.env.RUN_MODEL_COMPARISON
    || process.env.RUN_MINIMAX_HIGHSPEED_MODEL_TESTS
    || process.env.LIMINAL_ALLOW_LIVE_LLM_TESTS
  );
}

beforeAll(() => {
  const preserveLiveLLMEnv = shouldPreserveLiveLLMEnv();

  // Save and clear LLM environment variables
  for (const key of LLM_ENV_KEYS) {
    saved[key] = process.env[key];
    if (!preserveLiveLLMEnv) delete process.env[key];
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
  installQuietCanvasFallbacks();
  installQuietAudioFallbacks();

  // Normal tests stay hermetic. Explicit live-provider gates keep credentials
  // because those suites exist to prove real configured provider behavior.
  if (!shouldPreserveLiveLLMEnv()) {
    for (const key of LLM_ENV_KEYS) {
      delete process.env[key];
    }
  }

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
