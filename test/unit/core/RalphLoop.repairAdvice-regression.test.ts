import { describe, it, expect } from 'vitest';
import { GeneratorHarnessTools } from '../../../src/generators/GeneratorHarnessTools.js';
import type { GenerationEvaluation } from '../../../src/core/types/GenerationEvaluation.js';

/**
 * Regression test for repairAdvice dropout bug in RalphLoop.ts.
 *
 * Bug: In the multi-candidate evaluation phase (line 727), code re-declared:
 *   const bestCandidate = candidates.find(c => c.code === currentCode)
 * This shadowed the outer bestCandidate (set by winner index from rankCandidates).
 * When two candidates produce identical code but have different scores/repairAdvice,
 * find() always returned the first match (index 0), discarding the actual winner.
 *
 * Fix: Track winnerIndex in outer scope and use candidates[winnerIndex] in the
 * evaluation phase, eliminating the fragile code-content re-lookup.
 *
 * This test validates the core mechanism: rankCandidates picks the correct winner
 * by index, and the evaluation data is then correctly extracted from that winner.
 */

function makeSeededRng(): () => number {
  const values = [0.1, 0.5, 0.9, 0.3, 0.7];
  let idx = 0;
  return () => values[idx++ % values.length];
}

describe('RalphLoop repairAdvice regression — winner by index', () => {
  const tools = new GeneratorHarnessTools({ seededRandom: makeSeededRng() });

  it('rankCandidates selects the highest-scoring candidate as winner', () => {
    const codes = [
      'function setup() { createCanvas(400,400); } function draw() { background(0); }',
      'function setup() { createCanvas(400,400); } function draw() { background(0); }',
    ];

    // Candidate 1 has higher score — should win despite identical code
    const evaluations: GenerationEvaluation[] = [
      { score: 0.4, confidence: 0.8, failureClass: 'none' },
      { score: 0.9, confidence: 0.95, failureClass: 'none', repairAdvice: { issue: 'Missing fill', fix: 'Add fill() call', constraint: 'Must have visible shapes' } },
    ];

    const result = tools.rankCandidates(codes, evaluations);

    expect(result.winnerIndex).toBe(1);
  });

  it('extracts repairAdvice from the correct winner by index, not by code lookup', () => {
    // Simulate the scenario: two candidates with identical code
    const candidates = [
      { code: 'function setup(){createCanvas(400,400)}function draw(){background(0)}', score: 0.4, issues: ['Low candidate issue'], index: 0, genEval: { score: 0.4, confidence: 0.8, failureClass: 'none', repairAdvice: { issue: 'Loser issue', fix: 'Loser fix', constraint: 'Loser constraint' } } as GenerationEvaluation },
      { code: 'function setup(){createCanvas(400,400)}function draw(){background(0)}', score: 0.9, issues: ['Winner issue'], index: 1, genEval: { score: 0.9, confidence: 0.95, failureClass: 'none', repairAdvice: { issue: 'Winner issue', fix: 'Winner fix', constraint: 'Winner constraint' } } as GenerationEvaluation },
    ];

    // rankCandidates should pick index 1 as winner
    const evaluations = candidates.map(c => c.genEval!);
    const { winnerIndex } = tools.rankCandidates(
      candidates.map(c => c.code),
      evaluations,
    );

    expect(winnerIndex).toBe(1);

    // The fix: use candidates[winnerIndex] instead of candidates.find(c => c.code === currentCode)
    const winner = candidates[winnerIndex];

    // Before fix: find(c => c.code === currentCode) would return candidates[0] (first match)
    // because both have identical code. This would give wrong repairAdvice.
    // After fix: candidates[winnerIndex] returns candidates[1] — the actual winner.
    expect(winner.genEval?.repairAdvice?.issue).toBe('Winner issue');
    expect(winner.genEval?.repairAdvice?.fix).toBe('Winner fix');
    expect(winner.genEval?.repairAdvice?.constraint).toBe('Winner constraint');
    expect(winner.score).toBe(0.9);
  });

  it('candidates.find() would have returned the wrong candidate (demonstrating the bug)', () => {
    const candidates = [
      { code: 'identical_code', score: 0.3, index: 0, genEval: { score: 0.3, confidence: 0.5, failureClass: 'none', repairAdvice: { issue: 'WRONG', fix: 'WRONG', constraint: 'WRONG' } } as GenerationEvaluation },
      { code: 'identical_code', score: 0.95, index: 1, genEval: { score: 0.95, confidence: 0.9, failureClass: 'none', repairAdvice: { issue: 'CORRECT', fix: 'CORRECT', constraint: 'CORRECT' } } as GenerationEvaluation },
    ];

    // The old buggy code: const bestCandidate = candidates.find(c => c.code === currentCode)
    // currentCode === candidates[1].code (winner), but find returns first match:
    const buggyResult = candidates.find(c => c.code === 'identical_code');
    expect(buggyResult!.index).toBe(0); // Wrong! Returns loser
    expect(buggyResult!.genEval?.repairAdvice?.issue).toBe('WRONG');

    // The fix: use winnerIndex directly
    const evaluations = candidates.map(c => c.genEval!);
    const { winnerIndex } = tools.rankCandidates(candidates.map(c => c.code), evaluations);
    expect(winnerIndex).toBe(1);
    const fixedResult = candidates[winnerIndex];
    expect(fixedResult.genEval?.repairAdvice?.issue).toBe('CORRECT');
  });
});
