import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('RalphLoop human perception guardrail contract', () => {
  it('runs perception ergonomics with aesthetic guardrails instead of treating beauty rules as the only gate', () => {
    const source = readFileSync('src/core/RalphLoop.ts', 'utf8');

    expect(source).toContain("await import('../perception/index.js')");
    expect(source).toContain('evaluateCodePerception(');
    expect(source).toContain('[human-perception]');
    expect(source).toContain('humanPerceptionPassed');
  });
});
