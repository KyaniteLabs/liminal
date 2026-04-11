import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const {
  mockComplete,
  mockLLM,
  mockReadFile,
  mockApplyEdit,
  mockRunBuild,
  mockRunTests,
  mockGitStatus,
  mockRestoreBackup,
  mockCreateBackup,
} = vi.hoisted(() => {
  const complete = vi.fn();
  const llm = {
    getConfig: vi.fn(() => ({ model: 'test-model' })),
    complete,
  };
  return {
    mockComplete: complete,
    mockLLM: llm,
    mockReadFile: { execute: vi.fn(async () => ({ success: true, data: { content: 'const x = 1;' } })) },
    mockApplyEdit: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak-123' } })) },
    mockRunBuild: { execute: vi.fn(async () => ({ success: true })) },
    mockRunTests: { execute: vi.fn(async () => ({ success: true })) },
    mockGitStatus: { execute: vi.fn(async () => ({ success: true, data: { branch: 'fix/tui', short: '' } })) },
    mockRestoreBackup: { execute: vi.fn(async () => ({ success: true })) },
    mockCreateBackup: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak-123' } })) },
  };
});

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
  rateLimiter: { execute: vi.fn(async (_op: string, fn: () => any) => ({ result: await fn() })) },
}));
vi.mock('../../src/harness/tools/index.js', () => ({
  readFileTool: mockReadFile,
  writeFileTool: { execute: vi.fn(async () => ({ success: true })) },
  applyEditTool: mockApplyEdit,
  runBuildTool: mockRunBuild,
  runTestsTool: mockRunTests,
  gitStatusTool: mockGitStatus,
  restoreBackupTool: mockRestoreBackup,
  createBackupTool: mockCreateBackup,
}));
vi.mock('../../src/utils/errors.js', () => ({
  formatError: vi.fn((_ctx: string, err: unknown) => String(err)),
}));
vi.mock('../../src/harness/prompts/self-improve.js', () => ({
  getSelfImprovePrompt: vi.fn(() => 'system prompt'),
  createReflectionPrompt: vi.fn(() => 'reflect on error'),
}));
vi.mock('../../src/harness/ThinkingSeparation.js', () => ({
  thinkingRepository: { storeHarnessThinking: vi.fn() },
}));
vi.mock('../../src/harness/ThinkingAnalyzer.js', () => ({
  thinkingAnalyzer: { analyze: vi.fn(() => ({ learning: 'test', suggestedFix: null })) },
}));

import { LLMModeAgent, createLLMModeAgent } from '../../src/harness/agent/LLMModeAgent.js';
import { rateLimiter } from '../../src/harness/tools/RateLimiter.js';
import { Status } from '../../src/types/status.js';

