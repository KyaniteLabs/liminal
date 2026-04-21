import { describe, expect, it } from 'vitest';
import {
  getOpenAIRolePolicy,
  getRecommendedOpenAIModelsForRole,
  isOpenAIModelRecommendedForRole,
  OPENAI_SMALL_ROLE_POLICY,
  OPENAI_SMALL_ROLE_POLICY_EVIDENCE,
} from '../../../src/config/OpenAIRolePolicy.js';
import { getRecommendedOpenAIModelsForRole as getRecommendedOpenAIModelsForRoleFromPublicApi } from '../../../src/index.js';

describe('OpenAI small model role policy', () => {
  it('records the proof artifact that produced the policy', () => {
    expect(OPENAI_SMALL_ROLE_POLICY_EVIDENCE).toBe('.omx/proof/openai-small-role-matrix/2026-04-21T23-22-33-496Z/report.md');
  });

  it('keeps gpt-4o-mini and gpt-5.4-mini as generator recommendations', () => {
    expect(getRecommendedOpenAIModelsForRole('generator')).toEqual(['gpt-4o-mini', 'gpt-5.4-mini']);
    expect(isOpenAIModelRecommendedForRole('gpt-4o-mini', 'generator')).toBe(true);
    expect(isOpenAIModelRecommendedForRole('gpt-5.4-mini', 'generator')).toBe(true);
  });

  it('uses gpt-5.4-mini as the evaluator and harness recommendation', () => {
    expect(getRecommendedOpenAIModelsForRole('evaluator')).toEqual(['gpt-5.4-mini']);
    expect(getRecommendedOpenAIModelsForRole('harness')).toEqual(['gpt-5.4-mini']);
  });

  it('is exported from the public package surface', () => {
    expect(getRecommendedOpenAIModelsForRoleFromPublicApi('generator')).toEqual(['gpt-4o-mini', 'gpt-5.4-mini']);
  });

  it('does not recommend failed small generators for creative-code generation', () => {
    for (const model of ['gpt-5.4-nano', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini']) {
      expect(getOpenAIRolePolicy(model)?.generator).toBe('not_recommended');
      expect(isOpenAIModelRecommendedForRole(model, 'generator')).toBe(false);
    }
  });

  it('marks gpt-5-mini, gpt-5-nano, and o4-mini as not recommended for all tested roles', () => {
    for (const model of ['gpt-5-mini', 'gpt-5-nano', 'o4-mini']) {
      const policy = getOpenAIRolePolicy(model);
      expect(policy?.generator).toBe('not_recommended');
      expect(policy?.evaluator).toBe('not_recommended');
      expect(policy?.harness).toBe('not_recommended');
    }
  });

  it('has one policy entry per tested model', () => {
    expect(OPENAI_SMALL_ROLE_POLICY.map(entry => entry.model).sort()).toEqual([
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'o4-mini',
    ].sort());
  });
});
