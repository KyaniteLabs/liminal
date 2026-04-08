import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeStyleGuardrail } from '../../../src/guardrails/hygiene/CodeStyleGuardrail.js';
import { GuardrailTier } from '../../../src/guardrails/core/types.js';
import type { ExecutionContext, ResourceUsage } from '../../../src/guardrails/core/types.js';

// ---------------------------------------------------------------------------
// Helper: factory for ExecutionContext
// ---------------------------------------------------------------------------

const baseResources: ResourceUsage = {
  tokensUsed: 0,
  tokensLimit: 100000,
  memoryUsedMB: 50,
  memoryLimitMB: 512,
  timeElapsedMs: 0,
  timeLimitMs: 60000,
  apiCalls: 0,
  apiCallLimit: 100,
};

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    taskId: 'test-task-001',
    step: 1,
    maxSteps: 10,
    startTime: Date.now(),
    resources: { ...baseResources },
    trace: { steps: [] },
    changedFiles: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hoisted mock for child_process.exec
// ---------------------------------------------------------------------------

const { mockExec } = vi.hoisted(() => ({
  mockExec: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: mockExec,
}));

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}));

// ===========================================================================
// CodeStyleGuardrail
// ===========================================================================

describe('CodeStyleGuardrail', () => {
  let guardrail: CodeStyleGuardrail;

  beforeEach(() => {
    guardrail = new CodeStyleGuardrail();
    mockExec.mockReset();
  });

  // --- Properties ---

  it('has correct id', () => {
    expect(guardrail.id).toBe('guardrail-code-style');
  });

  it('has a non-empty description', () => {
    expect(guardrail.description.length).toBeGreaterThan(0);
  });

  it('is advisory tier', () => {
    expect(guardrail.tier).toBe(GuardrailTier.ADVISORY);
  });

  it('is in hygiene category', () => {
    expect(guardrail.category).toBe('hygiene');
  });

  // --- evaluate() ---

  describe('evaluate', () => {
    it('passes when no files changed', async () => {
      const context = makeContext({ changedFiles: [] });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('No files');
    });

    it('passes when changedFiles is undefined', async () => {
      const context = makeContext({ changedFiles: undefined });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(true);
    });

    it('passes when only non-code files changed', async () => {
      const context = makeContext({ changedFiles: ['README.md', 'style.css', 'image.png'] });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('No code files');
    });

    it('passes when eslint and prettier succeed', async () => {
      mockExec.mockResolvedValue({ stdout: '', stderr: '' });

      const context = makeContext({ changedFiles: ['src/index.ts'] });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('passed');
    });

    it('fails when eslint reports errors', async () => {
      // Prettier passes
      mockExec
        .mockRejectedValueOnce(new Error('2 errors found in file.ts'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = makeContext({ changedFiles: ['src/bad.ts'] });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.message).toContain('style issues');
    });

    it('fails when prettier reports differences', async () => {
      mockExec
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('code style differs from prettier'));

      const context = makeContext({ changedFiles: ['src/format.ts'] });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('style issues');
    });

    it('includes suggestion to auto-fix', async () => {
      mockExec.mockRejectedValue(new Error('error found'));

      const context = makeContext({ changedFiles: ['src/bad.ts'] });
      const result = await guardrail.evaluate(context);

      expect(result.suggestion).toContain('lint:fix');
    });

    it('passes when eslint fails but message has no "error" string', async () => {
      // Some eslint warnings don't contain "error"
      mockExec
        .mockRejectedValueOnce(new Error('warning: unused variable'))
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = makeContext({ changedFiles: ['src/warn.ts'] });
      const result = await guardrail.evaluate(context);

      // Only the eslint "warning" is ignored (no "error" in message), so it passes
      expect(result.passed).toBe(true);
    });

    it('processes .js, .ts, .jsx, and .tsx files', async () => {
      mockExec.mockResolvedValue({ stdout: '', stderr: '' });

      const context = makeContext({ changedFiles: ['a.js', 'b.ts', 'c.jsx', 'd.tsx'] });
      const result = await guardrail.evaluate(context);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('4 files');
    });
  });

  // --- remediate() ---

  describe('remediate', () => {
    it('returns success with no files to fix', async () => {
      const context = makeContext({ changedFiles: [] });
      const violation = { passed: false, guardrailId: 'test', message: 'bad' };
      const result = await guardrail.remediate(context, violation);

      expect(result.success).toBe(true);
      expect(result.action).toBe('no_files');
    });

    it('returns success with no code files', async () => {
      const context = makeContext({ changedFiles: ['style.css'] });
      const violation = { passed: false, guardrailId: 'test', message: 'bad' };
      const result = await guardrail.remediate(context, violation);

      expect(result.success).toBe(true);
      expect(result.action).toBe('no_files');
    });

    it('returns success when eslint --fix and prettier succeed', async () => {
      mockExec.mockResolvedValue({ stdout: '', stderr: '' });

      const context = makeContext({ changedFiles: ['src/messy.ts'] });
      const violation = { passed: false, guardrailId: 'test', message: 'bad' };
      const result = await guardrail.remediate(context, violation);

      expect(result.success).toBe(true);
      expect(result.action).toBe('auto_fix');
      expect(result.message).toContain('Auto-fixed');
    });

    it('returns failure when auto-fix throws', async () => {
      mockExec.mockRejectedValue(new Error('fix failed'));

      const context = makeContext({ changedFiles: ['src/broken.ts'] });
      const violation = { passed: false, guardrailId: 'test', message: 'bad' };
      const result = await guardrail.remediate(context, violation);

      expect(result.success).toBe(false);
      expect(result.action).toBe('fix_failed');
      expect(result.message).toContain('fix failed');
    });

    it('handles undefined changedFiles gracefully', async () => {
      const context = makeContext({ changedFiles: undefined });
      const violation = { passed: false, guardrailId: 'test', message: 'bad' };
      const result = await guardrail.remediate(context, violation);

      expect(result.success).toBe(true);
      expect(result.action).toBe('no_files');
    });
  });
});
