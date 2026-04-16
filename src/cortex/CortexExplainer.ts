/**
 * CortexExplainer — Phase 13, Increment 5
 *
 * Generates human-readable explanations for Cortex state:
 * decisions, snapshots, stuck workers, goals, and the
 * full dashboard panel rendered by the TUI on Ctrl+X.
 */

import type {
  CortexSnapshot,
  CortexGoal,
  BudgetUsage,
  StuckWorker,
} from './types.js';
import type { ActionProposal } from './ActionProposer.js';

export interface DashboardData {
  snapshot: CortexSnapshot;
  goals: CortexGoal[];
  budget: BudgetUsage;
  stuckWorkers: StuckWorker[];
  latestDecisions: ActionProposal[];
  tickNumber: number;
  autonomyLevel: string;
}

export class CortexExplainer {
  /**
   * Explain a single Cortex decision in human-readable form.
   * Example: "Prioritized auth coverage because: goal '80% coverage' + 3 recent auth failures"
   */
  explainDecision(proposal: ActionProposal): string {
    const parts: string[] = [];

    if (proposal.reviewRequired) {
      parts.push('[REVIEW]');
    } else {
      parts.push('[AUTO]');
    }

    parts.push(proposal.actionType);
    parts.push(`score=${proposal.score.toFixed(2)}`);

    if (proposal.goalIds.length > 0) {
      parts.push(`goals=[${proposal.goalIds.join(',')}]`);
    }

    if (proposal.reasoning) {
      parts.push(`— ${proposal.reasoning}`);
    }

    return parts.join(' ');
  }

  /**
   * Explain a CortexSnapshot as a one-line health summary.
   * Example: "12 pending | 3 active | 89% accept | 1.2s avg | 0.75 score"
   */
  explainSnapshot(snapshot: CortexSnapshot): string {
    const pipeline = snapshot.taskPipeline;
    const pending = pipeline.pending + pipeline.inProgress;
    const acceptPct = Math.round(pipeline.acceptanceRate * 100);
    const latency = snapshot.llmHealth.avgLatencyMs >= 1000
      ? `${(snapshot.llmHealth.avgLatencyMs / 1000).toFixed(1)}s`
      : `${Math.round(snapshot.llmHealth.avgLatencyMs)}ms`;
    const score = snapshot.scoreTrend.average.toFixed(2);

    return [
      `${pending} pending`,
      `${pipeline.completed} done`,
      `${acceptPct}% accept`,
      `${latency} avg`,
      `${score} score`,
    ].join(' | ');
  }

  /**
   * Format the full Cortex dashboard as a multi-line string.
   * This is what appears in the operator surface when Ctrl+X is toggled.
   */
  formatDashboard(data: DashboardData): string {
    const lines: string[] = [];

    // Header line
    lines.push(`Cortex Dashboard — tick #${data.tickNumber} | autonomy: ${data.autonomyLevel}`);

    // Health summary
    lines.push('');
    lines.push(`Health: ${this.explainSnapshot(data.snapshot)}`);

    // Budget bar
    lines.push('');
    const budgetLine = this.formatBudget(data.budget);
    lines.push(`Budget: ${budgetLine}`);

    // Goals section
    if (data.goals.length > 0) {
      lines.push('');
      lines.push('Goals:');
      for (const g of data.goals) {
        const marker = g.priority === 'critical' ? '!!' : g.priority === 'high' ? ' !' : '  ';
        lines.push(`  ${marker} ${g.text} [${g.category}]`);
      }
    }

    // Latest decisions
    if (data.latestDecisions.length > 0) {
      lines.push('');
      lines.push('Recent decisions:');
      const recent = data.latestDecisions.slice(-5);
      for (const d of recent) {
        lines.push(`  ${this.explainDecision(d)}`);
      }
    }

    // Stuck workers
    if (data.stuckWorkers.length > 0) {
      lines.push('');
      lines.push(`WARNING — ${data.stuckWorkers.length} stuck worker(s):`);
      for (const sw of data.stuckWorkers) {
        const dur = sw.durationMs >= 60000
          ? `${(sw.durationMs / 60000).toFixed(1)}m`
          : `${(sw.durationMs / 1000).toFixed(0)}s`;
        lines.push(`  ${sw.processName}: ${dur} over threshold — ${sw.suggestedRecovery}`);
      }
    }

    // LLM health detail
    const llm = data.snapshot.llmHealth;
    if (llm.recentErrorCount > 0) {
      lines.push('');
      lines.push(`LLM: ${llm.recentErrorCount} recent error(s) | provider: ${llm.activeProvider ?? 'unknown'}`);
      if (llm.lastError) {
        lines.push(`  Last error: ${llm.lastError}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format budget usage as a visual bar.
   * Example: "████████░░ 4/10 actions | 8000/50000 tokens"
   */
  formatBudget(budget: BudgetUsage): string {
    const barWidth = 20;
    const actionPct = budget.actionsLimit > 0
      ? budget.actionsTaken / budget.actionsLimit
      : 0;
    const filled = Math.round(actionPct * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

    return `${bar} ${budget.actionsTaken}/${budget.actionsLimit} actions | ${budget.tokenEstimate}/${budget.tokenLimit} tokens`;
  }
}
