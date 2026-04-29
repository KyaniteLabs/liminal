/**
 * Tests for SupplyChainGuardrail
 *
 * Covers audit result parsing, SBOM generation, and the evaluate() guardrail
 * by mocking child_process and fs/promises at the boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({ mockExecFile: vi.fn() }));
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

const { mockReadFile } = vi.hoisted(() => ({ mockReadFile: vi.fn() }));
vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { SupplyChainGuardrail, runNpmAudit, generateSBOM } from '../../../src/guardrails/compliance/SupplyChainGuardrail.js';

describe('SupplyChainGuardrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: findProjectRoot succeeds via git
    mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
      if (cmd === 'git') {
        cb(null, { stdout: '/mock/project/root\n', stderr: '' });
      } else {
        cb(null, { stdout: '{}', stderr: '' });
      }
    });
    mockReadFile.mockResolvedValue('{}');
  });

  describe('runNpmAudit', () => {
    it('returns ok status when no vulnerabilities found', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: JSON.stringify({ vulnerabilities: {}, metadata: { dependencies: { production: 10, development: 5 } } }), stderr: '' });
      });

      const result = await runNpmAudit();
      expect(result.status).toBe('ok');
      expect(result.totalDependencies).toBe(15);
      expect(result.vulnerabilities).toHaveLength(0);
    });

    it('parses vulnerabilities from audit output', async () => {
      const auditOutput = {
        vulnerabilities: {
          lodash: { severity: 'high', title: 'Prototype Pollution', via: [{ title: 'PP' }] },
          axios: { severity: 'moderate', advisory: 'SSRF' },
        },
        metadata: { dependencies: { production: 20, development: 0 } },
      };
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: JSON.stringify(auditOutput), stderr: '' });
      });

      const result = await runNpmAudit();
      expect(result.status).toBe('ok');
      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.vulnerabilities[0].package).toBe('lodash');
      expect(result.vulnerabilities[0].severity).toBe('high');
      expect(result.outdatedDependencies).toContain('lodash');
    });

    it('handles npm audit non-zero exit with valid JSON stdout', async () => {
      const err = Object.assign(new Error('vulnerabilities found'), {
        code: 1,
        stdout: JSON.stringify({ vulnerabilities: {}, metadata: { dependencies: {} } }),
      });
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(err);
      });

      const result = await runNpmAudit();
      expect(result.status).toBe('ok');
    });

    it('returns audit-command-unavailable when npm fails with no stdout', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(new Error('npm not found'));
      });

      const result = await runNpmAudit();
      expect(result.status).toBe('audit-command-unavailable');
    });

    it('returns audit-output-invalid when JSON is malformed', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: 'not valid json{', stderr: '' });
      });

      const result = await runNpmAudit();
      expect(result.status).toBe('audit-output-invalid');
    });

    it('returns audit-command-unavailable when npm fails and no git/fs available', async () => {
      // findProjectRoot never throws — it falls through to cwd, then npm audit fails
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(new Error('no git'));
      });
      mockReadFile.mockRejectedValue(new Error('no package.json'));

      const result = await runNpmAudit();
      // findProjectRoot falls back to cwd, so npm audit is attempted and fails
      expect(result.status).toBe('audit-command-unavailable');
    });

    it('normalizes invalid severity to low', async () => {
      const auditOutput = {
        vulnerabilities: { foo: { severity: 'unknown', title: 'Test' } },
        metadata: {},
      };
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: JSON.stringify(auditOutput), stderr: '' });
      });

      const result = await runNpmAudit();
      expect(result.vulnerabilities[0].severity).toBe('low');
    });
  });

  describe('generateSBOM', () => {
    it('returns ok with components from npm ls output', async () => {
      const lsOutput = {
        dependencies: {
          lodash: { version: '4.17.21', resolved: 'https://registry.npmjs.org/lodash' },
          express: { version: '4.18.0', dependencies: { bodyparser: { version: '1.20.0' } } },
        },
      };
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: JSON.stringify(lsOutput), stderr: '' });
      });

      const result = await generateSBOM();
      expect(result.generationStatus).toBe('ok');
      expect(result.components.length).toBe(3); // lodash, express, bodyparser
    });

    it('handles npm ls non-zero exit with valid JSON stdout', async () => {
      const err = Object.assign(new Error('missing deps'), {
        code: 1,
        stdout: JSON.stringify({ dependencies: {} }),
      });
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(err);
      });

      const result = await generateSBOM();
      expect(result.generationStatus).toBe('ok');
    });

    it('returns sbom-command-unavailable when npm ls fails', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(new Error('npm not found'));
      });

      const result = await generateSBOM();
      expect(result.generationStatus).toBe('sbom-command-unavailable');
    });

    it('returns sbom-output-invalid for malformed JSON', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: 'not-json', stderr: '' });
      });

      const result = await generateSBOM();
      expect(result.generationStatus).toBe('sbom-output-invalid');
    });
  });

  describe('evaluate (guardrail rule)', () => {
    it('passes when audit is clean', async () => {
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: JSON.stringify({ vulnerabilities: {}, metadata: {} }), stderr: '' });
      });

      const result = await SupplyChainGuardrail.evaluate({} as any);
      expect(result.passed).toBe(true);
      expect(result.guardrailId).toBe('guardrail-m14-supply-chain');
    });

    it('fails when critical vulnerabilities found', async () => {
      const auditOutput = {
        vulnerabilities: { evil: { severity: 'critical', title: 'RCE' } },
        metadata: {},
      };
      mockExecFile.mockImplementation((cmd: string, args: string[], opts: unknown, cb: Function) => {
        if (cmd === 'git') cb(null, { stdout: '/root\n', stderr: '' });
        else cb(null, { stdout: JSON.stringify(auditOutput), stderr: '' });
      });

      const result = await SupplyChainGuardrail.evaluate({} as any);
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warning');
      expect(result.message).toContain('critical/high');
    });

    it('fails when audit cannot complete', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(new Error('no git'));
      });
      mockReadFile.mockRejectedValue(new Error('no package.json'));

      const result = await SupplyChainGuardrail.evaluate({} as any);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('could not complete');
    });
  });
});
