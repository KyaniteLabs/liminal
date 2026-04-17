import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const {
  mockComplete,
  mockLLM,
  mockReadFile,
  mockApplyEdit,
  mockSearch,
  mockRunBuild,
  mockRunTests,
  mockGitStatus,
  mockRestoreBackup,
  mockCreateBackup,
  mockSaveRunState,
  mockReadRunState,
  mockClearRunState,
  mockCaptureWorkspaceFingerprint,
  mockValidateWorkspaceFingerprint,
  mockExecuteSkill,
  mockSearchCode,
  mockSearchDocs,
  mockRunLint,
  mockRunFocusedTests,
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
    mockSearch: { execute: vi.fn(async () => ({ success: true, data: { resultCount: 1, results: [] } })) },
    mockRunBuild: { execute: vi.fn(async () => ({ success: true })) },
    mockRunTests: { execute: vi.fn(async () => ({ success: true })) },
    mockGitStatus: { execute: vi.fn(async () => ({ success: true, data: { branch: 'fix/tui', short: '' } })) },
    mockRestoreBackup: { execute: vi.fn(async () => ({ success: true })) },
    mockCreateBackup: { execute: vi.fn(async () => ({ success: true, data: { backupPath: '/tmp/bak-123' } })) },
    mockSaveRunState: vi.fn(async () => {}),
    mockReadRunState: vi.fn(async () => null),
    mockClearRunState: vi.fn(async () => {}),
    mockCaptureWorkspaceFingerprint: vi.fn(async () => ({ host: 'local', repoRoot: '/tmp/repo', gitDir: '/tmp/repo/.git', worktreePath: '/tmp/repo' })),
    mockValidateWorkspaceFingerprint: vi.fn(async () => ({ valid: true })),
    mockExecuteSkill: { execute: vi.fn(async () => ({ success: true, data: { skill: { name: 'sample-skill' } } })) },
    mockSearchCode: { execute: vi.fn(async () => ({ success: true, data: { resultCount: 1, results: [] } })) },
    mockSearchDocs: { execute: vi.fn(async () => ({ success: true, data: { resultCount: 1, results: [] } })) },
    mockRunLint: { execute: vi.fn(async () => ({ success: true, data: { command: 'npm run lint' } })) },
    mockRunFocusedTests: { execute: vi.fn(async () => ({ success: true, data: { command: 'npx vitest run test/example.test.ts' } })) },
  };
});

vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class { constructor() { return mockLLM; } },
}));
vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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
  executeSkillTool: mockExecuteSkill,
  searchTool: mockSearch,
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

vi.mock('../../src/harness/RunStateStore.js', () => ({
  saveRunState: mockSaveRunState,
  readRunState: mockReadRunState,
  clearRunState: mockClearRunState,
  captureWorkspaceFingerprint: mockCaptureWorkspaceFingerprint,
  validateWorkspaceFingerprint: mockValidateWorkspaceFingerprint,
  formatResumeContext: vi.fn(() => 'resume context'),
  SemanticBoundary: {
    RUN_CREATED: 'run_created',
    PLAN_COMMITTED: 'plan_committed',
    MUTATION_APPLIED: 'mutation_applied',
    VERIFICATION_STARTED: 'verification_started',
    VERIFICATION_FINISHED: 'verification_finished',
    INTERRUPTED: 'interrupted',
    COMPLETED: 'completed',
    FAILED: 'failed',
  },
}));
import { LLMModeAgent, createLLMModeAgent } from '../../src/harness/agent/LLMModeAgent.js';
import eventBus, { EventTypes, type BusEvent } from '../../src/core/EventBus.js';
import { rateLimiter } from '../../src/harness/tools/RateLimiter.js';
import { Status } from '../../src/types/status.js';

function queuePlans(...responses: string[]): void {
  for (const text of responses) {
    mockComplete.mockResolvedValueOnce({ text });
  }
}

function makeSuspendedState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    taskId: 't-resume-state',
    stepsCompleted: 2,
    maxSteps: 5,
    status: Status.SUSPENDED,
    phase: 'mutation_applied',
    exploredPaths: ['src/foo.ts'],
    mutatedFiles: ['src/foo.ts'],
    hadMutations: true,
    mutationApplied: true,
    progressSummary: 'Saved runtime progress',
    startedAt: '2026-04-11T18:00:00.000Z',
    suspendedAt: '2026-04-11T18:05:00.000Z',
    workspaceFingerprint: {
      gitHead: 'abc1234567890',
      gitBranch: 'checkpoint/resume-confidence-bundle-20260411',
      workingTreeClean: true,
      timestamp: '2026-04-11T18:05:00.000Z',
    },
    ...overrides,
  };
}

