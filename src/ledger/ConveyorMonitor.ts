/**
 * Phase 10 Lane 10-5: ConveyorMonitor — Dashboard and alert generation.
 *
 * Generates dashboards, alerts, and text reports from batch results.
 * Provides visibility into conveyor throughput, failure patterns, and coverage progress.
 */

import type { TaskLedger } from './TaskLedger.js';
import type { TaskClass, FailureClass, ConveyorBatchResult } from './types.js';

/** Alert severity levels */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** A single monitoring alert */
export interface MonitorAlert {
  severity: AlertSeverity;
  message: string;
  detail: string;
}

/** Full dashboard data structure */
export interface ConveyorDashboard {
  batchId: string;
  timestamp: string;
  summary: {
    attempted: number;
    accepted: number;
    failed: number;
    escalated: number;
    acceptanceRate: number;
  };
  byClass: Record<TaskClass, { attempted: number; accepted: number; failed: number; rate: number }>;
  failureBreakdown: Record<FailureClass, number>;
  coverageDelta: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  timing: {
    totalMs: number;
    avgPerTaskMs: number;
    byClass: Record<string, number>;
  };
  artifactCompleteness: string;
  alerts: MonitorAlert[];
}

export class ConveyorMonitor {
  constructor(private ledger: TaskLedger) {}

  /** Generate a full dashboard from batch results. */
  generateDashboard(result: ConveyorBatchResult): ConveyorDashboard {
    const allTasks = this.ledger.listTasks();

    // Compute by-class breakdown
    const byClass: Record<TaskClass, { attempted: number; accepted: number; failed: number; rate: number }> = {
      leaf: { attempted: 0, accepted: 0, failed: 0, rate: 0 },
      wiring: { attempted: 0, accepted: 0, failed: 0, rate: 0 },
      'harness-quality': { attempted: 0, accepted: 0, failed: 0, rate: 0 },
      orchestrator: { attempted: 0, accepted: 0, failed: 0, rate: 0 },
    };

    for (const r of result.results) {
      const task = allTasks.find(t => t.id === r.taskId);
      if (!task) continue;
      byClass[task.taskClass].attempted++;
      if (r.status === 'accepted') byClass[task.taskClass].accepted++;
      else byClass[task.taskClass].failed++;
    }

    // Compute rates
    for (const cls of Object.keys(byClass) as TaskClass[]) {
      byClass[cls].rate = byClass[cls].attempted > 0
        ? byClass[cls].accepted / byClass[cls].attempted
        : 0;
    }

    // Coverage delta
    const coverageDelta = {
      statements: result.coverageAfter.statements - result.coverageBefore.statements,
      branches: result.coverageAfter.branches - result.coverageBefore.branches,
      functions: result.coverageAfter.functions - result.coverageBefore.functions,
      lines: result.coverageAfter.lines - result.coverageBefore.lines,
    };

    // Timing
    const totalMs = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();
    const avgPerTaskMs = result.tasksAttempted > 0 ? totalMs / result.tasksAttempted : 0;

    const byClassTiming: Record<string, number> = {};
    for (const r of result.results) {
      const task = allTasks.find(t => t.id === r.taskId);
      if (task) {
        byClassTiming[task.taskClass] = (byClassTiming[task.taskClass] ?? 0) + r.durationMs;
      }
    }

    // Artifact completeness
    const acceptedResults = result.results.filter(r => r.status === 'accepted');
    const artifactCompleteness = acceptedResults.length > 0
      ? `${acceptedResults.length}/${result.tasksAttempted} (${(acceptedResults.length / result.tasksAttempted * 100).toFixed(0)}%)`
      : '0%';

    // Generate alerts
    const alerts = this.generateAlerts(result, byClass, coverageDelta);

    return {
      batchId: result.batchId,
      timestamp: new Date().toISOString(),
      summary: {
        attempted: result.tasksAttempted,
        accepted: result.tasksAccepted,
        failed: result.tasksFailed,
        escalated: result.tasksEscalated,
        acceptanceRate: result.acceptanceRate,
      },
      byClass,
      failureBreakdown: result.failureBreakdown,
      coverageDelta,
      timing: { totalMs, avgPerTaskMs, byClass: byClassTiming },
      artifactCompleteness,
      alerts,
    };
  }

