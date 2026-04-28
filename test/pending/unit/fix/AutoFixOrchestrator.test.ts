import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const {
  mockLLM,
  mockExecuteTask,
  mockReadFile,
} = vi.hoisted(() => {
  const executeTask = vi.fn();
  const llm = {
    getConfig: vi.fn(() => ({ model: 'test-model' })),
    complete: vi.fn(),
  };
  return {
    mockLLM: llm,
    mockExecuteTask: executeTask,
    mockReadFile: { execute: vi.fn() },
  };
});

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class { constructor() { return mockLLM; } },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/harness/agent/index.js', () => ({
  createLLMModeAgent: vi.fn(() => ({
    executeTask: mockExecuteTask,
  })),
  LLMModeAgent: class {
    executeTask = mockExecuteTask;
  },
}));

vi.mock('../../../src/harness/tools/index.js', () => ({
  readFileTool: mockReadFile,
}));

vi.mock('../../../src/fix/TestFailureDetector.js', () => ({
  TestFailureDetector: class {
    detect = vi.fn(() => ({
      success: true,
      failures: [],
      failingFileCount: 0,
      totalFailedTests: 0,
    }));
    getSourceFiles = vi.fn(() => []);
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => Buffer.from('success')),
}));

import { AutoFixOrchestrator } from '../../../src/fix/AutoFixOrchestrator.js';
import { Status } from '../../../src/types/status.js';

