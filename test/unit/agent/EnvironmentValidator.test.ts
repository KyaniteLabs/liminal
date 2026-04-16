/**
 * EnvironmentValidator unit tests — Phase 12 Increment 4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentValidator } from '../../../src/agent/EnvironmentValidator.js';

describe('EnvironmentValidator', () => {
  let validator: EnvironmentValidator;

  beforeEach(() => {
    validator = new EnvironmentValidator();
  });

  it('returns a report with checks array and allPassed boolean', async () => {
    const report = await validator.validate();
    expect(report.checks).toBeInstanceOf(Array);
    expect(report.checks.length).toBe(4); // Node, Go, Config, Provider
    expect(typeof report.allPassed).toBe('boolean');
    expect(typeof report.timestamp).toBe('string');
  });

  it('checks Node.js version', async () => {
    const report = await validator.validate();
    const nodeCheck = report.checks.find(c => c.name === 'Node.js');
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck!.status).toMatch(/^(pass|fail)$/);
    // We're running on Node 18+, so it should pass
    expect(nodeCheck!.status).toBe('pass');
    expect(nodeCheck!.message).toContain('v');
  });

  it('checks Go toolchain', async () => {
    const report = await validator.validate();
    const goCheck = report.checks.find(c => c.name === 'Go');
    expect(goCheck).toBeDefined();
    // Go may or may not be installed — either pass or warn
    expect(goCheck!.status).toMatch(/^(pass|warn)$/);
  });

  it('checks config file presence', async () => {
    const report = await validator.validate();
    const configCheck = report.checks.find(c => c.name === 'Config');
    expect(configCheck).toBeDefined();
    expect(configCheck!.status).toMatch(/^(pass|warn)$/);
  });

  it('checks provider config', async () => {
    const report = await validator.validate();
    const providerCheck = report.checks.find(c => c.name === 'Provider');
    expect(providerCheck).toBeDefined();
    expect(providerCheck!.status).toMatch(/^(pass|warn)$/);
  });

  it('allPassed is false if any check fails', async () => {
    // At minimum, we can verify the boolean logic
    const report = await validator.validate();
    const hasFailure = report.checks.some(c => c.status === 'fail');
    expect(report.allPassed).toBe(!hasFailure);
  });

  it('each check has name, status, and message', async () => {
    const report = await validator.validate();
    for (const check of report.checks) {
      expect(check.name).toBeTruthy();
      expect(check.status).toMatch(/^(pass|fail|warn)$/);
      expect(check.message).toBeTruthy();
    }
  });
});
