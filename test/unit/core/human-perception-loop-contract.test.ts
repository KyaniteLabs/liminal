import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('RalphLoop human perception guardrail contract', () => {
  it('runs perception ergonomics as a first-class gate instead of only as beauty scoring', () => {
    const source = readFileSync('src/core/RalphLoop.ts', 'utf8');

    expect(source).toContain('useHumanPerceptionGuardrails');
    expect(source).toContain('const shouldRunHumanPerception = normalizedOptions.useHumanPerceptionGuardrails;');
    expect(source).toContain("await import('../perception/index.js')");
    expect(source).toContain('evaluateCodePerception(');
    expect(source).toContain('[human-perception]');
    expect(source).toContain('humanPerceptionPassed');
  });
});