  /** Format dashboard as a text report. */
  formatText(dashboard: ConveyorDashboard): string {
    const lines: string[] = [
      '',
      '═══════════════════════════════════════════════════════════════',
      `  Conveyor Dashboard — ${dashboard.batchId}`,
      `  Generated: ${dashboard.timestamp}`,
      '═══════════════════════════════════════════════════════════════',
      '',
      '  Summary:',
      `    Attempted:  ${dashboard.summary.attempted}`,
      `    Accepted:   ${dashboard.summary.accepted}`,
      `    Failed:     ${dashboard.summary.failed}`,
      `    Escalated:  ${dashboard.summary.escalated}`,
      `    Rate:       ${(dashboard.summary.acceptanceRate * 100).toFixed(1)}%`,
      '',
      '  By Class:',
    ];

    for (const [cls, data] of Object.entries(dashboard.byClass)) {
      if (data.attempted > 0) {
        lines.push(`    ${cls.padEnd(18)} ${data.attempted} attempted, ${data.accepted} accepted (${(data.rate * 100).toFixed(0)}%)`);
      }
    }

    // Failure breakdown
    const failures = Object.entries(dashboard.failureBreakdown).filter(([, v]) => v > 0);
    if (failures.length > 0) {
      lines.push('', '  Failure Breakdown:');
      for (const [cls, count] of failures) {
        lines.push(`    ${cls.padEnd(22)} ${count}`);
      }
    }

    // Coverage delta
    lines.push('', '  Coverage Delta:');
    lines.push(`    Statements:  ${dashboard.coverageDelta.statements >= 0 ? '+' : ''}${dashboard.coverageDelta.statements.toFixed(1)}pp`);
    lines.push(`    Branches:    ${dashboard.coverageDelta.branches >= 0 ? '+' : ''}${dashboard.coverageDelta.branches.toFixed(1)}pp`);
    lines.push(`    Functions:   ${dashboard.coverageDelta.functions >= 0 ? '+' : ''}${dashboard.coverageDelta.functions.toFixed(1)}pp`);
    lines.push(`    Lines:       ${dashboard.coverageDelta.lines >= 0 ? '+' : ''}${dashboard.coverageDelta.lines.toFixed(1)}pp`);

    // Timing
    lines.push('', '  Timing:');
    lines.push(`    Total:       ${dashboard.timing.totalMs}ms`);
    lines.push(`    Avg/task:    ${dashboard.timing.avgPerTaskMs.toFixed(0)}ms`);

    // Alerts
    if (dashboard.alerts.length > 0) {
      lines.push('', '  Alerts:');
      for (const alert of dashboard.alerts) {
        const icon = alert.severity === 'critical' ? '!!' : alert.severity === 'warning' ? '! ' : '   ';
        lines.push(`    [${icon}] ${alert.message}`);
        if (alert.detail) {
          lines.push(`         ${alert.detail}`);
        }
      }
    }

    lines.push('', '═══════════════════════════════════════════════════════════════');
    lines.push('');
    return lines.join('\n');
  }

  /** Generate alerts based on dashboard signals. */
  private generateAlerts(
    result: ConveyorBatchResult,
    byClass: Record<TaskClass, { attempted: number; accepted: number; rate: number }>,
    coverageDelta: { statements: number; branches: number; functions: number; lines: number },
  ): MonitorAlert[] {
    const alerts: MonitorAlert[] = [];

    // Critical: 0% success rate per class
    for (const [cls, data] of Object.entries(byClass)) {
      if (data.attempted > 0 && data.accepted === 0) {
        alerts.push({
          severity: 'critical',
          message: `0% acceptance rate for ${cls} tasks`,
          detail: `${data.attempted} tasks attempted, none accepted. Review task specs and scoring criteria.`,
        });
      }
    }

    // Critical: Coverage regression
    if (coverageDelta.statements < 0) {
      alerts.push({
        severity: 'critical',
        message: 'Coverage regression detected',
        detail: `Statement coverage decreased by ${Math.abs(coverageDelta.statements).toFixed(1)}pp.`,
      });
    }

    // Warning: Low overall acceptance rate
    if (result.tasksAttempted > 3 && result.acceptanceRate < 0.3) {
      alerts.push({
        severity: 'warning',
        message: `Low acceptance rate: ${(result.acceptanceRate * 100).toFixed(0)}%`,
        detail: 'Consider reviewing task quality or adjusting scoring thresholds.',
      });
    }

    // Warning: High escalation rate
    if (result.tasksEscalated > result.tasksAttempted * 0.3) {
      alerts.push({
        severity: 'warning',
        message: `High escalation rate: ${result.tasksEscalated}/${result.tasksAttempted}`,
        detail: 'Tasks are near-accepted but not passing. Review verify commands and scoring criteria alignment.',
      });
    }

    return alerts;
  }
}
