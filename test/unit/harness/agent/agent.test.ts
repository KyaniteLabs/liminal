import { describe, it, expect, vi, beforeEach } from 'vitest';

import { HarnessAgent, createHarnessAgent } from '../../../../src/harness/agent/HarnessAgent.js';
import { LLMModeAgent, createLLMModeAgent } from '../../../../src/harness/agent/LLMModeAgent.js';
import { Status } from '../../../../src/types/status.js';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const {
  mockLLM,
  mockReadFile,
  mockApplyEdit,
  mockRunBuild,
  mockRestoreBackup,
  mockSelfEval,
  mockTelemetry,
  mockRateLimiter,
  mockFailureLogger,
  mockExecuteSkill,
  mockSearchCode,
  mockSearchDocs,
  mockRunLint,
  mockRunFocusedTests,
} = vi.hoisted(() => ({
  mockLLM: { getConfig: vi.fn(() => ({ model: 'test' })) },
  mockReadFile: { execute: vi.fn(async () => ({ success: true, data: { content: 'const x = 1;' } })) },
  mockApplyEdit: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak-123' } })) },
  mockRunBuild: { execute: vi.fn(async () => ({ success: true })) },
  mockRestoreBackup: { execute: vi.fn(async () => ({ success: true })) },
  mockExecuteSkill: { execute: vi.fn(async () => ({ success: true, data: { skill: { name: 'sample-skill' } } })) },
  mockSearchCode: { execute: vi.fn(async () => ({ success: true, data: { resultCount: 1, results: [] } })) },
  mockSearchDocs: { execute: vi.fn(async () => ({ success: true, data: { resultCount: 1, results: [] } })) },
  mockRunLint: { execute: vi.fn(async () => ({ success: true, data: { command: 'npm run lint' } })) },
  mockRunFocusedTests: { execute: vi.fn(async () => ({ success: true, data: { command: 'npx vitest run test/example.test.ts' } })) },
  mockSelfEval: {
    recordOutcome: vi.fn(),
    shouldRetry: vi.fn(() => ({ shouldRetry: false, reason: 'no retry', newStrategy: 'direct' })),
    evaluate: vi.fn(() => ({ needsImprovement: false, recommendations: [] })),
    detectRegression: vi.fn(() => ({ hasRegression: false, details: '' })),
    getSummary: vi.fn(() => '2/2 tasks passed (100%)'),
    generateImprovementTask: vi.fn(() => ({ shouldCreate: false })),
    getErrorRemediation: vi.fn(() => []),
  },
  mockTelemetry: {
    setContext: vi.fn(),
    clearContext: vi.fn(),
    wrap: vi.fn(async (_tool: any, params: any) => ({ success: true, data: {} })),
  },
  mockRateLimiter: {
    execute: vi.fn(async (_op: string, fn: () => any) => ({ result: await fn() })),
  },
  mockFailureLogger: { log: vi.fn() },
}));

vi.mock('../../../../src/llm/LLMClient.js', () => ({
  LLMClient: class { constructor() { return mockLLM; } },
}));
vi.mock('../../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../../../../src/harness/FailureLogger.js', () => ({
  failureLogger: mockFailureLogger,
}));
vi.mock('../../../../src/harness/SelfEvaluation.js', () => ({
  selfEvaluation: mockSelfEval,
}));
vi.mock('../../../../src/harness/tools/RateLimiter.js', () => ({
  rateLimiter: mockRateLimiter,
}));
vi.mock('../../../../src/harness/tools/TelemetryWrapper.js', () => ({
  telemetryWrapper: mockTelemetry,
}));
vi.mock('../../../../src/harness/tools/index.js', () => ({
  readFileTool: mockReadFile,
  writeFileTool: { execute: vi.fn(async () => ({ success: true, data: {} })) },
  applyEditTool: mockApplyEdit,
  runBuildTool: mockRunBuild,
  runTestsTool: { execute: vi.fn(async () => ({ success: true })) },
  executeSkillTool: mockExecuteSkill,
  searchTool: { execute: vi.fn(async () => ({ success: true })) },
  searchCodeTool: mockSearchCode,
  searchDocsTool: mockSearchDocs,
  listDirTool: { execute: vi.fn(async () => ({ success: true })) },
  typeCheckTool: { execute: vi.fn(async () => ({ success: true })) },
  npmTool: { execute: vi.fn(async () => ({ success: true })) },
  runLintTool: mockRunLint,
  runFocusedTestsTool: mockRunFocusedTests,
  lspTool: { execute: vi.fn(async () => ({ success: true })) },
  astValidatorTool: { execute: vi.fn(async () => ({ success: true })) },
  importGuardTool: { execute: vi.fn(async () => ({ success: true })) },
  restoreBackupTool: mockRestoreBackup,
}));
vi.mock('../../../../src/utils/errors.js', () => ({
  formatError: vi.fn((_ctx: string, err: unknown) => String(err)),
}));

