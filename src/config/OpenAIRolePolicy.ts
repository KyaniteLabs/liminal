import type { ModelRole } from './RoleConfig.js';

export type OpenAIRolePolicyStatus = 'recommended' | 'acceptable' | 'not_recommended';

export interface OpenAIRolePolicyEntry {
  model: string;
  generator: OpenAIRolePolicyStatus;
  evaluator: OpenAIRolePolicyStatus;
  harness: OpenAIRolePolicyStatus;
  notes: string;
}

export const OPENAI_SMALL_ROLE_POLICY_EVIDENCE = '.omx/proof/openai-small-role-matrix/2026-04-21T23-22-33-496Z/report.md';

export const OPENAI_SMALL_ROLE_POLICY: readonly OpenAIRolePolicyEntry[] = [
  {
    model: 'gpt-5.4-mini',
    generator: 'recommended',
    evaluator: 'recommended',
    harness: 'recommended',
    notes: 'Passed shader/hydra generator smoke, evaluator classification, and harness repair cases.',
  },
  {
    model: 'gpt-4o-mini',
    generator: 'recommended',
    evaluator: 'acceptable',
    harness: 'acceptable',
    notes: 'Passed shader/hydra generator smoke and role checks; cheapest passing generator candidate in this sweep.',
  },
  {
    model: 'gpt-4o',
    generator: 'acceptable',
    evaluator: 'acceptable',
    harness: 'acceptable',
    notes: 'Passed all tested roles, but is not the cheapest passing option.',
  },
  {
    model: 'gpt-5.4-nano',
    generator: 'not_recommended',
    evaluator: 'acceptable',
    harness: 'acceptable',
    notes: 'Failed shader/hydra generator smoke, but classified evaluator cases and harness repair cases correctly.',
  },
  {
    model: 'gpt-4.1-mini',
    generator: 'not_recommended',
    evaluator: 'acceptable',
    harness: 'acceptable',
    notes: 'Shader passed but Hydra failed as generator; evaluator and harness cases passed.',
  },
  {
    model: 'gpt-4.1-nano',
    generator: 'not_recommended',
    evaluator: 'acceptable',
    harness: 'acceptable',
    notes: 'Shader passed but Hydra failed as generator; evaluator and harness cases passed.',
  },
  {
    model: 'gpt-5-mini',
    generator: 'not_recommended',
    evaluator: 'not_recommended',
    harness: 'not_recommended',
    notes: 'Failed generator smoke and failed evaluator/harness role calls under current adapter settings.',
  },
  {
    model: 'gpt-5-nano',
    generator: 'not_recommended',
    evaluator: 'not_recommended',
    harness: 'not_recommended',
    notes: 'Failed generator smoke and failed evaluator/harness role calls under current adapter settings.',
  },
  {
    model: 'o4-mini',
    generator: 'not_recommended',
    evaluator: 'not_recommended',
    harness: 'not_recommended',
    notes: 'Failed generator smoke and failed evaluator/harness role calls under current adapter settings.',
  },
];

export const OPENAI_RECOMMENDED_MODELS_BY_ROLE: Readonly<Record<Extract<ModelRole, 'generator' | 'evaluator' | 'harness'>, readonly string[]>> = {
  generator: ['gpt-4o-mini', 'gpt-5.4-mini'],
  evaluator: ['gpt-5.4-mini'],
  harness: ['gpt-5.4-mini'],
};

export function getOpenAIRolePolicy(model: string): OpenAIRolePolicyEntry | undefined {
  return OPENAI_SMALL_ROLE_POLICY.find(entry => entry.model === model);
}

export function isOpenAIModelRecommendedForRole(model: string, role: Extract<ModelRole, 'generator' | 'evaluator' | 'harness'>): boolean {
  const policy = getOpenAIRolePolicy(model);
  return policy?.[role] === 'recommended';
}

export function getRecommendedOpenAIModelsForRole(role: Extract<ModelRole, 'generator' | 'evaluator' | 'harness'>): readonly string[] {
  return OPENAI_RECOMMENDED_MODELS_BY_ROLE[role];
}
