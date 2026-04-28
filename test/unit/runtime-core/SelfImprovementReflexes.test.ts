import { describe, expect, it } from 'vitest';
import { Status } from '../../../src/types/status.js';
import {
  SELF_IMPROVEMENT_GAUNTLET_PROMPTS,
  SelfImprovementReflexEngine,
  runSelfImprovementGauntlet,
} from '../../../src/runtime-core/SelfImprovementReflexes.js';

describe('SelfImprovementReflexEngine', () => {
  it('classifies the immediate repair reflex for no-mutation self-improvement failures', () => {
    const reflex = new SelfImprovementReflexEngine().classify({
      status: Status.FAILED,
      exitReason: 'bounded-no-mutation',
      mutatedFiles: [],
      successfulMutatedFiles: [],
      messages: [],
    });

    expect(reflex.failureClass).toBe('no-mutation');
    expect(reflex.nextAction).toBe('shrink-and-force-mutation');
    expect(reflex.organs).toEqual(['reflexes', 'memory', 'intuition']);
    expect(reflex.retryPrompt).toContain('smallest safe edit');
    expect(reflex.retryPrompt).toContain('writeFile/applyEdit');
  });

  it('classifies parse/tool-call failures as schema-repair reflexes', () => {
    const reflex = new SelfImprovementReflexEngine().classify({
      status: Status.FAILED,
      lastPlanError: 'Failed to parse LLM response',
      mutatedFiles: [],
      successfulMutatedFiles: [],
      messages: [{ role: 'assistant', content: 'I would inspect the file first.' }],
    });

    expect(reflex.failureClass).toBe('tool-schema-drift');
    expect(reflex.nextAction).toBe('repair-tool-json');
    expect(reflex.organs).toContain('reflexes');
  });

  it('classifies successful mutation runs as procedural memory, not another proof demand', () => {
    const reflex = new SelfImprovementReflexEngine().classify({
      status: Status.SUCCESS,
      mutatedFiles: ['src/runtime-core/RepoIndexLite.ts'],
      successfulMutatedFiles: ['src/runtime-core/RepoIndexLite.ts'],
      messages: [],
    });

    expect(reflex.failureClass).toBe('none');
    expect(reflex.nextAction).toBe('record-procedural-memory');
    expect(reflex.organs).toEqual(['memory', 'intuition']);
  });
});

describe('runSelfImprovementGauntlet', () => {
  it('runs a deterministic prompt gauntlet across reflex/cognitive/domain/model concerns', () => {
    const result = runSelfImprovementGauntlet();

    expect(result.total).toBe(SELF_IMPROVEMENT_GAUNTLET_PROMPTS.length);
    expect(result.passed).toBe(result.total);
    expect(result.failed).toBe(0);
    expect(result.level).toBe('3.5-candidate');
    expect(result.organsTouched).toEqual(expect.arrayContaining([
      'reflexes',
      'memory',
      'compost',
      'dreaming',
      'intuition',
      'model-assimilation',
    ]));
    expect(result.results.every((entry) => entry.checks.selfImprovementIntent)).toBe(true);
    expect(result.results.every((entry) => entry.checks.domainPreservation)).toBe(true);
    expect(result.results.every((entry) => entry.checks.boundedWorkingSet)).toBe(true);
    expect(result.results.every((entry) => entry.checks.hasVerification)).toBe(true);
    expect(result.results.every((entry) => entry.fileHint.startsWith('src/'))).toBe(true);
  });
});
