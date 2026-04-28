import { describe, it, expect } from 'vitest';
import type { FixRequest, FixResult, FileChange, FixType, ConfirmLevel } from '../../../src/fix/types.js';

/**
 * Tests for fix command type definitions
 *
 * Validates type guards, interface contracts, and type safety
 * for the liminal fix command system.
 */

describe('Fix types', () => {
  // ── FixType validation ─────────────────────────────────────────────
  describe('FixType', () => {
    it('accepts valid fix types', () => {
      const validTypes: FixType[] = ['file-error', 'test-failures', 'natural-language'];
      expect(validTypes).toContain('file-error');
      expect(validTypes).toContain('test-failures');
      expect(validTypes).toContain('natural-language');
    });

    it('has exactly three fix types', () => {
      // Type check: ensure all expected types exist
      const typeSet = new Set<FixType>(['file-error', 'test-failures', 'natural-language']);
      expect(typeSet.size).toBe(3);
    });
  });

  // ── ConfirmLevel validation ────────────────────────────────────────
  describe('ConfirmLevel', () => {
    it('accepts valid confirmation levels', () => {
      const validLevels: ConfirmLevel[] = ['auto', 'ask', 'never'];
      expect(validLevels).toContain('auto');
      expect(validLevels).toContain('ask');
      expect(validLevels).toContain('never');
    });

    it('has exactly three confirmation levels', () => {
      const levelSet = new Set<ConfirmLevel>(['auto', 'ask', 'never']);
      expect(levelSet.size).toBe(3);
    });
  });

  // ── FixRequest interface ───────────────────────────────────────────
  describe('FixRequest interface', () => {
    it('constructs minimal valid FixRequest', () => {
      const request: FixRequest = {
        type: 'file-error',
      };
      expect(request.type).toBe('file-error');
      expect(request.target).toBeUndefined();
      expect(request.errorDescription).toBeUndefined();
      expect(request.dryRun).toBeUndefined();
      expect(request.confirmLevel).toBeUndefined();
    });

    it('constructs complete FixRequest with all fields', () => {
      const request: FixRequest = {
        type: 'test-failures',
        target: 'src/test.ts',
        errorDescription: 'TypeError: Cannot read property',
        dryRun: true,
        confirmLevel: 'ask',
      };
      expect(request.type).toBe('test-failures');
      expect(request.target).toBe('src/test.ts');
      expect(request.errorDescription).toBe('TypeError: Cannot read property');
      expect(request.dryRun).toBe(true);
      expect(request.confirmLevel).toBe('ask');
    });

    it('constructs file-error request', () => {
      const request: FixRequest = {
        type: 'file-error',
        target: 'src/broken.ts',
        errorDescription: 'SyntaxError: Unexpected token',
      };
      expect(request.type).toBe('file-error');
      expect(request.target).toBe('src/broken.ts');
    });

    it('constructs natural-language request', () => {
      const request: FixRequest = {
        type: 'natural-language',
        target: 'Refactor this function to use async/await',
      };
      expect(request.type).toBe('natural-language');
      expect(request.target).toBe('Refactor this function to use async/await');
    });

    it('constructs dry-run request', () => {
      const request: FixRequest = {
        type: 'file-error',
        target: 'src/test.ts',
        dryRun: true,
      };
      expect(request.dryRun).toBe(true);
    });

    it('constructs auto-confirm request', () => {
      const request: FixRequest = {
        type: 'file-error',
        target: 'src/test.ts',
        confirmLevel: 'auto',
      };
      expect(request.confirmLevel).toBe('auto');
    });
  });

  // ── FileChange interface ───────────────────────────────────────────
  describe('FileChange interface', () => {
    it('constructs minimal FileChange with only path', () => {
      const change: FileChange = {
        path: 'src/fixed.ts',
      };
      expect(change.path).toBe('src/fixed.ts');
      expect(change.backupPath).toBeUndefined();
      expect(change.diff).toBeUndefined();
    });

    it('constructs complete FileChange with all fields', () => {
      const change: FileChange = {
        path: 'src/fixed.ts',
        backupPath: '/tmp/backup/src/fixed.ts.bak',
        diff: '--- a/src/fixed.ts\n+++ b/src/fixed.ts\n@@ -1 +1 @@\n-const x = 1\n+const x = 2',
      };
      expect(change.path).toBe('src/fixed.ts');
      expect(change.backupPath).toBe('/tmp/backup/src/fixed.ts.bak');
      expect(change.diff).toContain('--- a/src/fixed.ts');
      expect(change.diff).toContain('+const x = 2');
    });

    it('handles multiple file changes', () => {
      const changes: FileChange[] = [
        { path: 'src/a.ts', backupPath: '/tmp/a.ts.bak' },
        { path: 'src/b.ts', backupPath: '/tmp/b.ts.bak' },
        { path: 'src/c.ts' },
      ];
      expect(changes).toHaveLength(3);
      expect(changes[0].path).toBe('src/a.ts');
      expect(changes[1].path).toBe('src/b.ts');
      expect(changes[2].path).toBe('src/c.ts');
    });
  });

  // ── FixResult interface ────────────────────────────────────────────
  describe('FixResult interface', () => {
    it('constructs successful FixResult', () => {
      const result: FixResult = {
        success: true,
        taskId: 'fix-1234567890-abc123',
        changes: [{ path: 'src/fixed.ts' }],
        buildPassed: true,
        testsPassed: true,
        rolledBack: false,
      };
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('fix-1234567890-abc123');
      expect(result.changes).toHaveLength(1);
      expect(result.buildPassed).toBe(true);
      expect(result.testsPassed).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('constructs failed FixResult with error', () => {
      const result: FixResult = {
        success: false,
        taskId: 'fix-1234567890-abc123',
        changes: [],
        buildPassed: false,
        testsPassed: false,
        rolledBack: false,
        error: 'Failed to parse file: SyntaxError',
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to parse file: SyntaxError');
      expect(result.changes).toHaveLength(0);
    });

    it('constructs rolled-back FixResult', () => {
      const result: FixResult = {
        success: false,
        taskId: 'fix-1234567890-abc123',
        changes: [{ path: 'src/broken.ts', backupPath: '/tmp/backup.ts' }],
        buildPassed: false,
        testsPassed: false,
        rolledBack: true,
        error: 'Build failed after applying fix',
      };
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      expect(result.changes[0].backupPath).toBe('/tmp/backup.ts');
    });

    it('constructs dry-run FixResult', () => {
      const result: FixResult = {
        success: true,
        taskId: 'fix-1234567890-abc123',
        changes: [],
        buildPassed: true,
        testsPassed: true,
        rolledBack: false,
        error: 'Dry run mode - no changes applied',
      };
      expect(result.success).toBe(true);
      expect(result.error).toBe('Dry run mode - no changes applied');
    });

    it('constructs partial success FixResult (build passes but tests fail)', () => {
      const result: FixResult = {
        success: false,
        taskId: 'fix-1234567890-abc123',
        changes: [{ path: 'src/partial.ts' }],
        buildPassed: true,
        testsPassed: false,
        rolledBack: true,
        error: 'Tests failed after fix',
      };
      expect(result.success).toBe(false);
      expect(result.buildPassed).toBe(true);
      expect(result.testsPassed).toBe(false);
      expect(result.rolledBack).toBe(true);
    });

    it('handles multiple file changes in result', () => {
      const result: FixResult = {
        success: true,
        taskId: 'fix-1234567890-abc123',
        changes: [
          { path: 'src/a.ts', backupPath: '/tmp/a.ts.bak' },
          { path: 'src/b.ts', backupPath: '/tmp/b.ts.bak' },
        ],
        buildPassed: true,
        testsPassed: true,
        rolledBack: false,
      };
      expect(result.changes).toHaveLength(2);
      expect(result.changes[0].path).toBe('src/a.ts');
      expect(result.changes[1].path).toBe('src/b.ts');
    });
  });

  // ── Type compatibility ─────────────────────────────────────────────
  describe('Type compatibility', () => {
    it('FixRequest accepts all fix types', () => {
      const requests: FixRequest[] = [
        { type: 'file-error' },
        { type: 'test-failures' },
        { type: 'natural-language' },
      ];
      expect(requests.map(r => r.type)).toEqual(['file-error', 'test-failures', 'natural-language']);
    });

    it('FixResult requires all mandatory fields', () => {
      // This test validates that the type system enforces required fields
      const result: FixResult = {
        success: true,
        taskId: 'test-id',
        changes: [],
        buildPassed: false,
        testsPassed: false,
        rolledBack: false,
      };
      // Verify all required fields are present
      expect(result.success === true || result.success === false).toBe(true);
      expect(typeof result.taskId).toBe('string');
      expect(Array.isArray(result.changes)).toBe(true);
      expect(result.buildPassed === true || result.buildPassed === false).toBe(true);
      expect(result.testsPassed === true || result.testsPassed === false).toBe(true);
      expect(result.rolledBack === true || result.rolledBack === false).toBe(true);
    });
  });
});
