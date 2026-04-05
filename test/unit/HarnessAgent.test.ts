import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────
const { mockLLM, mockReadFile, mockApplyEdit, mockRunBuild, mockRestoreBackup } = vi.hoisted(() => ({
  mockLLM: { getConfig: vi.fn(() => ({ model: 'test' })) },
  mockReadFile: { execute: vi.fn(async () => ({ success: true, data: { content: 'const x = 1;' } })) },
  mockApplyEdit: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak-123' } })) },
  mockRunBuild: { execute: vi.fn(async () => ({ success: true })) },
  mockRestoreBackup: { execute: vi.fn(async () => ({ success: true })) },
}));

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
    getSummary: vi.fn(() => '2/2 tasks passed (100%)'),
    generateImprovementTask: vi.fn(() => ({ shouldCreate: false })),
    getErrorRemediation: vi.fn(() => []),
  },
}));
vi.mock('../../src/harness/tools/RateLimiter.js', () => ({
  rateLimiter: { execute: vi.fn(async (_op: string, fn: () => any) => ({ result: await fn() })) },
}));
vi.mock('../../src/harness/tools/TelemetryWrapper.js', () => ({
  telemetryWrapper: {
    setContext: vi.fn(),
    clearContext: vi.fn(),
    // Real wrap() calls tool.execute(params) and returns the result
    wrap: vi.fn(async (tool: any, params: any) => tool.execute(params)),
  },
}));
vi.mock('../../src/harness/tools/index.js', () => ({
  readFileTool: mockReadFile,
  writeFileTool: { execute: vi.fn(async () => ({ success: true })) },
  applyEditTool: mockApplyEdit,
  runBuildTool: mockRunBuild,
  runTestsTool: { execute: vi.fn(async () => ({ success: true })) },
  searchTool: { execute: vi.fn(async () => ({ success: true })) },
  listDirTool: { execute: vi.fn(async () => ({ success: true })) },
  typeCheckTool: { execute: vi.fn(async () => ({ success: true })) },
  npmTool: { execute: vi.fn(async () => ({ success: true })) },
  lspTool: { execute: vi.fn(async () => ({ success: true })) },
  astValidatorTool: { execute: vi.fn(async () => ({ success: true })) },
  importGuardTool: { execute: vi.fn(async () => ({ success: true })) },
  restoreBackupTool: mockRestoreBackup,
}));
vi.mock('../../src/utils/errors.js', () => ({
  formatError: vi.fn((_ctx: string, err: unknown) => String(err)),
}));

import { HarnessAgent, createHarnessAgent } from '../../src/harness/agent/HarnessAgent.js';
import { Status } from '../../src/types/status.js';

