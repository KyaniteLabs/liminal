import { describe, expect, it } from 'vitest';
import { CreativeIterationGate } from '../../../src/core/CreativeIterationGate.js';
import { Domain } from '../../../src/types/domains.js';

const gate = new CreativeIterationGate();

function decide(overrides: Partial<Parameters<CreativeIterationGate['decide']>[0]> = {}) {
  return gate.decide({
    iteration: 1,
    prompt: 'draw a luminous p5 sketch',
    score: 0.75,
    isComplete: true,
    maxIterations: 5,
    minQualityScore: 0.7,
    domainQualityThresholds: { ascii: 0.5, music: 0.5, visual: 0.6 },
    collabDomain: Domain.P5,
    disableIterationExtension: false,
    ...overrides,
  });
}

describe('CreativeIterationGate', () => {
  it('keeps the first iteration alive even below the quality threshold', () => {
    expect(decide({ iteration: 1, score: 0.2 }).shouldBreak).toBe(false);
  });

  it('breaks after the warmup when the domain quality threshold is not met', () => {
    const decision = decide({ iteration: 2, prompt: 'make ascii text art', score: 0.45 });

    expect(decision).toMatchObject({
      shouldBreak: true,
      completed: false,
      domain: 'ascii',
      qualityThreshold: 0.5,
    });
    expect(decision.reason).toContain('quality threshold not met');
  });

  it('stops when excellent quality is reached and the code is complete', () => {
    const decision = decide({ iteration: 1, score: 0.93, isComplete: true });

    expect(decision).toMatchObject({ shouldBreak: true, completed: true });
    expect(decision.reason).toContain('excellent quality achieved');
  });

  it('blocks degraded evaluator evidence even when the fallback score is excellent', () => {
    const decision = decide({
      iteration: 1,
      score: 0.99,
      isComplete: true,
      evaluationConfidence: 0,
      evaluationFailureClass: 'scorer',
    });

    expect(decision).toMatchObject({ shouldBreak: true, completed: false });
    expect(decision.reason).toContain('evaluation evidence degraded');
    expect(decision.reason).toContain('scorer');
  });

  it('continues instead of accepting excellent but incomplete code', () => {
    const decision = decide({ iteration: 1, score: 0.93, isComplete: false });

    expect(decision).toMatchObject({ shouldBreak: false, completed: false });
    expect(decision.logMessage).toContain('Code incomplete after iteration 1');
  });

  it('extends the creative loop budget at iteration three when work is not healthy', () => {
    const decision = decide({ iteration: 3, score: 0.65, isComplete: true, maxIterations: 5, minQualityScore: 0.6 });

    expect(decision).toMatchObject({
      shouldBreak: false,
      completed: false,
      maxIterations: 8,
      thought: 'Extending to 8 iterations to improve quality...',
    });
    expect(decision.logMessage).toContain('Extending max iterations to 8');
  });

  it('does not extend when iteration extension is disabled', () => {
    const decision = decide({
      iteration: 3,
      score: 0.65,
      isComplete: true,
      maxIterations: 5,
      minQualityScore: 0.6,
      disableIterationExtension: true,
    });

    expect(decision.maxIterations).toBe(5);
    expect(decision.logMessage).toBeUndefined();
  });
});