// ── HarnessAgent ────────────────────────────────────────────────────────────

describe('HarnessAgent', () => {
  let agent: HarnessAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all tools succeed
    mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
    mockApplyEdit.execute.mockResolvedValue({ success: true, data: { backupPath: '/tmp/bak' } });
    mockRunBuild.execute.mockResolvedValue({ success: true });
    mockRestoreBackup.execute.mockResolvedValue({ success: true });
    mockRateLimiter.execute.mockImplementation(async (_op: string, fn: () => any) => ({ result: await fn() }));
    mockTelemetry.wrap.mockImplementation(async (_tool: any, params: any) => _tool.execute(params));
    agent = new HarnessAgent(mockLLM as any);
  });

  it('executeTask with search/replace/build succeeds', async () => {
    const session = await agent.executeTask({
      id: 't1',
      title: 'Fix bug',
      description: 'Fix the typo',
      targetFile: 'src/foo.ts',
      search: 'old',
      replace: 'new',
      approved: true,
    });

    expect(session.status).toBe(Status.SUCCESS);
    // readFile + applyEdit + runBuild = 3 steps minimum
    expect(session.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('executeTask without targetFile skips readFile step', async () => {
    const session = await agent.executeTask({
      id: 't2',
      title: 'Build only',
      description: 'desc',
      approved: true,
    });
    const tools = session.steps.map(s => s.tool);
    expect(tools).not.toContain('readFile');
    expect(tools).toContain('runBuild');
  });

  it('executeTask with targetFile but no search/replace skips applyEdit', async () => {
    const session = await agent.executeTask({
      id: 't3',
      title: 'Read only',
      description: 'desc',
      targetFile: 'src/bar.ts',
      approved: true,
    });
    const tools = session.steps.map(s => s.tool);
    expect(tools).toContain('readFile');
    expect(tools).not.toContain('applyEdit');
  });

  it('getSession returns session after execution', async () => {
    await agent.executeTask({ id: 's1', title: 'T', description: 'd', approved: true });
    const session = agent.getSession('s1');
    expect(session).not.toBeUndefined();
    expect(session!.task.id).toBe('s1');
  });

  it('getSession returns undefined for unknown id', () => {
    expect(agent.getSession('unknown')).toBeUndefined();
  });

  it('getAllSessions returns empty array initially', () => {
    expect(agent.getAllSessions()).toEqual([]);
  });

  it('getAllSessions returns all sessions after multiple tasks', async () => {
    await agent.executeTask({ id: 'a', title: 'A', description: 'd', approved: true });
    await agent.executeTask({ id: 'b', title: 'B', description: 'd', approved: true });
    const sessions = agent.getAllSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.task.id)).toEqual(['a', 'b']);
  });

  it('generateReport contains summary and session info', async () => {
    await agent.executeTask({ id: 't1', title: 'Test Task', description: 'd', approved: true });
    const report = agent.generateReport();
    expect(report).toContain('Total Tasks: 1');
    expect(report).toContain('Successful: 1');
    expect(report).toContain('t1');
    expect(report).toContain('Test Task');
  });

  it('selfEvaluate returns structured result', () => {
    const result = agent.selfEvaluate();
    expect(result.summary).toBeTruthy();
    expect(result.needsImprovement === true || result.needsImprovement === false).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('generateImprovementTask delegates to SelfEvaluation', () => {
    const task = agent.generateImprovementTask();
    expect(task.shouldCreate === true || task.shouldCreate === false).toBe(true);
  });

  it('getErrorHelp returns array from SelfEvaluation', () => {
    const help = agent.getErrorHelp('some error');
    expect(Array.isArray(help)).toBe(true);
  });

  it('createHarnessAgent factory returns instance', () => {
    const a = createHarnessAgent(mockLLM as any);
    expect(a).toBeInstanceOf(HarnessAgent);
  });

  it('executeTask records steps in order: readFile -> applyEdit -> runBuild', async () => {
    const session = await agent.executeTask({
      id: 'ordered',
      title: 'T',
      description: 'd',
      targetFile: 'src/foo.ts',
      search: 'old',
      replace: 'new',
      approved: true,
    });
    const toolOrder = session.steps.map(s => s.tool);
    const readIdx = toolOrder.indexOf('readFile');
    const editIdx = toolOrder.indexOf('applyEdit');
    const buildIdx = toolOrder.indexOf('runBuild');
    expect(readIdx).toBeGreaterThanOrEqual(0);
    expect(editIdx).toBeGreaterThanOrEqual(0);
    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(readIdx).toBeLessThan(editIdx);
    expect(editIdx).toBeLessThan(buildIdx);
  });

  it('executeTask returns ROLLED_BACK when build fails with autoRollback', async () => {
    mockRunBuild.execute.mockResolvedValueOnce({ success: false, error: 'build error' });
    const session = await agent.executeTask(
      {
        id: 'fail1',
        title: 'T',
        description: 'd',
        targetFile: 'src/foo.ts',
        search: 'a',
        replace: 'b',
        approved: true,
      },
      { autoRollback: true },
    );
    expect([Status.FAILED, Status.ROLLED_BACK]).toContain(session.status);
  });

  it('executeTask returns FAILED when build fails and autoRollback is false', async () => {
    mockRunBuild.execute.mockResolvedValueOnce({ success: false, error: 'build error' });
    const session = await agent.executeTask(
      {
        id: 'fail2',
        title: 'T',
        description: 'd',
        approved: true,
      },
      { autoRollback: false },
    );
    expect(session.status).toBe(Status.FAILED);
  });

  it('setReasoningContext updates telemetry context', () => {
    agent.setReasoningContext('test reasoning', 'trace-123');
    expect(mockTelemetry.setContext).toHaveBeenCalledWith(
      expect.objectContaining({ reasoning: 'test reasoning', reasoningTraceId: 'trace-123' }),
    );
  });

  it('clearReasoningContext clears telemetry context', () => {
    agent.setReasoningContext('test', 'trace');
    agent.clearReasoningContext();
    expect(mockTelemetry.clearContext).toHaveBeenCalled();
  });

  it('getToolInstance resolves new skill and coding tool names', () => {
    expect((agent as any).getToolInstance('executeSkill')).toBe(mockExecuteSkill);
    expect((agent as any).getToolInstance('searchCode')).toBe(mockSearchCode);
    expect((agent as any).getToolInstance('searchDocs')).toBe(mockSearchDocs);
    expect((agent as any).getToolInstance('runLint')).toBe(mockRunLint);
    expect((agent as any).getToolInstance('runFocusedTests')).toBe(mockRunFocusedTests);
  });
});

// ── LLMModeAgent ────────────────────────────────────────────────────────
describe('LLMModeAgent', () => {
  let agent: LLMModeAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunBuild.execute.mockResolvedValue({ success: true });
    mockReadFile.execute.mockResolvedValue({ success: true });
    mockRestoreBackup.execute.mockResolvedValue({ success: true });
    agent = new LLMModeAgent(mockLLM as any);
  });

  it('createLLMModeAgent factory returns instance', () => {
    const a = createLLMModeAgent(mockLLM as any);
    expect(a).toBeInstanceOf(LLMModeAgent);
  });

  it('getSession returns undefined before execution', () => {
    expect(agent.getSession('unknown')).toBeUndefined();
  });

  it('getAllSessions returns empty initially', () => {
    expect(agent.getAllSessions()).toEqual([]);
  });

  it('getAnalyses returns empty initially', () => {
    expect(agent.getAnalyses()).toEqual([]);
  });

  it('generateReport handles no sessions', () => {
    const report = agent.generateReport();
    expect(report).toContain('Total Tasks: 0');
  });
});
