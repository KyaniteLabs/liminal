import { describe, expect, it } from 'vitest';

import { CodeValidator } from '../../../src/core/CodeValidator.js';
import {
  CANARY_CODE,
  assertLegalTransition,
  adjudicateFinal,
  buildFailureSignature,
  candidateToFinalSummary,
  decideNextAction,
  evaluatorSkipReasonFor,
  isRuntimeSupportedDomain,
  rankScore,
  resolveDf2Preset,
  type CandidateSummary,
} from '../../../scripts/dogfood/df2-minimal-fsm.js';

function candidate(overrides: Partial<CandidateSummary>): CandidateSummary {
  return {
    candidateId: 'candidate-01',
    attempt: 1,
    generatorModel: 'qwen3.5-2b',
    status: 'evaluated',
    deterministicValidation: 'pass',
    runtime: 'pass',
    runtimeHealthScore: 90,
    evaluatorOverall: 88,
    evaluatorConfidence: 0.82,
    rankScore: 88.4,
    finalBand: 'launch_ready',
    failureSignature: null,
    artifactRoot: 'candidate-01',
    concreteRepairAdvice: [],
    ...overrides,
  };
}

describe('DF2 minimal FSM', () => {
  it('rejects illegal evaluator and second-attempt transitions', () => {
    expect(() => assertLegalTransition('RUNTIME_EXECUTE', 'EVALUATE', { validationPassed: false, runtimePassed: true })).toThrow(/EVALUATE/);
    expect(() => assertLegalTransition('RUNTIME_EXECUTE', 'EVALUATE', { validationPassed: true, runtimePassed: false })).toThrow(/EVALUATE/);
    expect(() => assertLegalTransition('DECIDE_NEXT', 'ATTEMPT_2', { candidate1Summarized: false })).toThrow(/candidate 1/);
    expect(() => assertLegalTransition('RUNTIME_EXECUTE', 'EVALUATE', { validationPassed: true, runtimePassed: true })).not.toThrow();
  });

  it('allows evaluator only after deterministic validation and runtime pass', () => {
    expect(evaluatorSkipReasonFor({ validationPassed: false, runtimePassed: true, runtimeArtifactPresent: true })).toBe('deterministic_validation_fail');
    expect(evaluatorSkipReasonFor({ validationPassed: true, runtimePassed: false, runtimeArtifactPresent: true })).toBe('runtime_fail');
    expect(evaluatorSkipReasonFor({ validationPassed: true, runtimePassed: true, runtimeArtifactPresent: false })).toBe('missing_runtime_artifacts');
    expect(evaluatorSkipReasonFor({ validationPassed: true, runtimePassed: true, runtimeArtifactPresent: true })).toBeNull();
  });

  it('normalizes failure signatures and ignores evidence hash when comparing repeated failures', () => {
    const first = buildFailureSignature({ stage: 'validate', className: 'api_mismatch', ruleId: 'p5-undeclared', domain: 'p5', evidence: 'alpha' });
    const second = buildFailureSignature({ stage: 'validate', className: 'api_mismatch', ruleId: 'p5-undeclared', domain: 'p5', evidence: 'beta' });
    expect(first).toMatchObject({ stage: 'validate', class: 'api_mismatch', ruleId: 'p5-undeclared', domain: 'p5' });
    expect(first.topEvidenceHash).not.toBe(second.topEvidenceHash);
    expect(decideNextAction(candidate({
      status: 'validate_fail',
      deterministicValidation: 'fail',
      runtime: 'not_run',
      finalBand: 'fail',
      failureSignature: first,
    }), [second], true).action).toBe('switch_generator');
  });

  it('routes first concrete validation/runtime failures to same-generator repair', () => {
    const validateFailure = candidate({
      status: 'validate_fail',
      deterministicValidation: 'fail',
      runtime: 'not_run',
      finalBand: 'fail',
      failureSignature: buildFailureSignature({ stage: 'validate', className: 'syntax', ruleId: 'syntax', domain: 'glsl', evidence: 'bad semicolon' }),
    });
    expect(decideNextAction(validateFailure, [], true)).toMatchObject({ action: 'retry_same_generator' });

    const timeout = candidate({
      status: 'generate_fail',
      deterministicValidation: 'fail',
      runtime: 'not_run',
      finalBand: 'fail',
      failureSignature: buildFailureSignature({ stage: 'generate', className: 'timeout', ruleId: 'timeout', domain: 'kinetic', evidence: '120s' }),
    });
    expect(decideNextAction(timeout, [], true)).toMatchObject({ action: 'switch_generator' });
  });

  it('adjudicates launch-ready, functional, quality-warning, and generator-failure outcomes deterministically', () => {
    expect(adjudicateFinal([candidate({})], { canaryPassed: true }).terminalOutcome).toBe('launch_ready_pass');
    expect(adjudicateFinal([candidate({ finalBand: 'functional', evaluatorOverall: 70, rankScore: 74 })], { canaryPassed: true }).terminalOutcome).toBe('functional_pass');
    expect(adjudicateFinal([candidate({ finalBand: 'warning', evaluatorOverall: 58, rankScore: 59 })], { canaryPassed: true }).terminalOutcome).toBe('quality_warning');
    expect(adjudicateFinal([
      candidate({ candidateId: 'candidate-01', attempt: 1, status: 'validate_fail', deterministicValidation: 'fail', runtime: 'not_run', finalBand: 'fail', rankScore: null }),
      candidate({ candidateId: 'candidate-02', attempt: 2, status: 'runtime_fail', runtime: 'fail', finalBand: 'fail', rankScore: null }),
    ], { canaryPassed: true }).terminalOutcome).toBe('generator_compatibility_failure');
  });

  it('marks improved second candidates as best observed for the config, not greatness', () => {
    const result = adjudicateFinal([
      candidate({ candidateId: 'candidate-01', attempt: 1, finalBand: 'warning', evaluatorOverall: 45, rankScore: 47 }),
      candidate({ candidateId: 'candidate-02', attempt: 2, finalBand: 'warning', evaluatorOverall: 58, rankScore: 59 }),
    ], { canaryPassed: true });

    expect(result.terminalOutcome).toBe('quality_warning');
    expect(result.capabilityCeiling).toBe('best_observed_for_config');
    expect(result.bestQualityCandidateId).toBe('candidate-02');
  });

  it('resolves presets and keeps runtime-supported domains narrow for DF2 v1', () => {
    expect(resolveDf2Preset('qwen-local').primaryGenerator.model).toBe('qwen3.5-2b');
    expect(resolveDf2Preset('glm-ab').primaryGenerator.model).toBe('glm-4.5-air');
    expect(isRuntimeSupportedDomain('p5')).toBe(true);
    expect(isRuntimeSupportedDomain('tone')).toBe(false);
    expect(isRuntimeSupportedDomain('ascii')).toBe(false);
  });

  it('keeps all DF2 runtime-supported canaries validator-clean', () => {
    for (const [domain, code] of Object.entries(CANARY_CODE)) {
      const result = CodeValidator.validate(code, domain);
      expect(result.errors, `${domain}: ${result.errors.join('; ')}`).toHaveLength(0);
      expect(result.valid).toBe(true);
    }
  });

  it('classifies unsupported runtime domains as harness/wrapper failures', () => {
    const result = adjudicateFinal([], { canaryPassed: false, domain: 'tone' });
    expect(result.terminalOutcome).toBe('harness_validator_wrapper_failure');
    expect(result.rootCause).toBe('wrapper');
  });

  it('maps candidates into final adjudication summaries without evaluator override of deterministic failures', () => {
    const summary = candidateToFinalSummary(candidate({
      status: 'runtime_fail',
      runtime: 'fail',
      evaluatorOverall: 99,
      evaluatorConfidence: 0.99,
      rankScore: 99,
      finalBand: 'fail',
    }));

    expect(summary.finalBand).toBe('fail');
    expect(rankScore(90, 50)).toBe(82);
  });
});
