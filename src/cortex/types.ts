/**
 * Cortex types — Phase 13
 *
 * Type definitions for the background executive autonomy system.
 * Includes forward-looking types for all 5 increments.
 */

// ── Increment 1: Perception ──

export interface TaskPipelineSummary {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
  acceptanceRate: number;
  failureBreakdown: Record<string, number>;
}

export interface LLMHealthSummary {
  avgLatencyMs: number;
  successRate: number;
  recentErrorCount: number;
  lastError: string | null;
  activeProvider: string | null;
  activeModel: string | null;
}

export interface ScoreTrend {
  scores: number[];
  average: number;
  count: number;
}

export interface ActiveProcess {
  name: string;
  startedAt: string;
  stage?: string;
}

export interface CortexSnapshot {
  timestamp: string;
  taskPipeline: TaskPipelineSummary;
  llmHealth: LLMHealthSummary;
  scoreTrend: ScoreTrend;
  activeProcesses: ActiveProcess[];
  eventsProcessed: number;
}

// ── Increment 2: Goals ──

export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';
export type GoalCategory = 'coverage' | 'performance' | 'reliability' | 'feature' | 'maintenance';
export type GoalStatus = 'active' | 'completed' | 'dropped';

export interface CortexGoal {
  id: string;
  text: string;
  priority: GoalPriority;
  category: GoalCategory;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Increment 3: Priority & Actions ──

export type CortexActionType =
  | 'improve-coverage'
  | 'fix-flaky-test'
  | 'reduce-latency'
  | 'resolve-stuck-worker'
  | 'increase-score'
  | 'custom';

export interface RankedAction {
  actionType: CortexActionType;
  score: number;
  reasoning: string;
  goalIds: string[];
  urgency: number;
}

export interface BudgetUsage {
  actionsTaken: number;
  actionsLimit: number;
  tokenEstimate: number;
  tokenLimit: number;
}

export interface CortexConfig {
  loopIntervalMs: number;
  maxConsecutiveFailures: number;
  budgetActionsLimit: number;
  budgetTokenLimit: number;
  autonomyLevel: 'assist' | 'co-create' | 'autopilot';
}

// ── Increment 4: Supervision ──

export interface ActiveLease {
  actionId: string;
  startedAt: string;
  deadlineMs: number;
  description: string;
}

export interface StuckWorker {
  processName: string;
  durationMs: number;
  thresholdMs: number;
  suggestedRecovery: string;
}
