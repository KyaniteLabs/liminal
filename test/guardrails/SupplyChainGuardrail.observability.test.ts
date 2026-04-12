import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '../../src/guardrails/core/types.js';

const { mockExecFile, mockReadFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('util', () => ({
  promisify: () => mockExecFile,
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

import {
  generateSBOM,
  runNpmAudit,
  SupplyChainGuardrail,
} from '../../src/guardrails/compliance/SupplyChainGuardrail.js';

function makeContext(): ExecutionContext {
  return {
    taskId: 'supply-chain-observability',
    step: 1,
    maxSteps: 5,
    startTime: Date.now(),
    resources: {
      tokensUsed: 0,
      tokensLimit: 1000,
      memoryUsedMB: 0,
      memoryLimitMB: 256,
      timeElapsedMs: 0,
      timeLimitMs: 60_000,
      apiCalls: 0,
      apiCallLimit: 10,
    },
    trace: { steps: [] },
  };
}

describe('SupplyChainGuardrail observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue('{}');
  });

  it('surfaces missing npm audit command as explicit fallback status', async () => {
    mockExecFile.mockImplementation(async (cmd: string) => {
      if (cmd === 'git') {
        return { stdout: '/repo\n', stderr: '' };
      }
      if (cmd === 'npm') {
        throw new Error('spawn npm ENOENT');
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    const audit = await runNpmAudit();

    expect(audit).toMatchObject({
      status: 'audit-command-unavailable',
      reason: expect.stringContaining('spawn npm ENOENT'),
      projectRoot: '/repo',
    });

    const result = await SupplyChainGuardrail.evaluate(makeContext());
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('could not complete');
    expect(result.details).toMatchObject({
      auditStatus: 'audit-command-unavailable',
      projectRoot: '/repo',
    });
  });

  it('treats parseable stdout from a non-zero npm audit exit as a real audit result', async () => {
    mockExecFile.mockImplementation(async (cmd: string) => {
      if (cmd === 'git') {
        return { stdout: '/repo\n', stderr: '' };
      }
      if (cmd === 'npm') {
        throw {
          stdout: JSON.stringify({
            vulnerabilities: {
              lodash: {
                severity: 'high',
                title: 'Prototype pollution',
              },
            },
            metadata: {
              dependencies: {
                production: 2,
                development: 3,
              },
            },
          }),
        };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    const audit = await runNpmAudit();

    expect(audit.status).toBe('ok');
    expect(audit.totalDependencies).toBe(5);
    expect(audit.vulnerabilities).toEqual([
      {
        package: 'lodash',
        severity: 'high',
        advisory: 'Prototype pollution',
      },
    ]);
  });

  it('surfaces invalid audit JSON instead of silently passing', async () => {
    mockExecFile.mockImplementation(async (cmd: string) => {
      if (cmd === 'git') {
        return { stdout: '/repo\n', stderr: '' };
      }
      if (cmd === 'npm') {
        return { stdout: 'not-json', stderr: '' };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    const result = await SupplyChainGuardrail.evaluate(makeContext());

    expect(result.passed).toBe(false);
    expect(result.details).toMatchObject({
      auditStatus: 'audit-output-invalid',
      projectRoot: '/repo',
    });
  });

  it('surfaces invalid SBOM output instead of returning an unlabeled empty skeleton', async () => {
    mockExecFile.mockImplementation(async (cmd: string, args: string[]) => {
      if (cmd === 'git') {
        return { stdout: '/repo\n', stderr: '' };
      }
      if (cmd === 'npm' && args[0] === 'ls') {
        return { stdout: 'not-json', stderr: '' };
      }
      throw new Error(`unexpected command: ${cmd} ${args.join(' ')}`);
    });

    const sbom = await generateSBOM();

    expect(sbom).toMatchObject({
      specVersion: '1.4',
      components: [],
      generationStatus: 'sbom-output-invalid',
      projectRoot: '/repo',
    });
  });
});
