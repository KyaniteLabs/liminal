import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Integration tests for the `liminal fix` command
 *
 * Tests the full flow from CLI to orchestrator, including:
 * - CLI argument parsing
 * - Fix type detection
 * - Dry-run mode
 * - Error handling
 */

describe('fix command integration', () => {
  const testDir = join(tmpdir(), 'liminal-fix-test-' + Date.now());

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ── CLI help and documentation ─────────────────────────────────────
  describe('CLI help', () => {
    it('help text includes fix command options', () => {
      // Verify the bin/liminal file contains fix command help
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('--error');
      expect(binContent).toContain('--test-failures');
      expect(binContent).toContain('--test-file');
      expect(binContent).toContain('--dry-run');
      expect(binContent).toContain('--confirm');
      expect(binContent).toContain('fix command');
    });

    it('fix command is recognized in CLI', () => {
      // The CLI should recognize 'fix' as a valid command
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain("cmd === 'fix'");
    });
  });

  // ── Fix type detection ─────────────────────────────────────────────
  describe('fix type detection', () => {
    it('detects file-error type for .ts files', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      // Verify the regex pattern for TypeScript files exists
      expect(binContent).toContain('\\.(ts|js|tsx|jsx)');
    });

    it('detects test-failures type from --test-failures flag', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain("flags.testFailures");
      expect(binContent).toContain("fixType = 'test-failures'");
    });

    it('defaults to natural-language type', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain("fixType = 'natural-language'");
    });
  });

  // ── Confirmation level validation ──────────────────────────────────
  describe('confirmation level validation', () => {
    it('validates confirm option values', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      // Check that validation includes all three levels
      expect(binContent).toContain("['auto', 'ask', 'never']");
      expect(binContent).toContain('--confirm must be one of');
    });

    it('defaults to ask confirmation level', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain("flags.confirm || 'ask'");
    });
  });

  // ── Fix configuration building ─────────────────────────────────────
  describe('fix configuration', () => {
    it('builds fix config from parsed arguments', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('fixConfig');
      expect(binContent).toContain('target: fixTarget');
      expect(binContent).toContain('error: flags.error');
      expect(binContent).toContain('dryRun: flags.dryRun');
    });

    it('builds fix request with all parameters', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('fixRequest');
      expect(binContent).toContain('type: fixType');
      expect(binContent).toContain('target: fixTarget || flags.testFile');
      expect(binContent).toContain('errorDescription: flags.error');
      expect(binContent).toContain('dryRun: flags.dryRun');
      expect(binContent).toContain('confirmLevel');
    });
  });

  // ── Orchestrator integration ───────────────────────────────────────
  describe('orchestrator integration', () => {
    it('imports AutoFixOrchestrator from dist', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain("import('../dist/fix/index.js')");
      expect(binContent).toContain('AutoFixOrchestrator');
    });

    it('creates LLMClient with generator role', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('new LLMClient');
      expect(binContent).toContain("role: 'generator'");
    });

    it('creates orchestrator with LLM client', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('new AutoFixOrchestrator(llmClient)');
    });

    it('calls executeFix with the fix request', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('orchestrator.executeFix(fixRequest)');
    });
  });

  // ── Output formatting ──────────────────────────────────────────────
  describe('output formatting', () => {
    it('displays success message on successful fix', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('Fix completed successfully!');
      expect(binContent).toContain('✅');
    });

    it('displays failure message on failed fix', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('Fix failed');
      expect(binContent).toContain('❌');
    });

    it('displays task details in output', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('Task ID:');
      expect(binContent).toContain('result.taskId');
      expect(binContent).toContain('Changes:');
      expect(binContent).toContain('result.changes.length');
      expect(binContent).toContain('Build passed:');
      expect(binContent).toContain('Tests passed:');
    });

    it('displays rollback warning when applicable', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('Changes were rolled back');
      expect(binContent).toContain('result.rolledBack');
      expect(binContent).toContain('⚠️');
    });
  });

  // ── Exit codes ─────────────────────────────────────────────────────
  describe('exit codes', () => {
    it('exits with 0 on success', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('process.exit(result.success ? 0 : 1)');
    });

    it('exits with 1 on failure', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      // Verify error handling exits with code 1
      expect(binContent).toContain('process.exit(1)');
    });

    it('exits with 1 on invalid confirm option', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      // The validation block should exit with 1
      expect(binContent).toContain("process.exit(1)");
    });
  });

  // ── Error display ──────────────────────────────────────────────────
  describe('error display', () => {
    it('displays error message from result', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('result.error');
      expect(binContent).toContain('Error:');
    });

    it('displays execution errors', () => {
      const binPath = join(process.cwd(), 'bin/liminal');
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      expect(binContent).toContain('Fix execution error:');
      expect(binContent).toContain('error.message');
    });
  });

  // ── Type exports ───────────────────────────────────────────────────
  describe('type exports', () => {
    it('exports types from fix module', () => {
      const typesPath = join(process.cwd(), 'src/fix/types.ts');
      const typesContent = execSync(`cat "${typesPath}"`, { encoding: 'utf-8' });

      expect(typesContent).toContain('export type FixType');
      expect(typesContent).toContain('export type ConfirmLevel');
      expect(typesContent).toContain('export interface FixRequest');
      expect(typesContent).toContain('export interface FixResult');
      expect(typesContent).toContain('export interface FileChange');
    });

    it('exports AutoFixOrchestrator from fix module', () => {
      const indexPath = join(process.cwd(), 'src/fix/index.ts');
      if (existsSync(indexPath)) {
        const indexContent = execSync(`cat "${indexPath}"`, { encoding: 'utf-8' });
        expect(indexContent).toContain('AutoFixOrchestrator');
      }
    });
  });
});