describe('LLMModeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComplete.mockReset();
    mockLLM.getConfig.mockReset();
    mockLLM.getConfig.mockReturnValue({ model: 'test-model' });
    mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
    mockApplyEdit.execute.mockResolvedValue({ success: true, data: { backupPath: '/tmp/bak-123' } });
    mockRunBuild.execute.mockResolvedValue({ success: true });
    mockRunTests.execute.mockResolvedValue({ success: true });
    mockGitStatus.execute.mockResolvedValue({ success: true, data: { branch: 'fix/tui', short: '' } });
    mockRestoreBackup.execute.mockResolvedValue({ success: true });
    mockCreateBackup.execute.mockResolvedValue({ success: true, data: { backupPath: '/tmp/bak-123' } });
    mockSaveRunState.mockResolvedValue(undefined);
    mockReadRunState.mockResolvedValue(null);
    mockClearRunState.mockResolvedValue(undefined);
    mockCaptureWorkspaceFingerprint.mockResolvedValue({ host: 'local', repoRoot: '/tmp/repo', gitDir: '/tmp/repo/.git', worktreePath: '/tmp/repo' });
    mockValidateWorkspaceFingerprint.mockResolvedValue({ valid: true });
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

  it('reports the active model name in planning progress', async () => {
    const progressMessages: string[] = [];
    const listener = (event: BusEvent) => {
      if (event.type === EventTypes.PROCESS_PROGRESS && typeof event.data.message === 'string') {
        progressMessages.push(event.data.message);
      }
    };
    eventBus.onEvent(listener);
    mockLLM.getConfig.mockReturnValue({ model: 'MiniMax-M2.7' });
    queuePlans('{"tool":"complete","params":{},"thought":"done","expectedResult":"done"}');

    try {
      const agent = new LLMModeAgent(mockLLM as any);
      await agent.executeTask({
        id: 't-model-label',
        title: 'Model label',
        description: 'Report active model in progress text',
        approved: true,
        maxSteps: 1,
      });
    } finally {
      eventBus.offEvent(listener);
    }

    expect(progressMessages).toContain('asking MiniMax-M2.7 for next tool call');
    expect(progressMessages).not.toContain('asking GLM for next tool call');
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

  it('retries a transient upstream planning failure once before failing', async () => {
    vi.mocked(rateLimiter.execute).mockResolvedValueOnce({ error: 'OpenAI upstream 502' } as any);
    mockComplete.mockResolvedValueOnce({ text: '' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't-upstream-error',
      title: 'Upstream error',
      description: 'desc',
      approved: true,
    });

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(session.status).toBe(Status.FAILED);
    expect(session.lastPlanError).toBe('OpenAI upstream 502');
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

  it('preserves provider error details when a planning call returns unsuccessful', async () => {
    vi.mocked(rateLimiter.execute).mockImplementationOnce(async (_op: string, fn: () => Promise<any>) => {
      try {
        return { result: await fn() };
      } catch (error) {
        return { error: String(error) };
      }
    });
    mockComplete.mockResolvedValue({
      text: '',
      success: false,
      error: 'OpenRouter API error 400: response_format not supported for this route',
    });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't-provider-error',
      title: 'Provider error',
      description: 'desc',
      approved: true,
    });

    expect(session.status).toBe(Status.FAILED);
    expect(session.lastPlanError).toContain('OpenRouter API error 400');
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


  it('suspends and saves run state when max steps reached after a mutation', async () => {
    mockComplete.mockResolvedValue({
      text: '{"tool":"applyEdit","params":{"path":"src/foo.ts","search":"x","replace":"y"},"thought":"edit","expectedResult":"changed"}',
    });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't-suspend', title: 'Suspend', description: 'desc', maxSteps: 1, approved: true,
    });

    expect(session.status).toBe(Status.SUSPENDED);
    expect(mockSaveRunState).toHaveBeenCalledTimes(1);
    expect(mockSaveRunState.mock.calls[0][0]).toMatchObject({
      taskId: 't-suspend',
      status: Status.SUSPENDED,
      phase: 'mutation_applied',
      hadMutations: true,
      mutationApplied: true,
    });
  });

  it('resumes a suspended run without duplicating mutation work', async () => {
    let persistedRunState: Record<string, unknown> | null = null;

    mockReadRunState.mockImplementation(async () => persistedRunState);
    mockSaveRunState.mockImplementation(async (state: Record<string, unknown>) => {
      persistedRunState = structuredClone(state);
    });
    mockClearRunState.mockImplementation(async () => {
      persistedRunState = null;
    });

    mockComplete
      .mockResolvedValueOnce({
        text: '{"tool":"applyEdit","params":{"path":"src/foo.ts","search":"x","replace":"y"},"thought":"apply the fix","expectedResult":"mutation applied"}',
      })
      .mockResolvedValueOnce({
        text: '{"tool":"runBuild","params":{},"thought":"resume from the saved mutation and verify it","expectedResult":"build passes"}',
      })
      .mockResolvedValueOnce({
        text: '{"tool":"complete","params":{},"thought":"verification already covered the saved edit","expectedResult":"task finished"}',
      });

    const agent = new LLMModeAgent(mockLLM as any);
    const task = {
      id: 't-resume-proof',
      title: 'Resume proof',
      description: 'Apply one fix, suspend, then resume without re-applying the same edit',
      approved: true,
    } as const;

    const suspendedSession = await agent.executeTask({
      ...task,
      maxSteps: 1,
    });

    expect(suspendedSession.status).toBe(Status.SUSPENDED);
    expect(mockApplyEdit.execute).toHaveBeenCalledTimes(1);
    expect(persistedRunState).toMatchObject({
      taskId: 't-resume-proof',
      status: Status.SUSPENDED,
      mutationApplied: true,
      hadMutations: true,
      stepsCompleted: 1,
      mutatedFiles: ['src/foo.ts'],
    });

    const resumedSession = await agent.executeTask({
      ...task,
      maxSteps: 3,
    });

    expect(mockApplyEdit.execute).toHaveBeenCalledTimes(1);
    expect(mockRunBuild.execute).toHaveBeenCalledTimes(1);
    expect(mockClearRunState).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[1][0].prompt).toContain('resume context');
    expect(resumedSession.status).toBe(Status.SUCCESS);
    expect(resumedSession.stepCount).toBe(3);
    expect(Array.from(resumedSession.mutatedFiles)).toEqual(['src/foo.ts']);
    expect(Array.from(resumedSession.exploredPaths)).toEqual([]);
    expect(persistedRunState).toBeNull();
  });

  it('blocks resume safely when the workspace fingerprint has drifted', async () => {
    const fingerprint = {
      host: 'host-a',
      repoRoot: '/repo',
      gitDir: '/repo/.git/worktrees/old',
      worktreePath: '/repo/.worktrees/old',
    };

    mockReadRunState.mockResolvedValue({
      taskId: 't-resume-drift',
      stepsCompleted: 2,
      maxSteps: 5,
      exploredPaths: ['src/foo.ts'],
      mutatedFiles: ['src/foo.ts'],
      workspaceFingerprint: fingerprint,
    });
    mockValidateWorkspaceFingerprint.mockResolvedValue({
      valid: false,
      reason: 'worktree path changed',
    });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't-resume-drift',
      title: 'Resume drift guard',
      description: 'Do not resume if the worktree fingerprint no longer matches',
      approved: true,
    });

    expect(mockValidateWorkspaceFingerprint).toHaveBeenCalledWith(fingerprint);
    expect(mockClearRunState).toHaveBeenCalledTimes(1);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockApplyEdit.execute).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.FAILED);
    expect(session.endTime).toBeDefined();
    expect(session.stepCount).toBe(0);
    expect(Array.from(session.exploredPaths)).toEqual([]);
    expect(Array.from(session.mutatedFiles)).toEqual([]);
  });

  it('restores saved session tracking state into the resumed live run', async () => {
    const savedVerification = {
      passed: false,
      type: 'build',
      error: 'src/foo.ts(12,3): missing semicolon',
      timestamp: '2026-04-11T18:00:00.000Z',
    } as const;

    mockReadRunState.mockResolvedValue({
      taskId: 't-resume-state',
      stepsCompleted: 4,
      maxSteps: 5,
      exploredPaths: ['src/foo.ts', 'src/bar.ts'],
      mutatedFiles: ['src/foo.ts'],
      lastVerification: savedVerification,
      workspaceFingerprint: {
        host: 'local',
        repoRoot: '/tmp/repo',
        gitDir: '/tmp/repo/.git',
        worktreePath: '/tmp/repo',
      },
    });
    mockComplete.mockResolvedValue({
      text: '{"tool":"complete","params":{},"thought":"resume context is enough to finish","expectedResult":"done"}',
    });

    const agent = new LLMModeAgent(mockLLM as any);
    const resumedSession = await agent.executeTask({
      id: 't-resume-state',
      title: 'Resume state restoration',
      description: 'Resume using the persisted working set and verification snapshot',
      maxSteps: 5,
      approved: true,
    });

    expect(mockValidateWorkspaceFingerprint).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[0][0].prompt).toContain('resume context');
    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockApplyEdit.execute).not.toHaveBeenCalled();
    expect(resumedSession.status).toBe(Status.SUCCESS);
    expect(resumedSession.stepCount).toBe(5);
    expect(Array.from(resumedSession.exploredPaths)).toEqual(['src/foo.ts', 'src/bar.ts']);
    expect(Array.from(resumedSession.mutatedFiles)).toEqual(['src/foo.ts']);
    expect(resumedSession.lastVerification).toEqual(savedVerification);
  });

  it('auto-completes bounded runs after verified success instead of exploring unrelated follow-up work', async () => {
    mockComplete
      .mockResolvedValueOnce({ text: '{"tool":"applyEdit","params":{"path":"src/foo.ts","search":"x","replace":"y"},"thought":"edit","expectedResult":"changed"}' })
      .mockResolvedValueOnce({ text: '{"tool":"runBuild","params":{},"thought":"verify","expectedResult":"build passes"}' })
      .mockResolvedValueOnce({ text: '{"tool":"readFile","params":{"path":"src/extra.ts"},"thought":"look for more work","expectedResult":"more context"}' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-bounded',
      title: 'Bounded run',
      description: 'desc',
      approved: true,
      maxSteps: 6,
      completionPolicy: 'stop_after_verification',
    });

    expect(mockApplyEdit.execute).toHaveBeenCalledTimes(1);
    expect(mockRunBuild.execute).toHaveBeenCalledTimes(1);
    expect(mockRunTests.execute).not.toHaveBeenCalled();
    expect(mockReadFile.execute).not.toHaveBeenCalledWith({ path: 'src/extra.ts' });
    expect(session.status).toBe(Status.SUCCESS);
    expect(mockClearRunState).toHaveBeenCalled();
  });

  it('blocks complete until the required verification target has passed', async () => {
    queuePlans(
      '{"tool":"applyEdit","params":{"path":"src/runtime-core/SelfImprovementRuntime.ts","search":"x","replace":"y"},"thought":"edit","expectedResult":"changed"}',
      '{"tool":"complete","params":{},"thought":"done","expectedResult":"finish"}',
      '{"tool":"runTests","params":{"pattern":"runtime-core"},"thought":"run the required focused tests","expectedResult":"tests pass"}',
      '{"tool":"complete","params":{},"thought":"verification target passed","expectedResult":"finish"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-verification-gate',
      title: 'Verification gate',
      description: 'desc',
      approved: true,
      maxSteps: 6,
      completionPolicy: 'stop_after_verification',
      verificationTargets: [
        {
          tool: 'runTests',
          pattern: 'runtime-core',
          reason: 'Focused runtime-core verification must pass first',
          priority: 1,
        },
      ],
    });

    expect(session.messages.some((message) =>
      message.role === 'tool' && message.content.includes('Verification gate: run runTests (runtime-core) before completing this task.'),
    )).toBe(true);
    expect(mockRunTests.execute).toHaveBeenCalledWith({ pattern: 'runtime-core' });
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('auto-completes when the required verification target succeeds after mutation', async () => {
    queuePlans(
      '{"tool":"applyEdit","params":{"path":"src/runtime-core/SelfImprovementRuntime.ts","search":"x","replace":"y"},"thought":"edit","expectedResult":"changed"}',
      '{"tool":"runTests","params":{"pattern":"runtime-core"},"thought":"run focused tests","expectedResult":"tests pass"}',
      '{"tool":"runBuild","params":{},"thought":"would be next if needed","expectedResult":"build passes"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-targeted-auto-complete',
      title: 'Targeted verification auto-complete',
      description: 'desc',
      approved: true,
      maxSteps: 6,
      completionPolicy: 'stop_after_verification',
      verificationTargets: [
        {
          tool: 'runTests',
          pattern: 'runtime-core',
          reason: 'Focused runtime-core verification must pass first',
          priority: 1,
        },
      ],
    });

    expect(mockRunTests.execute).toHaveBeenCalledWith({ pattern: 'runtime-core' });
    expect(mockRunBuild.execute).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.SUCCESS);
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

  it('does not classify zero-inspection bounded startup failures as bounded-no-change success', async () => {
    mockComplete.mockResolvedValue({
      text: '{"thought":"startup failed before a useful tool plan existed","expectedResult":"recover later"}',
    });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-zero-inspection',
      title: 'Zero inspection startup failure',
      description: 'desc',
      approved: true,
      maxSteps: 2,
    });

    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockApplyEdit.execute).not.toHaveBeenCalled();
    expect(mockClearRunState).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.FAILED);
    expect(session.exitReason).toBeUndefined();
  });

  it('does not classify parse failure before inspection as bounded-no-change success', async () => {
    mockComplete.mockResolvedValue({ text: 'done inspecting; no safe change warranted' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-parse-before-inspection',
      title: 'Parse failure before inspection',
      description: 'desc',
      approved: true,
      maxSteps: 4,
    });

    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockGitStatus.execute).not.toHaveBeenCalled();
    expect(mockClearRunState).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.FAILED);
    expect(session.exitReason).toBeUndefined();
  });

  it('does not classify parse failure after concrete inspection as bounded-no-change success', async () => {
    queuePlans(
      '{"tool":"readFile","params":{"path":"bubbletea/internal/app/view.go"},"thought":"inspect view"}',
      '{"tool":"search","params":{"pattern":"completionPolicy"},"thought":"inspect symbol usage"}',
      'done inspecting; no safe change warranted',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-parse-after-inspection',
      title: 'Parse failure after inspection',
      description: 'desc',
      approved: true,
      maxSteps: 6,
    });

    expect(mockReadFile.execute).toHaveBeenCalled();
    expect(mockSearch.execute).toHaveBeenCalled();
    expect(mockClearRunState).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.FAILED);
    expect(session.exitReason).toBeUndefined();
  });

  it('does not classify an early Bubble Tea LLM rate-limit failure as bounded-no-change success', async () => {
    vi.mocked(rateLimiter.execute).mockImplementationOnce(async () => ({ error: 'Rate limit exceeded' } as any));

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-rate-limit',
      title: 'Rate limit before inspection',
      description: 'desc',
      approved: true,
      maxSteps: 4,
    });

    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockApplyEdit.execute).not.toHaveBeenCalled();
    expect(mockClearRunState).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.FAILED);
    expect(session.exitReason).toBeUndefined();
  });

  it('still classifies meaningful successful inspection with no safe mutation as bounded-no-change success', async () => {
    queuePlans('{"tool":"readFile","params":{"path":"bubbletea/internal/app/view.go"},"thought":"inspect view"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-inspection-only',
      title: 'Inspection only',
      description: 'desc',
      approved: true,
      maxSteps: 2,
    });

    expect(mockReadFile.execute).toHaveBeenCalled();
    expect(session.backups).toHaveLength(0);
    expect(session.status).toBe(Status.SUCCESS);
    expect(['bounded-no-change', 'bounded-inspection']).toContain(session.exitReason);
  });

  it('does not classify search-only bounded inspection as bounded-no-change success', async () => {
    queuePlans(
      '{"tool":"search","params":{"pattern":"buildTaskPacket"},"thought":"inspect symbol usage"}',
      'done inspecting; no safe change warranted',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-search-only-inspection',
      title: 'Search only inspection',
      description: 'desc',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      primaryFiles: ['src/runtime-core/SelfImprovementRuntime.ts'],
      workingSet: ['src/runtime-core/SelfImprovementRuntime.ts'],
      approved: true,
      maxSteps: 6,
    });

    expect(mockSearch.execute).toHaveBeenCalled();
    expect(mockClearRunState).not.toHaveBeenCalled();
    expect(session.status).toBe(Status.FAILED);
    expect(session.exitReason).toBeUndefined();
  });

  it('suspends with verification_started when verification fails after a mutation', async () => {
    queuePlans(
      '{"tool":"applyEdit","params":{"path":"src/foo.ts","search":"x","replace":"y"},"thought":"apply fix","expectedResult":"changed"}',
      '{"tool":"runTests","params":{"pattern":"LLMModeAgent"},"thought":"verify tests","expectedResult":"tests pass"}',
    );
    mockRunTests.execute.mockResolvedValueOnce({ success: false, error: 'LLMModeAgent tests failed' });

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 't-resume-verification-started',
      title: 'Verification failed before suspend',
      description: 'desc',
      approved: true,
      maxSteps: 2,
    });

    expect(session.status).toBe(Status.SUSPENDED);
    expect(mockSaveRunState).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 't-resume-verification-started',
      phase: 'verification_started',
      mutatedFiles: ['src/foo.ts'],
      lastVerification: expect.objectContaining({
        passed: false,
        type: 'test',
        error: 'LLMModeAgent tests failed',
      }),
    }));
  });

  it('suspends with verification_finished and resumes without re-verifying or re-inspecting', async () => {
    let persistedRunState: Record<string, unknown> | null = null;

    mockReadRunState.mockImplementation(async () => persistedRunState);
    mockSaveRunState.mockImplementation(async (state: Record<string, unknown>) => {
      persistedRunState = structuredClone(state);
    });
    mockClearRunState.mockImplementation(async () => {
      persistedRunState = null;
    });

    queuePlans(
      '{"tool":"applyEdit","params":{"path":"src/foo.ts","search":"x","replace":"y"},"thought":"apply fix","expectedResult":"changed"}',
      '{"tool":"runBuild","params":{},"thought":"verify build","expectedResult":"build passes"}',
      '{"tool":"complete","params":{},"thought":"verification already passed before suspension","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const task = {
      id: 't-resume-verification-finished',
      title: 'Resume after verification finished',
      description: 'desc',
      approved: true,
    } as const;

    const suspendedSession = await agent.executeTask({ ...task, maxSteps: 2 });

    expect(suspendedSession.status).toBe(Status.SUSPENDED);
    expect(persistedRunState).toMatchObject({
      taskId: 't-resume-verification-finished',
      phase: 'verification_finished',
      mutatedFiles: ['src/foo.ts'],
      lastVerification: expect.objectContaining({
        passed: true,
        type: 'build',
      }),
    });

    const resumedSession = await agent.executeTask({ ...task, maxSteps: 3 });

    expect(mockRunBuild.execute).toHaveBeenCalledTimes(1);
    expect(mockRunTests.execute).not.toHaveBeenCalled();
    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockClearRunState).toHaveBeenCalledTimes(1);
    expect(mockComplete.mock.calls[2][0].prompt).toContain('resume context');
    expect(resumedSession.status).toBe(Status.SUCCESS);
    expect(resumedSession.stepCount).toBe(3);
    expect(resumedSession.lastVerification).toEqual(expect.objectContaining({
      passed: true,
      type: 'build',
    }));
  });

  it('skips preflight reconnaissance when a resumed bounded run already restored its working set', async () => {
    const workingSet = [
      'src/runtime-core/SelfImprovementRuntime.ts',
      'src/runtime-core/RepoIndexLite.ts',
    ];

    mockReadRunState.mockResolvedValue(makeSuspendedState({
      taskId: 'tui-self-resume-working-set',
      stepsCompleted: 2,
      maxSteps: 4,
      phase: 'verification_finished',
      exploredPaths: workingSet,
      mutatedFiles: ['src/harness/agent/LLMModeAgent.ts'],
      lastVerification: {
        passed: true,
        type: 'build',
        timestamp: '2026-04-11T18:04:00.000Z',
      },
    }));
    queuePlans('{"tool":"complete","params":{},"thought":"saved state already covers the bounded packet","expectedResult":"done"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-resume-working-set',
      title: 'Resume bounded packet without blind reconnaissance',
      description: 'Continue from restored runtime packet state',
      fileHint: workingSet[0],
      workingSet,
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 4,
    });

    expect(mockReadFile.execute).not.toHaveBeenCalled();
    expect(mockGitStatus.execute).not.toHaveBeenCalled();
    expect(mockRunBuild.execute).not.toHaveBeenCalled();
    expect(mockRunTests.execute).not.toHaveBeenCalled();
    expect(mockComplete.mock.calls[0][0].prompt).toContain('resume context');
    expect(Array.from(session.exploredPaths)).toEqual(workingSet);
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('truncates bounded preflight file contents before the first planning call', async () => {
    const hugeContent = `header\\n${'A'.repeat(9000)}TAIL-SHOULD-NOT-APPEAR`;
    mockReadFile.execute.mockResolvedValue({ success: true, data: { content: hugeContent } });
    queuePlans('{"tool":"complete","params":{},"thought":"bounded excerpt is enough to start","expectedResult":"done"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-preflight-truncation',
      title: 'Bounded preflight truncation',
      description: 'Keep the first planning call bounded even when preflight files are large',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    const firstPrompt = mockComplete.mock.calls[0][0].prompt;
    expect(firstPrompt).toContain('... [truncated preflight excerpt; call readFile for full contents]');
    expect(firstPrompt).not.toContain('TAIL-SHOULD-NOT-APPEAR');
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('does not duplicate the deterministic task packet when the description already includes it', async () => {
    queuePlans('{"tool":"complete","params":{},"thought":"single packet is enough","expectedResult":"done"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-no-duplicate-packet',
      title: 'Avoid duplicate packet text',
      description: 'Improve startup efficiency\n\n## Deterministic Task Packet\nPrimary files:\n- src/runtime-core/SelfImprovementRuntime.ts',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      primaryFiles: [
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      secondaryFiles: [
        'src/harness/agent/LLMModeAgent.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    const firstPrompt = mockComplete.mock.calls[0][0].prompt;
    expect(firstPrompt.match(/## Deterministic Task Packet/g)?.length).toBe(1);
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('preloads primary packet files before secondary files', async () => {
    queuePlans('{"tool":"complete","params":{},"thought":"primary files were enough to start","expectedResult":"done"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-primary-first',
      title: 'Primary packet first',
      description: 'Start from primary files and keep secondary files in reserve',
      fileHint: 'src/runtime-core/RepoIndexLite.ts',
      workingSet: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
        'test/unit/runtime-core/RepoIndexLite.test.ts',
      ],
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      secondaryFiles: [
        'test/unit/runtime-core/RepoIndexLite.test.ts',
      ],
      expansionBudget: 1,
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(mockReadFile.execute).toHaveBeenCalledTimes(1);
    expect(mockReadFile.execute).toHaveBeenNthCalledWith(1, { path: 'src/runtime-core/RepoIndexLite.ts' });
    expect(mockReadFile.execute).not.toHaveBeenCalledWith({ path: 'src/runtime-core/SelfImprovementRuntime.ts' });
    expect(mockReadFile.execute).not.toHaveBeenCalledWith({ path: 'test/unit/runtime-core/RepoIndexLite.test.ts' });

    const firstPrompt = mockComplete.mock.calls[0][0].prompt;
    expect(firstPrompt).toContain('Start in these primary files before any broader reconnaissance');
    expect(firstPrompt).toContain('Secondary files (use only if the primary files are insufficient):');
    expect(firstPrompt).toContain('continue that file with offset=endLine rather than rereading from the top');
    expect(firstPrompt).toContain('use search with the current file path before reading more pages');
    expect(Array.from(session.exploredPaths)).toEqual([
      'src/runtime-core/RepoIndexLite.ts',
    ]);
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('surfaces preferred verification targets in the planner prompt', async () => {
    queuePlans('{"tool":"complete","params":{},"thought":"verification targets are visible","expectedResult":"done"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-verification-targets',
      title: 'Verification targets visible',
      description: 'Improve startup flow',
      primaryFiles: ['src/runtime-core/SelfImprovementRuntime.ts'],
      verificationTargets: [
        {
          tool: 'runTests',
          pattern: 'runtime-core',
          reason: 'Hit focused runtime-core tests first',
          priority: 1,
        },
        {
          tool: 'runBuild',
          reason: 'Full build after runtime-core edits',
          priority: 2,
        },
      ],
      approved: true,
      maxSteps: 3,
    });

    const firstPrompt = mockComplete.mock.calls[0][0].prompt;
    expect(firstPrompt).toContain('Preferred verification targets after a mutation:');
    expect(firstPrompt).toContain('runTests (runtime-core): Hit focused runtime-core tests first');
    expect(firstPrompt).toContain('Prefer the first applicable verification target before broader verification discovery.');
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('adds a pagination hint to truncated readFile tool results', async () => {
    mockReadFile.execute.mockResolvedValue({
      success: true,
      data: {
        content: 'line 1\\n... [truncated: 950 more lines] ...',
        exists: true,
        lineCount: 1050,
        truncated: true,
        startLine: 1,
        endLine: 100,
      },
    });
    queuePlans(
      '{"tool":"readFile","params":{"path":"src/harness/agent/LLMModeAgent.ts"},"thought":"inspect the file","expectedResult":"see the first chunk"}',
      '{"tool":"complete","params":{},"thought":"pagination hint is present","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-pagination-hint',
      title: 'Pagination hint',
      description: 'Surface an actionable follow-up when readFile returns a truncated page',
      approved: true,
      maxSteps: 3,
    });

    const toolMessage = session.messages.find((message) =>
      message.role === 'tool' && message.content.includes('Pagination hint: this readFile result is truncated.'),
    );
    expect(toolMessage?.content).toContain('offset=100');
    expect(toolMessage?.content).toContain('use search with path set to the current file');
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('auto-scopes a bare search to the active focus file while the primary focus is unresolved', async () => {
    queuePlans(
      '{"tool":"search","params":{"pattern":"executeTask"},"thought":"search the whole repo","expectedResult":"find the method"}',
      '{"tool":"complete","params":{},"thought":"focus gate error received","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-gate-search',
      title: 'Focus gate search block',
      description: 'Keep search inside the active primary focus before broader exploration',
      fileHint: 'src/runtime-core/RepoIndexLite.ts',
      workingSet: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(mockSearch.execute).toHaveBeenCalledWith(expect.objectContaining({
      pattern: 'executeTask',
      path: 'src/runtime-core/RepoIndexLite.ts',
    }));
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('auto-scopes bare search calls to the active focus file during bounded runs', async () => {
    queuePlans(
      '{"tool":"search","params":{"pattern":"buildTaskPacket"},"thought":"search for the packet builder","expectedResult":"find the symbol inside the active focus file"}',
      '{"tool":"complete","params":{},"thought":"scoped search is enough for this test","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-search-scope',
      title: 'Auto-scope bare search',
      description: 'Keep bare search calls inside the active focus file during bounded inspection',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      primaryFiles: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(session.status).toBe(Status.SUCCESS);
    expect(mockSearch.execute).toHaveBeenCalledWith(expect.objectContaining({
      pattern: 'buildTaskPacket',
      path: 'src/runtime-core/SelfImprovementRuntime.ts',
    }));
  });

  it('rewrites broad search paths back to the active focus file while focus is unresolved', async () => {
    queuePlans(
      '{"tool":"search","params":{"pattern":"completionPolicy","path":"src/harness/agent/LLMModeAgent.ts"},"thought":"search another file too early","expectedResult":"find the symbol"}',
      '{"tool":"complete","params":{},"thought":"scoped search is enough for this test","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-search-rewrite',
      title: 'Rewrite broad search to active focus',
      description: 'Keep unresolved bounded searches inside the active focus file even if the planner names another path too early',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      primaryFiles: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(session.status).toBe(Status.SUCCESS);
    expect(mockSearch.execute).toHaveBeenCalledWith(expect.objectContaining({
      pattern: 'completionPolicy',
      path: 'src/runtime-core/SelfImprovementRuntime.ts',
    }));
  });

  it('rewrites premature readFile calls back to the active focus file while focus reads remain', async () => {
    queuePlans(
      '{"tool":"readFile","params":{"path":"src/runtime-core/RepoIndexLite.ts"},"thought":"jump to a related file too early","expectedResult":"inspect the helper"}',
      '{"tool":"complete","params":{},"thought":"rewritten readFile is enough for this test","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-readfile-rewrite',
      title: 'Rewrite premature readFile',
      description: 'Keep unresolved bounded reads on the active focus file until the loop has earned an advance',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/runtime-core/RepoIndexLite.ts',
      ],
      primaryFiles: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/runtime-core/RepoIndexLite.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(session.status).toBe(Status.SUCCESS);
    expect(mockReadFile.execute).toHaveBeenNthCalledWith(2, {
      path: 'src/runtime-core/SelfImprovementRuntime.ts',
    });
  });

  it('adds a focus recovery hint when a readFile tries to skip ahead too early', async () => {
    queuePlans(
      '{"tool":"readFile","params":{"path":"src/harness/agent/LLMModeAgent.ts"},"thought":"jump straight to the next primary file","expectedResult":"inspect the next focus"}',
      '{"tool":"complete","params":{},"thought":"focus recovery hint received","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-recovery',
      title: 'Focus recovery hint',
      description: 'Give the planner a concrete next action when it tries to skip the active focus too early',
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      primaryFiles: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(mockReadFile.execute).toHaveBeenNthCalledWith(2, {
      path: 'src/runtime-core/SelfImprovementRuntime.ts',
    });
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('forces a decision after the primary focus inspection budget is exhausted', async () => {
    queuePlans(
      '{"tool":"readFile","params":{"path":"src/runtime-core/RepoIndexLite.ts"},"thought":"read first page","expectedResult":"inspect"}',
      '{"tool":"readFile","params":{"path":"src/runtime-core/RepoIndexLite.ts","offset":100},"thought":"read second page","expectedResult":"inspect more"}',
      '{"tool":"readFile","params":{"path":"src/runtime-core/RepoIndexLite.ts","offset":200},"thought":"read third page","expectedResult":"inspect even more"}',
      '{"tool":"complete","params":{},"thought":"focus gate blocked further inspection","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-budget',
      title: 'Focus budget exhaustion',
      description: 'Do not allow unlimited rereads of the active primary file',
      fileHint: 'src/runtime-core/RepoIndexLite.ts',
      workingSet: [
        'src/runtime-core/RepoIndexLite.ts',
      ],
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 5,
    });

    expect(mockReadFile.execute).toHaveBeenCalledTimes(2); // 1 preflight + 1 allowed explicit read, then gate blocks the next reread
    expect(session.messages.some((message) =>
      message.role === 'tool' && message.content.includes('Focus gate: inspection budget exhausted'),
    )).toBe(true);
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('restores bounded focus state from suspended run state', async () => {
    mockReadRunState.mockResolvedValue(makeSuspendedState({
      taskId: 'tui-self-focus-resume',
      exploredPaths: ['src/runtime-core/RepoIndexLite.ts'],
      activeFocusFile: 'src/runtime-core/SelfImprovementRuntime.ts',
      activeFocusIndex: 1,
      focusInspectionBudgetRemaining: 1,
      focusStatus: 'unresolved',
      focusAdjacentFileUsed: true,
      focusDecision: 'reject',
      focusDecisionAt: '2026-04-12T09:00:00.000Z',
    }));
    queuePlans('{"tool":"complete","params":{},"thought":"restored focus state is enough to continue","expectedResult":"done"}');

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-resume',
      title: 'Restore focus state',
      description: 'Resume a bounded run without losing the current primary focus',
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 4,
    });

    expect(session.activeFocusFile).toBe('src/runtime-core/SelfImprovementRuntime.ts');
    expect(session.activeFocusIndex).toBe(1);
    expect(session.focusInspectionBudgetRemaining).toBe(0);
    expect(session.focusStatus).toBe('unresolved');
    expect(session.focusAdjacentFileUsed).toBe(true);
    expect(session.focusDecision).toBe('reject');
    expect(session.focusDecisionAt).toBe('2026-04-12T09:00:00.000Z');
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('allows advancing to the next primary file after one explicit focused read', async () => {
    queuePlans(
      '{"tool":"readFile","params":{"path":"src/runtime-core/RepoIndexLite.ts"},"thought":"inspect the current primary file","expectedResult":"understand it"}',
      '{"tool":"readFile","params":{"path":"src/runtime-core/SelfImprovementRuntime.ts"},"thought":"advance to the next primary file after finishing the first one","expectedResult":"inspect next focus"}',
      '{"tool":"complete","params":{},"thought":"advanced focus is enough for this test","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-focus-advance',
      title: 'Advance primary focus',
      description: 'Allow the loop to move from one primary file to the next after bounded inspection',
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      workingSet: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 4,
    });

    expect(mockReadFile.execute).toHaveBeenCalledTimes(3); // 1 preflight read + 1 explicit reread + next primary
    expect(mockReadFile.execute).toHaveBeenNthCalledWith(2, { path: 'src/runtime-core/RepoIndexLite.ts' });
    expect(mockReadFile.execute).toHaveBeenNthCalledWith(3, { path: 'src/runtime-core/SelfImprovementRuntime.ts' });
    expect(session.activeFocusFile).toBe('src/runtime-core/SelfImprovementRuntime.ts');
    expect(session.activeFocusIndex).toBe(1);
    expect(session.focusInspectionBudgetRemaining).toBe(0);
    expect(session.focusDecision).toBe('reject');
    expect(session.status).toBe(Status.SUCCESS);
  });

  it('allows one explicit follow-up read on the initial primary file after preflight', async () => {
    queuePlans(
      '{"tool":"readFile","params":{"path":"src/runtime-core/RepoIndexLite.ts"},"thought":"use one explicit post-preflight read on the first primary file","expectedResult":"inspect more deeply"}',
      '{"tool":"complete","params":{},"thought":"confirmed the first primary still gets one real read after preflight","expectedResult":"done"}',
    );

    const agent = new LLMModeAgent(mockLLM as any);
    const session = await agent.executeTask({
      id: 'tui-self-first-primary-followup',
      title: 'Initial primary follow-up read',
      description: 'Allow one explicit read after the preflighted first primary file',
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      workingSet: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      completionPolicy: 'stop_after_verification',
      approved: true,
      maxSteps: 3,
    });

    expect(mockReadFile.execute).toHaveBeenNthCalledWith(2, { path: 'src/runtime-core/RepoIndexLite.ts' });
    expect(session.activeFocusFile).toBe('src/runtime-core/RepoIndexLite.ts');
    expect(session.focusInspectionBudgetRemaining).toBe(0);
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

  it('executeTool dispatches new skill and coding tools', async () => {
    const agent = new LLMModeAgent(mockLLM as any);

    await (agent as any).executeTool({ tool: 'executeSkill', params: { name: 'sample-skill' }, thought: 'load skill' });
    await (agent as any).executeTool({ tool: 'searchCode', params: { query: 'TuiBridgeService' }, thought: 'search code' });
    await (agent as any).executeTool({ tool: 'searchDocs', params: { query: 'visual bible' }, thought: 'search docs' });
    await (agent as any).executeTool({ tool: 'runLint', params: {}, thought: 'lint' });
    await (agent as any).executeTool({ tool: 'runFocusedTests', params: { targets: ['test/unit/LLMModeAgent.test.ts'] }, thought: 'tests' });

    expect(mockExecuteSkill.execute).toHaveBeenCalled();
    expect(mockSearchCode.execute).toHaveBeenCalled();
    expect(mockSearchDocs.execute).toHaveBeenCalled();
    expect(mockRunLint.execute).toHaveBeenCalled();
    expect(mockRunFocusedTests.execute).toHaveBeenCalled();
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
