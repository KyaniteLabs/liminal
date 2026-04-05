import { describe, it, expect } from 'vitest';
import {
  EvaluationMemoBuilder,
  formatMemo,
  summarizeMemos,
} from '../../../src/collab/EvaluationMemo.js';

describe('EvaluationMemo', () => {
  it('builds a valid memo with fluent API', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('Test Review')
      .setBrief('A quick evaluation')
      .addSection('Quality', 'Good quality', 'high')
      .setVerdict('approve', 0.85)
      .setGeneratedBy('test-agent')
      .build();

    expect(memo.title).toBe('Test Review');
    expect(memo.brief).toBe('A quick evaluation');
    expect(memo.sections).toHaveLength(1);
    expect(memo.finalVerdict).toBe('approve');
    expect(memo.score).toBe(0.85);
    expect(memo.generatedBy).toBe('test-agent');
    expect(memo.id).toMatch(/^memo-/);
  });

  it('throws if required fields are missing', () => {
    expect(() => new EvaluationMemoBuilder().build()).toThrow(/requires a title/);
  });

  it('throws if score is out of range', () => {
    expect(() =>
      new EvaluationMemoBuilder()
        .setTitle('X').setBrief('B').setVerdict('approve', 1.5).setGeneratedBy('a')
        .build(),
    ).toThrow(/between 0 and 1/);
  });

  it('formats memo as markdown', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('MD Test').setBrief('Brief')
      .setVerdict('reject', 0.3).setGeneratedBy('bot')
      .build();
    const md = formatMemo(memo);
    expect(md).toContain('# MD Test');
    expect(md).toContain('REJECT');
  });

  it('summarizes an array of memos', () => {
    const makeMemo = (verdict: 'approve' | 'revise', score: number) =>
      new EvaluationMemoBuilder()
        .setTitle('T').setBrief('B').setVerdict(verdict, score).setGeneratedBy('a')
        .build();
    const summary = summarizeMemos([makeMemo('approve', 0.9), makeMemo('revise', 0.4)]);
    expect(summary.totalEvaluations).toBe(2);
    expect(summary.approveRate).toBe(0.5);
    expect(summary.avgScore).toBeCloseTo(0.65, 5);
  });

  it('returns empty summary for no memos', () => {
    const summary = summarizeMemos([]);
    expect(summary.totalEvaluations).toBe(0);
    expect(summary.commonIssues).toEqual([]);
  });
});
