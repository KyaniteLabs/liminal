import { describe, it, expect } from 'vitest';
import { PriorityAllocator } from '../../../src/cortex/PriorityAllocator.js';
import type { CortexSnapshot, CortexGoal } from '../../../src/cortex/types.js';

function makeSnapshot(overrides: Partial<CortexSnapshot> = {}): CortexSnapshot {
  return {
    taskPipeline: {
      acceptanceRate: 0.8,
      failed: 0,
      total: 10,
      failureBreakdown: {},
    },
    llmHealth: {
      avgLatencyMs: 500,
      successRate: 0.95,
      totalCalls: 100,
    },
    scoreTrend: {
      scores: [0.7, 0.75, 0.8],
      average: 0.75,
    },
    activeProcesses: [],
    ...overrides,
  } as CortexSnapshot;
}

function makeGoal(overrides: Partial<CortexGoal> = {}): CortexGoal {
  return {
    id: 'goal-1',
    text: 'improve test coverage',
    category: 'coverage',
    priority: 'high',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('PriorityAllocator', () => {
  it('returns empty array when no weaknesses detected', () => {
    const allocator = new PriorityAllocator();
    const result = allocator.rank(makeSnapshot(), []);
    expect(result).toEqual([]);
  });

  it('detects low acceptance rate weakness', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      taskPipeline: { acceptanceRate: 0.3, failed: 0, total: 10, failureBreakdown: {} },
    });
    const result = allocator.rank(snapshot, []);
    expect(result.some(r => r.actionType === 'improve-coverage')).toBe(true);
    expect(result.find(r => r.actionType === 'improve-coverage')!.reasoning).toContain('30%');
  });

  it('detects too many failed tasks', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      taskPipeline: { acceptanceRate: 0.9, failed: 5, total: 10, failureBreakdown: { timeout: 3, error: 2 } },
    });
    const result = allocator.rank(snapshot, []);
    expect(result.some(r => r.actionType === 'fix-flaky-test')).toBe(true);
  });

  it('detects high LLM latency', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      llmHealth: { avgLatencyMs: 5000, successRate: 0.9, totalCalls: 50 },
    });
    const result = allocator.rank(snapshot, []);
    expect(result.some(r => r.actionType === 'reduce-latency')).toBe(true);
  });

  it('detects stuck workers', () => {
    const allocator = new PriorityAllocator();
    const startedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const snapshot = makeSnapshot({
      activeProcesses: [{ name: 'worker-1', startedAt, pid: 123 }],
    });
    const result = allocator.rank(snapshot, []);
    expect(result.some(r => r.actionType === 'resolve-stuck-worker')).toBe(true);
  });

  it('detects declining score trend', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      scoreTrend: { scores: [0.8, 0.6, 0.4], average: 0.5 },
    });
    const result = allocator.rank(snapshot, []);
    expect(result.some(r => r.actionType === 'increase-score')).toBe(true);
  });

  it('sorts actions by score descending', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      taskPipeline: { acceptanceRate: 0.2, failed: 5, total: 10, failureBreakdown: { err: 5 } },
      llmHealth: { avgLatencyMs: 8000, successRate: 0.5, totalCalls: 10 },
    });
    const result = allocator.rank(snapshot, []);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('aligns with matching goals', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      taskPipeline: { acceptanceRate: 0.3, failed: 0, total: 10, failureBreakdown: {} },
    });
    const goals = [makeGoal({ text: 'improve test coverage', category: 'coverage' })];
    const result = allocator.rank(snapshot, goals);
    const coverage = result.find(r => r.actionType === 'improve-coverage');
    expect(coverage).toBeDefined();
    expect(coverage!.goalIds).toContain('goal-1');
  });

  it('returns empty goals array when no goals match', () => {
    const allocator = new PriorityAllocator();
    const snapshot = makeSnapshot({
      taskPipeline: { acceptanceRate: 0.3, failed: 0, total: 10, failureBreakdown: {} },
    });
    const goals = [makeGoal({ text: 'unrelated goal', category: 'design' })];
    const result = allocator.rank(snapshot, goals);
    const coverage = result.find(r => r.actionType === 'improve-coverage');
    expect(coverage!.goalIds).toEqual([]);
  });
});
