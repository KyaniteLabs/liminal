import { describe, expect, it } from 'vitest';
import { CRAFT_CONTRACT, CRAFT_CONTRACT_COMPACT } from '../../../src/prompts/CraftContract';
import { PromptBuilder } from '../../../src/llm/PromptBuilder';

describe('CraftContract', () => {
  it('full contract demands every 0.9-band dimension', () => {
    for (const dim of ['COMPOSITION', 'DEPTH', 'LIGHT', 'PALETTE', 'MOTION', 'NEGATIVE SPACE', 'FINISH']) {
      expect(CRAFT_CONTRACT).toContain(dim);
    }
  });

  it('compact contract stays under a third of the full length', () => {
    expect(CRAFT_CONTRACT_COMPACT.length).toBeLessThan(CRAFT_CONTRACT.length / 3 + 50);
  });
});

describe('PromptBuilder craft wiring', () => {
  const ctx = { userRequest: 'a tide pool', domain: 'p5' };

  it('flagship and medium tiers carry the full contract', () => {
    for (const model of ['claude-opus-4-5', 'gpt-5']) {
      const built = new PromptBuilder({ baseUrl: '', model }).build(ctx);
      expect(built.system).toContain('<craft_contract>');
      expect(built.system).toContain('COMPOSITION: one dominant focal point');
    }
  });

  it('local tier carries the compact contract', () => {
    const built = new PromptBuilder({ baseUrl: 'http://localhost:11434', model: 'llama3:8b' }).build(ctx);
    expect(built.system).toContain('<craft_contract>');
    expect(built.system).toContain('Exhibition grade required');
  });
});
