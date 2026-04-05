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
vi.mock('../../src/harness/tools/RateLimiter.js', () => ({
  rateLimiter: { execute: vi.fn(async (_op: string, fn: () => any) => fn()) },
}));
vi.mock('../../src/harness/tools/index.js', () => ({
  readFileTool: { execute: vi.fn(async () => ({ success: true })) },
  writeFileTool: { execute: vi.fn(async () => ({ success: true })) },
  applyEditTool: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak' } })) },
  runBuildTool: { execute: vi.fn(async () => ({ success: true })) },
  runTestsTool: { execute: vi.fn(async () => ({ success: true })) },
  restoreBackupTool: { execute: vi.fn(async () => ({ success: true })) },
  createBackupTool: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak' } })) },
}));
vi.mock('../../src/utils/errors.js', () => ({
  formatError: vi.fn(() => 'formatted error'),
}));
vi.mock('../../src/harness/prompts/self-improve.js', () => ({
  getSelfImprovePrompt: vi.fn(() => 'system prompt'),
  createReflectionPrompt: vi.fn(() => 'reflect'),
}));
vi.mock('../../src/harness/ThinkingSeparation.js', () => ({
  thinkingRepository: { storeHarnessThinking: vi.fn() },
}));
vi.mock('../../src/harness/ThinkingAnalyzer.js', () => ({
  thinkingAnalyzer: { analyze: vi.fn(() => ({ learning: 'test', suggestedFix: null })) },
}));

import { LLMModeAgent, createLLMModeAgent } from '../../src/harness/agent/LLMModeAgent.js';

describe('LLMModeAgent', () => {
  it('constructs with an LLMClient', () => {
    const agent = new LLMModeAgent(mockLLM as any);
    expect(agent).toBeDefined();
  });

  it('getSession returns undefined for unknown id', () => {
    const agent = new LLMModeAgent(mockLLM as any);
    expect(agent.getSession('nope')).toBeUndefined();
  });

  it('generateReport works with no sessions', () => {
    const agent = new LLMModeAgent(mockLLM as any);
    const report = agent.generateReport();
    expect(report).toContain('LLMModeAgent Report');
    expect(report).toContain('Total Tasks: 0');
  });

  it('createLLMModeAgent factory works', () => {
    const agent = createLLMModeAgent(mockLLM as any);
    expect(agent).toBeInstanceOf(LLMModeAgent);
  });
});
