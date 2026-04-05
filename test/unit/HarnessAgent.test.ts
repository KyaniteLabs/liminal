import { describe, it, expect, vi } from 'vitest';

const mockLLM = { getConfig: vi.fn(() => ({ model: 'test' })) };
vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class { constructor() { return mockLLM; } },
}));
vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../src/harness/FailureLogger.js', () => ({
  failureLogger: { log: vi.fn() },
}));
vi.mock('../../src/harness/SelfEvaluation.js', () => ({
  selfEvaluation: {
    recordOutcome: vi.fn(),
    shouldRetry: vi.fn(() => ({ shouldRetry: false })),
    evaluate: vi.fn(() => ({ needsImprovement: false, recommendations: [] })),
    detectRegression: vi.fn(() => ({ hasRegression: false })),
    getSummary: vi.fn(() => 'ok'),
    generateImprovementTask: vi.fn(() => ({ shouldCreate: false })),
    getErrorRemediation: vi.fn(() => []),
  },
}));
vi.mock('../../src/harness/tools/RateLimiter.js', () => ({
  rateLimiter: { execute: vi.fn(async (_op: string, fn: () => any) => fn()) },
}));
vi.mock('../../src/harness/tools/TelemetryWrapper.js', () => ({
  telemetryWrapper: { setContext: vi.fn(), clearContext: vi.fn(), wrap: vi.fn(async (_t: any, p: any) => ({ success: true, data: p })) },
}));
vi.mock('../../src/harness/tools/index.js', () => ({
  readFileTool: { execute: vi.fn(async () => ({ success: true, data: {} })) },
  writeFileTool: { execute: vi.fn(async () => ({ success: true })) },
  applyEditTool: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak' } })) },
  runBuildTool: { execute: vi.fn(async () => ({ success: true })) },
  runTestsTool: { execute: vi.fn(async () => ({ success: true })) },
  searchTool: { execute: vi.fn(async () => ({ success: true })) },
  listDirTool: { execute: vi.fn(async () => ({ success: true })) },
  typeCheckTool: { execute: vi.fn(async () => ({ success: true })) },
  npmTool: { execute: vi.fn(async () => ({ success: true })) },
  lspTool: { execute: vi.fn(async () => ({ success: true })) },
  astValidatorTool: { execute: vi.fn(async () => ({ success: true })) },
  importGuardTool: { execute: vi.fn(async () => ({ success: true })) },
  restoreBackupTool: { execute: vi.fn(async () => ({ success: true })) },
}));
vi.mock('../../src/utils/errors.js', () => ({
  formatError: vi.fn(() => 'formatted error'),
}));

import { HarnessAgent, createHarnessAgent } from '../../src/harness/agent/HarnessAgent.js';

describe('HarnessAgent', () => {
  it('constructs with an LLMClient', () => {
    const agent = new HarnessAgent(mockLLM as any);
    expect(agent).toBeDefined();
  });

  it('getSession returns undefined for unknown id', () => {
    const agent = new HarnessAgent(mockLLM as any);
    expect(agent.getSession('nope')).toBeUndefined();
  });

  it('generateReport works with no sessions', () => {
    const agent = new HarnessAgent(mockLLM as any);
    const report = agent.generateReport();
    expect(report).toContain('HarnessAgent Report');
    expect(report).toContain('Total Tasks: 0');
  });

  it('createHarnessAgent factory works', () => {
    const agent = createHarnessAgent(mockLLM as any);
    expect(agent).toBeInstanceOf(HarnessAgent);
  });
});
