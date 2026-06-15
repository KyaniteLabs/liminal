/**
 * B5 + B13 feed-forward regression — corrective signals computed at the END of
 * iteration N must survive into the prompt context that BUILDS iteration N+1.
 *
 * The only path from "iteration N output" to "iteration N+1 prompt" is
 * ContextAccumulation → buildContextForInjection, which reads `evaluation.issues`
 * (rendered as "Issues to address:") into the next prompt. It NEVER reads
 * `usedPrompt` from history. So a signal saved only to `usedPrompt` is dropped.
 *
 * B5: the aesthetic-model hint was appended to `usedPrompt` (a per-iteration
 *     variable rebuilt from scratch) → dead. RalphLoop now persists it through
 *     ContextAccumulation so buildContextForInjection injects it.
 * B13: StagnationDetector saved the full corrective `improvementSpec` only to
 *     `usedPrompt` and just the one-line description to `evaluation.issues`, so
 *     the designed `suggestedAction` never reached the next prompt. It now lands
 *     in `evaluation.issues`.
 *
 * These tests assert the concrete signal TEXT reaches buildContextForInjection's
 * output — i.e. it survives the save→load round-trip into the next-iteration
 * prompt context. They drive the SAME save shapes RalphLoop/StagnationDetector
 * now write.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildContextForInjection } from '../../../src/core/ContextBuilder.js';
import { ContextAccumulation } from '../../../src/core/ContextAccumulation.js';
import { StagnationDetector } from '../../../src/core/StagnationDetector.js';

describe('B5 — aesthetic-model hint survives into the next-iteration prompt context', () => {
  beforeEach(() => ContextAccumulation.clear());
  afterEach(() => ContextAccumulation.clear());

  // The concrete hint string EvolutionIntegration emits for a low-quality region.
  const AESTHETIC_HINT =
    'Aesthetic model hint: This behavior region has produced low-quality outputs in the past. Try a significantly different approach.';

  it('injects the aesthetic hint text into iteration N+1 when persisted via ContextAccumulation', () => {
    // Iteration N produced an artifact (the normal per-iteration save).
    ContextAccumulation.save({
      iteration: 1,
      prompt: 'make a calm scene',
      usedPrompt: 'make a calm scene (used)',
      code: 'function setup(){} function draw(){}',
      evaluation: { score: 0.6, issues: [] },
      timestamp: new Date().toISOString(),
      maxIterations: 5,
    });

    // RalphLoop's B5 wiring: persist the aesthetic hint into history so it feeds
    // forward (mirrors the fractional-iteration save the loop now performs).
    ContextAccumulation.save({
      iteration: 1.2,
      prompt: 'make a calm scene',
      usedPrompt: '',
      code: '',
      evaluation: { score: 0, issues: [AESTHETIC_HINT], aestheticModelHint: AESTHETIC_HINT },
      timestamp: new Date().toISOString(),
      maxIterations: 5,
    });

    const context = buildContextForInjection(2, { maxIterations: 5 });
    expect(context).toContain('significantly different approach');
    expect(context).toContain(AESTHETIC_HINT);
  });

  it('does NOT contain the hint when it was only written to usedPrompt (the old dead path)', () => {
    // Reproduce the OLD behavior: hint lives only in usedPrompt, never in issues.
    ContextAccumulation.save({
      iteration: 1,
      prompt: 'make a calm scene',
      usedPrompt: 'make a calm scene\n' + AESTHETIC_HINT,
      code: 'function setup(){} function draw(){}',
      evaluation: { score: 0.6, issues: [] },
      timestamp: new Date().toISOString(),
      maxIterations: 5,
    });

    const context = buildContextForInjection(2, { maxIterations: 5 });
    // buildContextForInjection never reads usedPrompt from history → hint is lost.
    expect(context).not.toContain(AESTHETIC_HINT);
  });
});

describe('B13 — stagnation suggestedAction reaches the next-iteration prompt context', () => {
  beforeEach(() => ContextAccumulation.clear());
  afterEach(() => ContextAccumulation.clear());

  it('injects the full corrective spec (suggestedAction) into buildContextForInjection output', () => {
    // Threshold 10 so by the time stagnation triggers, SelfReflection has the
    // 10-trend window it needs to detect a plateau and produce an improvement spec.
    const detector = new StagnationDetector(10);

    // bestScore set on the first call (0.9), then a flat run of low scores: the
    // last-10 window is all 0.5 → variance 0 → plateau detected, and the loop has
    // gone `threshold` iterations with no improvement.
    const FLAT = 0.5;
    const prompt = 'evolving fractal bloom';
    let result = detector.check(1, 0.9, 0, prompt, 'p5'); // sets bestScore = 0.9
    for (let i = 2; i <= 11; i++) {
      result = detector.check(i, FLAT, 0, prompt, 'p5');
    }

    // Exactly one improvement context (fractional iteration) was saved on the
    // threshold iteration — the detector gave the loop one more chance.
    const history = ContextAccumulation.getHistory();
    const improvementEntries = history.filter((h) => !Number.isInteger(h.iteration));
    expect(improvementEntries.length).toBe(1);

    // The saved corrective context carries the FULL spec (ACTION REQUIRED + the
    // suggestedAction), not just the terse one-line description.
    const spec = improvementEntries[0];
    const issuesJoined = spec.evaluation.issues.join(' ');
    expect(issuesJoined).toContain('ACTION REQUIRED');
    expect((spec.evaluation as { suggestedAction?: string }).suggestedAction).toContain(
      'novel techniques',
    );

    // And it reaches the NEXT prompt context (the feed-forward that matters):
    // buildContextForInjection renders evaluation.issues into "Issues to address".
    const nextContext = buildContextForInjection(12, { maxIterations: 20 });
    expect(nextContext).toContain('ACTION REQUIRED');
    expect(nextContext).toContain('novel techniques');
    // result is consumed so the loop continues (it gave the loop one more chance).
    expect(result.shouldBreak).toBe(false);
  });
});