describe('AutoFixOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Constructor ────────────────────────────────────────────────────
  describe('constructor', () => {
    it('creates instance with LLMClient', () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      expect(orchestrator).toBeInstanceOf(AutoFixOrchestrator);
    });

    it('stores LLM client for later use', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      // Verify LLM is used by checking executeFix doesn't throw
      mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 5,
        backups: ['/tmp/backup'],
        messages: [],
      });

      const result = await orchestrator.executeFix({
        type: 'natural-language',
        target: 'Test fix',
      });

      expect(result?.taskId).toMatch(/^fix-\d+-[a-z0-9]+$/);
    });
  });

  // ── Dry run mode ───────────────────────────────────────────────────
  describe('dry run mode', () => {
    it('returns success without calling LLM when dryRun is true', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBe('Dry run mode - no changes applied');
      expect(result.changes).toHaveLength(0);
      expect(result.buildPassed).toBe(true);
      expect(result.testsPassed).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(mockExecuteTask).not.toHaveBeenCalled();
    });

    it('generates unique taskId for dry run', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result1 = await orchestrator.executeFix({ type: 'file-error', dryRun: true });
      const result2 = await orchestrator.executeFix({ type: 'file-error', dryRun: true });

      expect(result1.taskId).not.toBe(result2.taskId);
      expect(result1.taskId).toMatch(/^fix-\d+-[a-z0-9]+$/);
      expect(result2.taskId).toMatch(/^fix-\d+-[a-z0-9]+$/);
    });
  });

  // ── File error fix ─────────────────────────────────────────────────
  describe('file-error fix type', () => {
    it('returns error when target is not specified', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        errorDescription: 'Some error',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No target file specified for file-error fix');
      expect(result.changes).toHaveLength(0);
    });

    it('returns error when file cannot be read', async () => {
      mockReadFile.execute.mockResolvedValue({ success: false, error: 'File not found' });
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/nonexistent.ts',
        errorDescription: 'TypeError',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read file src/nonexistent.ts');
      expect(result.error).toContain('File not found');
    });

    it('executes fix successfully when file exists', async () => {
      mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 5,
        backups: ['/tmp/backup/test.ts.bak'],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
        errorDescription: 'TypeError: Cannot read property',
      });

      expect(result.success).toBe(true);
      expect(result.buildPassed).toBe(true);
      expect(result.testsPassed).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].path).toBe('src/test.ts');
      expect(result.changes[0].backupPath).toBe('/tmp/backup/test.ts.bak');
    });

    it('handles rolled back status', async () => {
      mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
      mockExecuteTask.mockResolvedValue({
        status: Status.ROLLED_BACK,
        stepCount: 10,
        backups: ['/tmp/backup/test.ts.bak'],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
        errorDescription: 'TypeError',
      });

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.error).toBe('Fix failed after 10 steps and changes were rolled back');
    });

    it('handles failed status', async () => {
      mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
      mockExecuteTask.mockResolvedValue({
        status: Status.FAILED,
        stepCount: 15,
        backups: [],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
        errorDescription: 'TypeError',
      });

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(false);
      expect(result.error).toBe('Fix failed after 15 steps');
    });

    it('creates LLMModeAgent with correct task parameters', async () => {
      mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 5,
        backups: ['/tmp/backup.ts'],
        messages: [],
      });

      const { createLLMModeAgent } = await import('../../../src/harness/agent/index.js');
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
        errorDescription: 'TypeError: Cannot read property',
      });

      expect(createLLMModeAgent).toHaveBeenCalledWith(mockLLM);
      expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Fix error in test.ts',
        description: expect.stringContaining('Error to fix: TypeError: Cannot read property'),
        fileHint: 'src/test.ts',
        maxSteps: 15,
        approved: true,
      }));
    });
  });

  // ── Test failure fix ───────────────────────────────────────────────
  describe('test-failures fix type', () => {
    it('delegates to file-error fix when target is provided', async () => {
      mockReadFile.execute.mockResolvedValue({ success: true, data: { content: 'const x = 1;' } });
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 5,
        backups: ['/tmp/backup.ts'],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'test-failures',
        target: 'src/failing.ts',
        errorDescription: 'Test failed',
      });

      expect(result.success).toBe(true);
      expect(mockReadFile.execute).toHaveBeenCalledWith({ path: 'src/failing.ts' });
    });

    it('returns success when no target and no failures detected', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'test-failures',
      });

      expect(result.success).toBe(true);
      expect(result.error).toBe('No test failures detected - all tests pass');
    });
  });

  // ── Natural language fix ───────────────────────────────────────────
  describe('natural-language fix type', () => {
    it('executes fix with natural language description', async () => {
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 8,
        backups: ['/tmp/backup.ts'],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'natural-language',
        target: 'Refactor utils.ts',
        errorDescription: 'Convert callbacks to async/await',
      });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Refactor utils.ts',
        description: 'Convert callbacks to async/await',
        maxSteps: 15,
        approved: true,
      }));
    });

    it('handles missing description', async () => {
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 3,
        backups: [],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'natural-language',
        target: 'Some task',
      });

      expect(result.success).toBe(true);
      expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
        description: 'No description provided',
      }));
    });

    it('uses default title when target not provided', async () => {
      mockExecuteTask.mockResolvedValue({
        status: Status.SUCCESS,
        stepCount: 3,
        backups: [],
        messages: [],
      });

      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      await orchestrator.executeFix({
        type: 'natural-language',
        errorDescription: 'Fix the bug',
      });

      expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Natural language fix request',
      }));
    });
  });

  // ── Error handling ─────────────────────────────────────────────────
  describe('error handling', () => {
    it('handles unexpected errors gracefully', async () => {
      mockReadFile.execute.mockRejectedValue(new Error('Unexpected system error'));
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected system error');
      expect(result.changes).toHaveLength(0);
    });

    it('handles non-Error exceptions', async () => {
      mockReadFile.execute.mockImplementation(() => {
        throw 'String error';
      });
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'file-error',
        target: 'src/test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('handles unsupported fix types', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({
        type: 'unsupported-type' as any,
        target: 'src/test.ts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unsupported fix type: unsupported-type');
    });
  });

  // ── Task ID generation ─────────────────────────────────────────────
  describe('task ID generation', () => {
    it('generates unique task IDs', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result1 = await orchestrator.executeFix({ type: 'file-error', dryRun: true });
      const result2 = await orchestrator.executeFix({ type: 'file-error', dryRun: true });
      const result3 = await orchestrator.executeFix({ type: 'file-error', dryRun: true });

      const ids = [result1.taskId, result2.taskId, result3.taskId];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('generates task IDs with correct format', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.executeFix({ type: 'file-error', dryRun: true });

      expect(result.taskId).toMatch(/^fix-\d+-[a-z0-9]{6}$/);
    });
  });

  // ── Build and test verification (TODO methods) ─────────────────────
  describe('verification methods (TODO)', () => {
    it('verifyBuild returns true when build passes', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.verifyBuild();
      expect(result).toBe(true);
    });

    it('verifyTests returns false (not implemented)', async () => {
      const orchestrator = new AutoFixOrchestrator(mockLLM as any);
      const result = await orchestrator.verifyTests();
      expect(result).toBe(false);
    });
  });
});
