import { describe, it, expect } from 'vitest';

describe('RalphLoop aesthetic gate', () => {
  it('aesthetic guardrails can be enabled via config', async () => {
    // This test verifies the config wiring, not a full loop run
    // (which would require an LLM). We test that the aesthetic
    // code path is reached when useAestheticGuardrails is true.
    const { normalizeOptions } = await import('../../../src/core/LoopConfig.js');
    const opts = normalizeOptions({ useAestheticGuardrails: true });
    expect(opts.useAestheticGuardrails).toBe(true);
  });

  it('AestheticCritic can be imported and used independently', async () => {
    const { AestheticCritic } = await import('../../../src/aesthetic/index.js');
    const critic = new AestheticCritic();
    const report = critic.critique('fill("#ff0000"); rect(10, 10, 100, 100);');
    expect(report.score).toBeGreaterThan(0);
    expect(typeof report.passed).toBe('boolean');
  });

  it('AestheticStrategy can be registered into ScoringEngine', async () => {
    const { ScoringEngine } = await import('../../../src/core/ScoringEngine.js');
    const { AestheticStrategy } = await import('../../../src/aesthetic/AestheticStrategy.js');
    const engine = new ScoringEngine();
    engine.register(new AestheticStrategy());
    const strategy = engine.getStrategy('aesthetic');
    expect(strategy).toBeDefined();
    const result = await strategy!.score({ output: 'fill("#ff0000");' });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
