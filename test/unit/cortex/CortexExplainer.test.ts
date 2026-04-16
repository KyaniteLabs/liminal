import { describe, it, expect } from 'vitest';
import { CortexExplainer } from '../../../src/cortex/CortexExplainer.js';
import type { DashboardData } from '../../../src/cortex/CortexExplainer.js';
import type { CortexSnapshot, CortexGoal, BudgetUsage, StuckWorker } from '../../../src/cortex/types.js';
import type { ActionProposal } from '../../../src/cortex/ActionProposer.js';

function mkSnapshot(o: Partial<CortexSnapshot> = {}): CortexSnapshot {
  return {
    timestamp: new Date().toISOString(),
    taskPipeline: { pending: 2, inProgress: 3, completed: 50, failed: 1, skipped: 0, acceptanceRate: 0.95, failureBreakdown: {} },
    llmHealth: { avgLatencyMs: 450, successRate: 0.97, recentErrorCount: 0, lastError: null, activeProvider: 'openai', activeModel: 'gpt-4' },
    scoreTrend: { scores: [0.7, 0.75, 0.8], average: 0.75, count: 3 },
    activeProcesses: [],
    eventsProcessed: 100,
    ...o,
  };
}

function mkGoal(o: Partial<CortexGoal> = {}): CortexGoal {
  return {
    id: 'g1', text: 'Fix test coverage above 80%', priority: 'high', category: 'coverage',
    status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    ...o,
  };
}

function mkProposal(o: Partial<ActionProposal> = {}): ActionProposal {
  return {
    actionType: 'improve-coverage', score: 0.85, reasoning: 'Low coverage detected',
    goalIds: ['g1'], urgency: 0.7, reviewRequired: false, estimatedTokens: 2000,
    ...o,
  };
}

function mkBudget(o: Partial<BudgetUsage> = {}): BudgetUsage {
  return { actionsTaken: 4, actionsLimit: 10, tokenEstimate: 8000, tokenLimit: 50000, ...o };
}

function mkDashboard(o: Partial<DashboardData> = {}): DashboardData {
  return {
    snapshot: mkSnapshot(),
    goals: [],
    budget: mkBudget(),
    stuckWorkers: [],
    latestDecisions: [],
    tickNumber: 42,
    autonomyLevel: 'assist',
    ...o,
  };
}

