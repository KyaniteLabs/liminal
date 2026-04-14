import { describe, expect, it } from 'vitest';

import { CodeValidator } from '../../../src/core/CodeValidator.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  CANARY_CODE,
  applyModelOverride,
  assertLegalTransition,
  adjudicateFinal,
  buildFailureSignature,
  candidateToFinalSummary,
  decideNextAction,
  evaluatorSkipReasonFor,
  isRuntimeSupportedDomain,
  normalizeScore100,
  rankScore,
  resolveDf2Preset,
  runVisionEvaluator,
  visionSkipReasonFor,
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

  it('only treats repeated signatures as harness failures across distinct generators', () => {
    const signature = buildFailureSignature({ stage: 'runtime', className: 'timeout', ruleId: 'timeout', domain: 'kinetic', evidence: 'timeout' });

    const sameGenerator = adjudicateFinal([
      candidate({ candidateId: 'candidate-01', attempt: 1, generatorModel: 'qwen-coder', status: 'generate_fail', runtime: 'not_run', finalBand: 'fail', rankScore: null, failureSignature: signature }),
      candidate({ candidateId: 'candidate-02', attempt: 2, generatorModel: 'qwen-coder', status: 'generate_fail', runtime: 'not_run', finalBand: 'fail', rankScore: null, failureSignature: signature }),
    ], { canaryPassed: true });
    expect(sameGenerator.terminalOutcome).toBe('generator_compatibility_failure');

    const crossGenerator = adjudicateFinal([
      candidate({ candidateId: 'candidate-01', attempt: 1, generatorModel: 'model-a', status: 'runtime_fail', runtime: 'fail', finalBand: 'fail', rankScore: null, failureSignature: signature }),
      candidate({ candidateId: 'candidate-02', attempt: 2, generatorModel: 'model-b', status: 'runtime_fail', runtime: 'fail', finalBand: 'fail', rankScore: null, failureSignature: signature }),
    ], { canaryPassed: true });
    expect(crossGenerator.terminalOutcome).toBe('harness_validator_wrapper_failure');
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

  it('clears inherited base URL when provider override changes provider', () => {
    const overridden = applyModelOverride(
      { provider: 'lmstudio', baseUrl: 'http://100.66.225.85:1234/v1', model: 'qwen3.5-2b' },
      { provider: 'openai', model: 'gpt-5.4-mini' },
    );

    expect(overridden.provider).toBe('openai');
    expect(overridden.model).toBe('gpt-5.4-mini');
    expect(overridden.baseUrl).toBeUndefined();
  });

  it('gives local LM Studio models longer DF2 timeouts than generic provider defaults', () => {
    expect(resolveDf2Preset('qwen-local').primaryGenerator.timeout).toBe(300000);
    expect(resolveDf2Preset('qwen-local').fallbackGenerator?.timeout).toBe(300000);
    expect(resolveDf2Preset('glm-ab').primaryGenerator.timeout).toBeUndefined();

    const localOverride = applyModelOverride(
      { provider: 'openai', model: 'gpt-5.4-mini' },
      { provider: 'lmstudio', model: 'qwen3-coder-next-reap-40b-a3b-i1' },
    );
    expect(localOverride.timeout).toBe(300000);
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

  it('normalizes evaluator scores whether models return 0-1 or 0-100 scale', () => {
    expect(normalizeScore100(0.97)).toBe(97);
    expect(normalizeScore100(9.7)).toBe(97);
    expect(normalizeScore100(97)).toBe(97);
    expect(normalizeScore100(0)).toBe(0);
    expect(normalizeScore100(null)).toBeNull();
  });

  it('skips vision evaluation when deterministic validation or runtime fails or screenshot is missing', () => {
    expect(visionSkipReasonFor({ validationPassed: false, runtimePassed: true, screenshotPresent: true })).toBe('deterministic_validation_fail');
    expect(visionSkipReasonFor({ validationPassed: true, runtimePassed: false, screenshotPresent: true })).toBe('runtime_fail');
    expect(visionSkipReasonFor({ validationPassed: true, runtimePassed: true, screenshotPresent: false })).toBe('missing_screenshot');
    expect(visionSkipReasonFor({ validationPassed: true, runtimePassed: true, screenshotPresent: true })).toBeNull();
  });

  it('blends vision score into rankScore with lower weight when available', () => {
    expect(rankScore(90, 50)).toBe(82);
    expect(rankScore(90, 50, 80)).toBe(81);
    expect(rankScore(90, 50, null)).toBe(82);
  });

  it('normalizes vision scores from 0-1, 0-10, and 0-100 scales', () => {
    expect(normalizeScore100(0.88)).toBe(88);
    expect(normalizeScore100(8.8)).toBe(88);
    expect(normalizeScore100(88)).toBe(88);
  });

  it('produces vision artifacts in dry-run without overriding deterministic pass/fail', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'df2-vision-'));
    const runtimeReport = { status: 'pass' as const, passed: true, runtimeHealthScore: 95, logs: [], errors: [], durationMs: 0, previewRef: 'runtime.preview.png' };
    await fs.writeFile(path.join(tmpDir, 'runtime.preview.png'), Buffer.from('fake-png'), 'utf8');

    const vision = await runVisionEvaluator('run-1', 'candidate-01', 1, 'p5', 'test prompt', tmpDir, true, runtimeReport, { baseUrl: 'dry', model: 'gpt-4o-mini' }, null, true, 'launch-ready');

    expect(vision.eligible).toBe(true);
    expect(vision.overallVisualScore).toBe(88);
    expect(vision.visualBand).toBe('launch_ready');
    expect(vision.visualFailureClass).toBe('none');

    const input = JSON.parse(await fs.readFile(path.join(tmpDir, 'vision.input.json'), 'utf8'));
    expect(input.schemaVersion).toBe('df2-vision-evaluator-input-v1');

    const final = JSON.parse(await fs.readFile(path.join(tmpDir, 'vision.final.json'), 'utf8'));
    expect(final.schemaVersion).toBe('df2-vision-eval-v1');
    expect(final.overallVisualScore).toBe(88);

    const raw = await fs.readFile(path.join(tmpDir, 'vision.primary.raw.txt'), 'utf8');
    expect(raw).toContain('launch_ready');

    // Deterministic pass/fail is independent: vision being present does not change runtime report
    expect(runtimeReport.passed).toBe(true);
    expect(runtimeReport.status).toBe('pass');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('produces deterministic skip vision artifact when screenshot is missing', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'df2-vision-skip-'));
    const runtimeReport = { status: 'pass' as const, passed: true, runtimeHealthScore: 95, logs: [], errors: [], durationMs: 0 };

    const vision = await runVisionEvaluator('run-1', 'candidate-01', 1, 'p5', 'test prompt', tmpDir, true, runtimeReport, { baseUrl: 'dry', model: 'gpt-4o-mini' }, null, false, 'launch-ready');

    expect(vision.eligible).toBe(false);
    expect(vision.skipReason).toBe('missing_screenshot');
    expect(vision.overallVisualScore).toBeNull();

    const final = JSON.parse(await fs.readFile(path.join(tmpDir, 'vision.final.json'), 'utf8'));
    expect(final.skipReason).toBe('missing_screenshot');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