describe('HarnessAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset tool mock defaults
    mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
    mockApplyEdit.execute.mockResolvedValue({ success: true, data: { backupPath: '/tmp/bak-123' } });
    mockRunBuild.execute.mockResolvedValue({ success: true });
    mockRestoreBackup.execute.mockResolvedValue({ success: true });
  });

  // ── Factory ────────────────────────────────────────────────────────
  it('createHarnessAgent factory returns instance', () => {
    const agent = createHarnessAgent(mockLLM as any);
    expect(agent).toBeInstanceOf(HarnessAgent);
  });

  // ── Session management ─────────────────────────────────────────────
  it('getSession returns undefined before any task', () => {
    const agent = new HarnessAgent(mockLLM as any);
    expect(agent.getSession('nope')).toBeUndefined();
  });

  it('getSession returns session after executeTask', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    await agent.executeTask({
      id: 't1', title: 'Test', description: 'desc', approved: true,
    });
    const session = agent.getSession('t1');
    expect(session).toBeDefined();
    expect(session!.task.id).toBe('t1');
  });

  it('getAllSessions returns all executed sessions', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    await agent.executeTask({ id: 'a', title: 'A', description: 'd', approved: true });
    await agent.executeTask({ id: 'b', title: 'B', description: 'd', approved: true });
    expect(agent.getAllSessions()).toHaveLength(2);
  });

  // ── Successful task execution ──────────────────────────────────────
  it('executeTask returns SUCCESS when all steps pass', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix typo', description: 'Fix the typo', approved: true,
    });
    expect(session.status).toBe(Status.SUCCESS);
    expect(session.endTime).toBeDefined();
  });

  it('executeTask records steps for targetFile + search/replace', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix',
      description: 'Fix bug',
      targetFile: 'src/foo.ts',
      search: 'old code',
      replace: 'new code',
      approved: true,
    });

    // Should have: readFile, applyEdit, runBuild = 3 steps
    expect(session.steps.length).toBeGreaterThanOrEqual(3);
    expect(session.steps.map(s => s.tool)).toEqual(
      expect.arrayContaining(['readFile', 'applyEdit', 'runBuild']),
    );
    // Steps should be in order
    const toolOrder = session.steps.map(s => s.tool);
    expect(toolOrder.indexOf('readFile')).toBeLessThan(toolOrder.indexOf('applyEdit'));
    expect(toolOrder.indexOf('applyEdit')).toBeLessThan(toolOrder.indexOf('runBuild'));
  });

  it('executeTask skips readFile when no targetFile', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'No file', description: 'desc', approved: true,
    });
    expect(session.steps.map(s => s.tool)).not.toContain('readFile');
  });

  it('executeTask skips applyEdit when no search/replace', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Build only',
      description: 'desc',
      targetFile: 'src/foo.ts',
      approved: true,
    });
    expect(session.steps.map(s => s.tool)).not.toContain('applyEdit');
  });

  // ── Build failure → rollback ───────────────────────────────────────
  it('executeTask returns ROLLED_BACK when build fails', async () => {
    mockRunBuild.execute.mockResolvedValueOnce({ success: false, error: 'SyntaxError: unexpected token' });
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix',
      description: 'Fix bug',
      targetFile: 'src/foo.ts',
      search: 'old', replace: 'new',
      approved: true,
    });
    expect(session.status).toBe(Status.ROLLED_BACK);
  });

  it('executeTask restores backup when rolling back', async () => {
    mockRunBuild.execute.mockResolvedValueOnce({ success: false, error: 'build failed' });
    const agent = new HarnessAgent(mockLLM as any);
    await agent.executeTask({
      id: 't1', title: 'Fix',
      description: 'desc',
      targetFile: 'src/foo.ts',
      search: 'old', replace: 'new',
      approved: true,
    });
    // restoreBackup should have been called during rollback
    expect(mockRestoreBackup.execute).toHaveBeenCalled();
  });

  it('executeTask does not rollback when autoRollback is false', async () => {
    mockRunBuild.execute.mockResolvedValueOnce({ success: false, error: 'build failed' });
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask(
      { id: 't1', title: 'Fix', description: 'desc', approved: true },
      { autoRollback: false },
    );
    expect(session.status).toBe(Status.FAILED);
    expect(mockRestoreBackup.execute).not.toHaveBeenCalled();
  });

  // ── Read failure → ROLLED_BACK (autoRollback) or FAILED ────────────
  it('executeTask returns ROLLED_BACK when targetFile read fails with autoRollback', async () => {
    mockReadFile.execute.mockResolvedValueOnce({ success: false, error: 'ENOENT: file not found' });
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix',
      description: 'desc',
      targetFile: 'src/nonexistent.ts',
      approved: true,
    });
    // readFile failure throws into catch block, which rolls back when autoRollback=true
    expect(session.status).toBe(Status.ROLLED_BACK);
  });

  it('executeTask returns FAILED when targetFile read fails without autoRollback', async () => {
    mockReadFile.execute.mockResolvedValueOnce({ success: false, error: 'ENOENT: file not found' });
    const agent = new HarnessAgent(mockLLM as any);
    const session = await agent.executeTask(
      { id: 't1', title: 'Fix', description: 'desc', targetFile: 'src/nonexistent.ts', approved: true },
      { autoRollback: false },
    );
    expect(session.status).toBe(Status.FAILED);
  });

  // ── Self-evaluation ────────────────────────────────────────────────
  it('selfEvaluate returns summary and recommendations', () => {
    const agent = new HarnessAgent(mockLLM as any);
    const result = agent.selfEvaluate();
    expect(result.summary).toBeTruthy();
    expect(typeof result.needsImprovement).toBe('boolean');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('generateImprovementTask delegates to SelfEvaluation', () => {
    const agent = new HarnessAgent(mockLLM as any);
    const task = agent.generateImprovementTask();
    expect(typeof task.shouldCreate).toBe('boolean');
  });

  it('getErrorHelp delegates to SelfEvaluation', () => {
    const agent = new HarnessAgent(mockLLM as any);
    const help = agent.getErrorHelp('build failed');
    expect(Array.isArray(help)).toBe(true);
  });

  // ── Report generation ──────────────────────────────────────────────
  it('generateReport includes session data after tasks', async () => {
    const agent = new HarnessAgent(mockLLM as any);
    await agent.executeTask({ id: 't1', title: 'Fix A', description: 'd', approved: true });
    const report = agent.generateReport();
    expect(report).toContain('Total Tasks: 1');
    expect(report).toContain('Successful: 1');
    expect(report).toContain('t1');
  });

  // ── Self-evaluation is called on success ───────────────────────────
  it('records success outcome via selfEvaluation', async () => {
    const { selfEvaluation } = await import('../../src/harness/SelfEvaluation.js');
    const agent = new HarnessAgent(mockLLM as any);
    await agent.executeTask({ id: 't1', title: 'T', description: 'd', approved: true });
    expect(selfEvaluation.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1', success: true }),
    );
  });

  it('records failure outcome on thrown errors', async () => {
    // Force a throw from applyEdit by having it fail
    mockApplyEdit.execute.mockResolvedValueOnce({ success: false, error: 'edit failed' });
    const { selfEvaluation } = await import('../../src/harness/SelfEvaluation.js');
    const agent = new HarnessAgent(mockLLM as any);
    await agent.executeTask({
      id: 't1', title: 'T', description: 'd',
      targetFile: 'src/foo.ts', search: 'old', replace: 'new',
      approved: true,
    }, { autoRollback: false });
    // Error thrown from applyEdit goes to catch block which records outcome
    expect(selfEvaluation.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});