describe('CortexExplainer', () => {
  const explainer = new CortexExplainer();

  // ── explainDecision ──

  it('explains a review-required decision', () => {
    const proposal = mkProposal({ reviewRequired: true });
    const result = explainer.explainDecision(proposal);
    expect(result).toContain('[REVIEW]');
    expect(result).toContain('improve-coverage');
    expect(result).toContain('score=0.85');
    expect(result).toContain('Low coverage detected');
  });

  it('explains an auto decision', () => {
    const proposal = mkProposal({ reviewRequired: false });
    const result = explainer.explainDecision(proposal);
    expect(result).toContain('[AUTO]');
    expect(result).not.toContain('[REVIEW]');
  });

  it('includes goal IDs when present', () => {
    const proposal = mkProposal({ goalIds: ['g1', 'g2'] });
    const result = explainer.explainDecision(proposal);
    expect(result).toContain('goals=[g1,g2]');
  });

  it('omits goals when empty', () => {
    const proposal = mkProposal({ goalIds: [] });
    const result = explainer.explainDecision(proposal);
    expect(result).not.toContain('goals=');
  });

  // ── explainSnapshot ──

  it('formats a one-line health summary', () => {
    const snapshot = mkSnapshot();
    const result = explainer.explainSnapshot(snapshot);
    // pending=5 (2+3), done=50, accept=95%, latency=450ms, score=0.75
    expect(result).toContain('5 pending');
    expect(result).toContain('50 done');
    expect(result).toContain('95% accept');
    expect(result).toContain('450ms avg');
    expect(result).toContain('0.75 score');
  });

  it('formats latency in seconds when >= 1000ms', () => {
    const snapshot = mkSnapshot({
      llmHealth: { avgLatencyMs: 2500, successRate: 0.9, recentErrorCount: 0, lastError: null, activeProvider: 'openai', activeModel: 'gpt-4' },
    });
    const result = explainer.explainSnapshot(snapshot);
    expect(result).toContain('2.5s avg');
  });

  it('rounds acceptance rate to whole percent', () => {
    const snapshot = mkSnapshot({
      taskPipeline: { pending: 0, inProgress: 0, completed: 10, failed: 1, skipped: 0, acceptanceRate: 0.909, failureBreakdown: {} },
    });
    const result = explainer.explainSnapshot(snapshot);
    expect(result).toContain('91% accept');
  });

  // ── formatBudget ──

  it('renders a visual budget bar', () => {
    const budget = mkBudget();
    const result = explainer.formatBudget(budget);
    expect(result).toContain('4/10 actions');
    expect(result).toContain('8000/50000 tokens');
    expect(result).toContain('█');
    expect(result).toContain('░');
  });

  it('handles zero budget limit', () => {
    const budget = mkBudget({ actionsTaken: 0, actionsLimit: 0 });
    const result = explainer.formatBudget(budget);
    expect(result).toContain('0/0 actions');
  });

  it('fills bar proportionally', () => {
    const budget = mkBudget({ actionsTaken: 5, actionsLimit: 10 });
    const result = explainer.formatBudget(budget);
    // 50% of 20 chars = 10 filled, 10 empty
    const barPart = result.split(' ')[0];
    const filled = (barPart.match(/█/g) || []).length;
    const empty = (barPart.match(/░/g) || []).length;
    expect(filled).toBe(10);
    expect(empty).toBe(10);
  });

  // ── formatDashboard ──

  it('renders a full dashboard with all sections', () => {
    const data = mkDashboard({
      goals: [mkGoal()],
      latestDecisions: [mkProposal()],
      stuckWorkers: [
        { processName: 'Generate particles', durationMs: 180_000, thresholdMs: 120_000, suggestedRecovery: 'Retry the leaf task with fresh inputs' } satisfies StuckWorker,
      ],
    });
    const result = explainer.formatDashboard(data);

    // Header
    expect(result).toContain('Cortex Dashboard');
    expect(result).toContain('tick #42');
    expect(result).toContain('autonomy: assist');

    // Health
    expect(result).toContain('Health:');

    // Budget
    expect(result).toContain('Budget:');

    // Goals
    expect(result).toContain('Goals:');
    expect(result).toContain('Fix test coverage above 80%');
    expect(result).toContain('[coverage]');

    // Decisions
    expect(result).toContain('Recent decisions:');
    expect(result).toContain('improve-coverage');

    // Stuck workers
    expect(result).toContain('WARNING — 1 stuck worker(s)');
    expect(result).toContain('Generate particles');
    expect(result).toContain('3.0m');
    expect(result).toContain('Retry the leaf task');
  });

  it('renders minimal dashboard when empty', () => {
    const data = mkDashboard();
    const result = explainer.formatDashboard(data);

    expect(result).toContain('Cortex Dashboard');
    expect(result).toContain('Health:');
    expect(result).toContain('Budget:');
    expect(result).not.toContain('Goals:');
    expect(result).not.toContain('Recent decisions:');
    expect(result).not.toContain('WARNING');
  });

  it('shows goal priority markers', () => {
    const data = mkDashboard({
      goals: [
        mkGoal({ priority: 'critical', text: 'Fix prod outage' }),
        mkGoal({ id: 'g2', priority: 'high', text: 'Reach 80% coverage' }),
        mkGoal({ id: 'g3', priority: 'normal', text: 'Refactor utils' }),
      ],
    });
    const result = explainer.formatDashboard(data);
    expect(result).toContain('!! Fix prod outage');
    expect(result).toContain(' ! Reach 80% coverage');
    expect(result).toContain('   Refactor utils');
  });

  it('caps recent decisions to last 5', () => {
    const decisions = Array.from({ length: 8 }, (_, i) =>
      mkProposal({ actionType: 'custom', score: 0.1 * (i + 1), reasoning: `Decision ${i + 1}` }),
    );
    const data = mkDashboard({ latestDecisions: decisions });
    const result = explainer.formatDashboard(data);

    // Should include last 5 decisions (4-8) but not first 3
    expect(result).toContain('Decision 8');
    expect(result).toContain('Decision 4');
    expect(result).not.toContain('Decision 3');
    expect(result).not.toContain('Decision 1');
  });

  it('shows LLM errors when present', () => {
    const data = mkDashboard({
      snapshot: mkSnapshot({
        llmHealth: {
          avgLatencyMs: 500, successRate: 0.8, recentErrorCount: 3,
          lastError: 'Rate limit exceeded', activeProvider: 'anthropic', activeModel: 'claude-3',
        },
      }),
    });
    const result = explainer.formatDashboard(data);
    expect(result).toContain('3 recent error(s)');
    expect(result).toContain('provider: anthropic');
    expect(result).toContain('Rate limit exceeded');
  });

  it('does not show LLM errors when count is zero', () => {
    const data = mkDashboard();
    const result = explainer.formatDashboard(data);
    expect(result).not.toContain('recent error');
  });

  it('formats stuck worker duration in seconds when under 1 minute', () => {
    const data = mkDashboard({
      stuckWorkers: [
        { processName: 'Quick task', durationMs: 45_000, thresholdMs: 30_000, suggestedRecovery: 'Retry' } satisfies StuckWorker,
      ],
    });
    const result = explainer.formatDashboard(data);
    expect(result).toContain('45s');
    expect(result).not.toContain('0.8m');
  });
});