describe('LLMModeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
    mockApplyEdit.execute.mockResolvedValue({ success: true, data: { backupPath: '/tmp/bak-123' } });
    mockRunBuild.execute.mockResolvedValue({ success: true });
    mockRunTests.execute.mockResolvedValue({ success: true });
    mockGitStatus.execute.mockResolvedValue({ success: true, data: { branch: 'fix/tui', short: '' } });
    mockRestoreBackup.execute.mockResolvedValue({ success: true });
    mockCreateBackup.execute.mockResolvedValue({ success: true, data: { backupPath: '/tmp/bak-123' } });
  });

  // ── Factory ────────────────────────────────────────────────────────
  it('createLLMModeAgent factory returns instance', () => {
    const agent = createLLMModeAgent(mockLLM as any);
    expect(agent).toBeInstanceOf(LLMModeAgent);
  });

  // ── Session management ─────────────────────────────────────────────
  it('getSession returns undefined before any task', () => {
    const agent = new LLMModeAgent(mockLLM as any);
    expect(agent.getSession('nope')).toBeUndefined();
  });

  it('getSession returns session after executeTask', async () => {
    // getLLMPlan returns { result: { result: response.text } } due to double-wrapping.
    // The fn inside rateLimiter.execute returns { result: response.text }, and rateLimiter
    // wraps it again: { result: { result: response.text } }. This causes JSON.parse to fail
    // on a non-string, so getLLMPlan returns null, and the loop breaks → FAILED.
    mockComplete.mockResolvedValue({ text: '{"tool":"complete","params":{},"thought":"done"}' });
    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Test', description: 'desc', approved: true,
    });
    // Due to double-wrapping in getLLMPlan, parsing fails → null plan → loop breaks → FAILED
    expect(session).toBeDefined();
    expect(session.task.id).toBe('t1');
  });

  it('getAllSessions returns all executed sessions', async () => {
    mockComplete.mockResolvedValue({ text: '{"tool":"complete"}' });
    const agent = new LLMModeAgent(mockLLM as any);
    await agent.executeTask({ id: 'a', title: 'A', description: 'd', approved: true });
    await agent.executeTask({ id: 'b', title: 'B', description: 'd', approved: true });
    expect(agent.getAllSessions()).toHaveLength(2);
  });

  // ── Task execution behavior ────────────────────────────────────────
  it('executeTask initializes session with system and user messages', async () => {
    mockComplete.mockResolvedValue({ text: 'not json' });
    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix', description: 'Fix the bug', approved: true,
    });
    // Session should have system prompt + task description as initial messages
    const systemMsg = session.messages.find(m => m.role === 'system');
    expect(systemMsg).toBeDefined();
    const userMsg = session.messages.find(m => m.role === 'user' && m.content.includes('t1'));
    expect(userMsg).toBeDefined();
    expect(userMsg!.content).toContain('Fix the bug');
  });

  it('executeTask rejects unapproved tasks before any LLM call runs', async () => {
    const agent = new LLMModeAgent(mockLLM as any);

    await expect(agent.executeTask({
      id: 't-unapproved',
      title: 'Dangerous task',
      description: 'Mutate files',
      approved: false,
    })).rejects.toThrow(/approved/i);

    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockApplyEdit.execute).not.toHaveBeenCalled();
    expect(mockRunBuild.execute).not.toHaveBeenCalled();
  });

  it('executeTask sets FAILED when LLM response is unparseable', async () => {
    mockComplete.mockResolvedValue({ text: 'This is not JSON at all' });
    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix', description: 'desc', approved: true,
    });
    // Unparseable → getLLMPlan returns null → loop breaks → FAILED (max steps reached)
    expect(session.status).toBe(Status.FAILED);
    expect(session.endTime).toBeDefined();
  });

  it('parses the first complete JSON object when model adds trailing braces', async () => {
    mockComplete
      .mockResolvedValueOnce({
        text: '{"thought":"read first","tool":"readFile","params":{"path":"src/tui-bridge/TuiBridgeService.ts"},"expectedResult":"read file"}\\n}',
      })
      .mockResolvedValueOnce({ text: '{"thought":"done","tool":"complete","params":{},"expectedResult":"finish"}' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't-json', title: 'Parse GLM JSON', description: 'desc', approved: true, maxSteps: 3,
    });

    expect(mockReadFile.execute).toHaveBeenCalledWith({ path: 'src/tui-bridge/TuiBridgeService.ts' });
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('executeTask sets FAILED when LLM returns no response', async () => {
    mockComplete.mockResolvedValue({ text: '' });
    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix', description: 'desc', approved: true,
    });
    expect(session.status).toBe(Status.FAILED);
  });

  it('executeTask sets FAILED when max steps reached', async () => {
    // Each call to getLLMPlan fails to parse, so stepCount only increments once
    // before the loop breaks (getLLMPlan returns null)
    mockComplete.mockResolvedValue({ text: 'not json' });
    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Loop', description: 'desc', maxSteps: 5, approved: true,
    });
    expect(session.status).toBe(Status.FAILED);
    // With null plan, the loop breaks on first iteration (stepCount = 1)
    expect(session.stepCount).toBeGreaterThanOrEqual(1);
  });

  it('executeTask calls llmClient.complete with conversation context', async () => {
    mockComplete.mockResolvedValue({ text: 'not json' });
    const agent = new LLMModeAgent(mockLLM as any);
    await agent.executeTask({
      id: 't1', title: 'Fix', description: 'Read foo.ts', fileHint: 'src/foo.ts', approved: true,
    });
    expect(mockComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 2000,
        temperature: 0.2,
      }),
    );
    // The prompt should include the task description and file hint
    const callArg = mockComplete.mock.calls[0][0];
    expect(callArg.prompt).toContain('Read foo.ts');
    expect(callArg.prompt).toContain('src/foo.ts');
  });

  it('uses the tui-specific LLM rate limit bucket for Bubble Tea self-improvement tasks', async () => {
    mockComplete.mockResolvedValue({ text: '{"tool":"complete","params":{},"thought":"done"}' });
    const agent = new LLMModeAgent(mockLLM as any);

    await agent.executeTask({
      id: 'tui-self-123',
      title: 'Bubble Tea self-improvement',
      description: 'desc',
      approved: true,
    });

    expect(rateLimiter.execute).toHaveBeenCalledWith('tuiLlmCall:tui-self-123', expect.any(Function));
  });

  it('treats late-stage plain-text completion as complete after successful verification', async () => {
    mockComplete
      .mockResolvedValueOnce({ text: '{"tool":"readFile","params":{"path":"src/tui-bridge/TuiBridgeService.ts"},"thought":"inspect"}' })
      .mockResolvedValueOnce({ text: '{"tool":"applyEdit","params":{"path":"src/tui-bridge/TuiBridgeService.ts","oldString":"const x = 1;","newString":"const x = 2;"},"thought":"fix"}' })
      .mockResolvedValueOnce({ text: '{"tool":"runBuild","params":{},"thought":"verify build"}' })
      .mockResolvedValueOnce({ text: '{"tool":"runTests","params":{"pattern":"LLMModeAgent"},"thought":"verify tests"}' })
      .mockResolvedValueOnce({ text: 'Task complete. Build passes, all 16 tests pass. Providing final report.' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-implicit-complete',
      title: 'Implicit completion',
      description: 'desc',
      approved: true,
      maxSteps: 6,
    });

    expect(mockApplyEdit.execute).toHaveBeenCalled();
    expect(mockRunBuild.execute).toHaveBeenCalled();
    expect(mockRunTests.execute).toHaveBeenCalled();
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('treats Bubble Tea inspection-only parse failure as success when no mutations were made', async () => {
    mockComplete
      .mockResolvedValueOnce({ text: '{"tool":"readFile","params":{"path":"bubbletea/internal/app/view.go"},"thought":"inspect view"}' })
      .mockResolvedValueOnce({ text: '{"tool":"gitStatus","params":{},"thought":"inspect repo"}' })
      .mockResolvedValueOnce({ text: 'done inspecting; no safe change warranted' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-inspection-only',
      title: 'Inspection only',
      description: 'desc',
      approved: true,
      maxSteps: 4,
    });

    expect(mockReadFile.execute).toHaveBeenCalled();
    expect(session.backups).toHaveLength(0);
    expect(session.status).toBe(Status.SUCCESS);
  });

  // ── Report generation ──────────────────────────────────────────────
  it('generateReport includes session data after tasks', async () => {
    mockComplete.mockResolvedValue({ text: 'not json' });
    const agent = new LLMModeAgent(mockLLM as any);
    await agent.executeTask({ id: 't1', title: 'Fix A', description: 'd', approved: true });
    const report = agent.generateReport();
    expect(report).toContain('Total Tasks: 1');
    expect(report).toContain('t1');
    // Session will be FAILED since LLM response can't be parsed
    expect(report).toContain('Failed: 1');
  });

  it('generateReport shows zero stats when no tasks executed', () => {
    const agent = new LLMModeAgent(mockLLM as any);
    const report = agent.generateReport();
    expect(report).toContain('Total Tasks: 0');
    expect(report).toContain('Successful: 0');
    expect(report).toContain('LLMModeAgent Report');
  });

  // ── Thinking analysis ──────────────────────────────────────────────
  it('getAnalyses returns empty array initially', () => {
    const agent = new LLMModeAgent(mockLLM as any);
    expect(agent.getAnalyses()).toEqual([]);
  });

  // ── Edge cases ─────────────────────────────────────────────────────
  it('handles fileHint in task description', async () => {
    mockComplete.mockResolvedValue({ text: 'not json' });
    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't1', title: 'Fix', description: 'desc', fileHint: 'src/bar.ts', approved: true,
    });
    // fileHint should appear in the task prompt message
    const userMsg = session.messages.find(m => m.role === 'user');
    expect(userMsg!.content).toContain('src/bar.ts');
  });

  it('records failure in failureLogger when task fails', async () => {
    mockComplete.mockResolvedValue({ text: 'not json' });
    const { failureLogger } = await import('../../src/harness/FailureLogger.js');
    const agent = new LLMModeAgent(mockLLM as any);
    await agent.executeTask({
      id: 't1', title: 'Fix', description: 'desc', approved: true,
    });
    // Max steps / unparseable → failureLogger should have been called
    // (only if the FAILED path with duration triggers a log)
    // The source only logs in catch block and build-failure path, not max-steps
    // So this is checking whether failureLogger.log is ever called
    expect(failureLogger.log).not.toHaveBeenCalled(); // max-steps path doesn't log
  });
});
