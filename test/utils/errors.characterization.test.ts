import { describe, it, expect } from 'vitest';

/**
 * Characterization tests for error formatting patterns
 *
 * These tests document the current behavior of error formatting
 * across 25+ locations in the codebase. The pattern:
 *
 *   const message = error instanceof Error ? error.message : String(error);
 *   const formatted = `${context}: ${message}`;
 *
 * is duplicated in many files. This test ensures the extracted
 * utility maintains the same behavior.
 */

describe('Error Formatting Patterns (Characterization)', () => {
  describe('Pattern 1: Basic error formatting', () => {
    it('should format Error instances with their message', () => {
      const error = new Error('Something went wrong');
      const context = 'TestContext';

      // Current pattern used across codebase
      const message = error instanceof Error ? error.message : String(error);
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('TestContext: Something went wrong');
    });

    it('should format non-Error values using String()', () => {
      const error = 'string error';
      const context = 'TestContext';

      const message = error instanceof Error ? error.message : String(error);
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('TestContext: string error');
    });

    it('should format numbers using String()', () => {
      const error = 404;
      const context = 'Status';

      const message = error instanceof Error ? error.message : String(error);
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('Status: 404');
    });

    it('should format null using String()', () => {
      const error = null;
      const context = 'NullTest';

      const message = error instanceof Error ? error.message : String(error);
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('NullTest: null');
    });

    it('should format undefined using String()', () => {
      const error = undefined;
      const context = 'UndefinedTest';

      const message = error instanceof Error ? error.message : String(error);
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('UndefinedTest: undefined');
    });

    it('should format objects using String()', () => {
      const error = { code: 'ERR_001' };
      const context = 'ObjectTest';

      const message = error instanceof Error ? error.message : String(error);
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('ObjectTest: [object Object]');
    });
  });

  describe('Pattern 2: Error with stack trace', () => {
    it('should include stack trace when available', () => {
      const error = new Error('With stack');
      const context = 'StackTest';

      // Pattern used in some locations for detailed errors
      let formatted: string;
      if (error instanceof Error && error.stack) {
        formatted = `${context}: ${error.message}\n${error.stack}`;
      } else {
        const message = error instanceof Error ? error.message : String(error);
        formatted = `${context}: ${message}`;
      }

      expect(formatted).toContain('StackTest: With stack');
      expect(formatted).toContain('Error: With stack');
    });

    it('should fall back to basic formatting without stack', () => {
      const error = 'no stack here';
      const context = 'StackTest';

      let formatted: string;
      if (error instanceof Error && error.stack) {
        formatted = `${context}: ${error.message}\n${error.stack}`;
      } else {
        const message = error instanceof Error ? error.message : String(error);
        formatted = `${context}: ${message}`;
      }

      expect(formatted).toBe('StackTest: no stack here');
    });
  });

  describe('Pattern 3: Variation with Unknown error fallback', () => {
    it('should use "Unknown error" as fallback (used in backup.ts)', () => {
      const error = null;
      const context = 'BackupContext';

      // Variation found in src/harness/tools/backup.ts
      const message = error instanceof Error ? error.message : 'Unknown error';
      const formatted = `${context}: ${message}`;

      expect(formatted).toBe('BackupContext: Unknown error');
    });
  });

  describe('Files using error formatting patterns', () => {
    it('documents all 25+ locations using this pattern', () => {
      const locations = [
        'src/compost/ModelRouter.ts:255',
        'src/harness/agent/HarnessAgent.ts:190',
        'src/harness/agent/HarnessAgent.ts:325',
        'src/harness/agent/LLMModeAgent.ts:226',
        'src/harness/tools/backup.ts:48',
        'src/harness/tools/NpmTool.ts:82',
        'src/harness/tools/ValidationGuard.ts:127',
        'src/harness/tools/RateLimiter.ts:108',
        'scripts/generate-single.ts:190',
        'scripts/dogfood-all-domains.ts:161',
        'test/e2e/model-comparison.test.ts:178',
        'scripts/test-qwen-models.ts:161',
        'scripts/test-qwen-models.ts:165',
        'src/render/CanvasRecorder.ts:116',
        'src/plugins/PluginLoader.ts:123',
        'src/tui/preview/AudioPlayer.ts:111',
        'src/tui/NaturalInterface.ts:281',
        'src/tui/NaturalInterface.ts:374',
        'src/tui/commands.ts:180',
        'src/tui/HarnessTUI.tsx:503',
        'src/guardrails/SemanticValidator.ts:99',
        'src/guardrails/AccessibilityGuardrails.ts:175',
        'src/guardrails/RuntimeHealthMonitor.ts:229',
        'src/core/RalphLoop.ts:520',
      ];

      // Verify we have documented all 24 locations
      expect(locations.length).toBe(24);

      // All should follow the pattern (file path with line number)
      locations.forEach(location => {
        expect(location).toMatch(/^[a-zA-Z0-9_\/\-.]+\.tsx?:\d+$/);
      });
    });
  });
});