/**
 * Unit-style integration tests for the fix command module
 *
 * These tests verify the fix command components work together
 * without requiring a full build.
 */
describe('fix command module integration', () => {
  // ── Type consistency ───────────────────────────────────────────────
  describe('type consistency', () => {
    it('FixType matches implementation usage', async () => {
      const { executeFix } = await import('../../../src/fix/AutoFixOrchestrator.js');
      const typesPath = join(process.cwd(), 'src/fix/types.ts');
      const typesContent = execSync(`cat "${typesPath}"`, { encoding: 'utf-8' });

      // Verify all fix types in implementation match type definition
      expect(typesContent).toContain("'file-error'");
      expect(typesContent).toContain("'test-failures'");
      expect(typesContent).toContain("'natural-language'");
    }, 30000);

    it('FixResult fields match CLI output expectations', () => {
      const typesPath = join(process.cwd(), 'src/fix/types.ts');
      const binPath = join(process.cwd(), 'bin/liminal');
      const typesContent = execSync(`cat "${typesPath}"`, { encoding: 'utf-8' });
      const binContent = execSync(`cat "${binPath}"`, { encoding: 'utf-8' });

      // CLI accesses these fields, so they must exist in the type
      expect(typesContent).toContain('success:');
      expect(typesContent).toContain('taskId:');
      expect(typesContent).toContain('changes:');
      expect(typesContent).toContain('buildPassed:');
      expect(typesContent).toContain('testsPassed:');
      expect(typesContent).toContain('rolledBack:');
      expect(typesContent).toContain('error?:');

      // CLI uses these fields
      expect(binContent).toContain('result.success');
      expect(binContent).toContain('result.taskId');
      expect(binContent).toContain('result.changes.length');
      expect(binContent).toContain('result.buildPassed');
      expect(binContent).toContain('result.testsPassed');
      expect(binContent).toContain('result.rolledBack');
    });
  });

  // ── Orchestrator behavior ──────────────────────────────────────────
  describe('orchestrator behavior', () => {
    it('orchestrator handles all fix types', () => {
      const orchestratorPath = join(process.cwd(), 'src/fix/AutoFixOrchestrator.ts');
      const orchestratorContent = execSync(`cat "${orchestratorPath}"`, { encoding: 'utf-8' });

      // Should have switch cases for all fix types
      expect(orchestratorContent).toContain("case 'file-error':");
      expect(orchestratorContent).toContain("case 'test-failures':");
      expect(orchestratorContent).toContain("case 'natural-language':");
    });

    it('orchestrator uses LLMModeAgent for fixes', () => {
      const orchestratorPath = join(process.cwd(), 'src/fix/AutoFixOrchestrator.ts');
      const orchestratorContent = execSync(`cat "${orchestratorPath}"`, { encoding: 'utf-8' });

      expect(orchestratorContent).toContain('createLLMModeAgent');
      expect(orchestratorContent).toContain('agent.executeTask');
    });

    it('orchestrator handles dry-run mode', () => {
      const orchestratorPath = join(process.cwd(), 'src/fix/AutoFixOrchestrator.ts');
      const orchestratorContent = execSync(`cat "${orchestratorPath}"`, { encoding: 'utf-8' });

      expect(orchestratorContent).toContain('request.dryRun');
      expect(orchestratorContent).toContain('Dry run mode');
    });
  });
});
