import type { CortexGoal, CortexSnapshot } from '../cortex/types.js';
import type { ActionProposal } from '../cortex/ActionProposer.js';
import type { BridgeRoleName, BridgeRoleStatus, BridgeVisionSupport } from './BridgeLauncherConfig.js';

export type TuiMode = 'chat' | 'inspect' | 'action' | 'confirm';

export interface TuiTrustState {
  level: 'untrusted' | 'review-required' | 'confirmed';
  label: string;
}

export interface TuiProvenance {
  provider?: string;
  model?: string;
  source: 'user' | 'assistant' | 'system' | 'tool' | 'generated-code';
  generatedCodeUntrusted?: boolean;
}

export interface TuiPendingAction {
  id: string;
  title: string;
  description: string;
  prompt?: string;
  route?: 'creative' | 'engineering' | 'hybrid' | 'operator';
  kind: 'structured' | 'llm';
  requiresConfirmation: true;
  createdAt: string;
}

export interface TuiSessionStatus {
  sessionId: string;
  mode: TuiMode;
  provider?: string;
  model?: string;
  roles?: Record<BridgeRoleName, BridgeRoleStatus>;
  evaluation?: {
    renderedEvidence: boolean;
    screenshotInput: boolean;
    multimodal: BridgeVisionSupport;
    note: string;
  };
  trust: TuiTrustState;
  activeTask?: string;
  pendingAction?: TuiPendingAction;
}

export interface TuiInputRequest {
  mode: TuiMode;
  text: string;
  clientIntent?: 'chat' | 'inspect' | 'action' | 'creative';
  executionMode?: 'draft' | 'prove';
  maxIterations?: number;
  candidateCount?: number;
  timeoutMinutes?: number;
  creativePreferences?: Record<string, unknown>;
  guidanceAnswers?: Record<string, unknown>;
}

export interface SwarmRoundEvent {
  round: number;
  totalRounds: number;
  vocabularySize: number;
  winner: string | null;
  converged: boolean;
  outputs: Record<string, unknown>;
  votes: Record<string, unknown>;
  timestamp: number;
}

export interface TuiGuidanceSuggestion {
  category: 'creative-preferences';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  optional: true;
  questions: string[];
}

export interface TuiFileChange {
  path: string;
  status: string;
  isLatest?: boolean;
}

export type TuiBridgeEvent =
  | { type: 'response.started'; sessionId: string }
  | { type: 'response.delta'; sessionId: string; delta: string }
  | { type: 'response.completed'; sessionId: string; content: string }
  | { type: 'response.committed'; sessionId: string; content: string }
  // Telemetry: emitted after every response with metadata
  | { type: 'response.metadata'; sessionId: string; model: string; duration: number; tokenCount?: number }
  | { type: 'mode.changed'; sessionId: string; mode: TuiMode }
  | { type: 'action.review_required'; sessionId: string; action: TuiPendingAction }
  | { type: 'action.confirmed'; sessionId: string; actionId: string }
  | { type: 'action.cancelled'; sessionId: string; actionId: string }
  | { type: 'status.updated'; sessionId: string; status: TuiSessionStatus }
  | { type: 'activity.updated'; sessionId: string; message: string }
  | { type: 'trust.updated'; sessionId: string; trust: TuiTrustState; provenance?: TuiProvenance }
  | ({ type: 'guidance.suggestion'; sessionId: string } & TuiGuidanceSuggestion)
  | { type: 'preview.started'; sessionId: string; previewType: 'code' | 'image' | 'html' | 'music' }
  | { type: 'preview.content'; sessionId: string; content: string; previewType: 'code' | 'image' | 'html' | 'music' }
  | { type: 'preview.completed'; sessionId: string; content: string; previewType: 'code' | 'image' | 'html' | 'music'; imageUrl?: string }
  | { type: 'preview.verified'; sessionId: string; previewType: 'code' | 'image' | 'html' | 'music'; artifactPath: string; checks: string[]; imageUrl?: string }
  | { type: 'preview.missing'; sessionId: string; previewType: 'code' | 'image' | 'html' | 'music'; reason: string; artifactPath?: string }
  // Generation telemetry: emitted during RalphLoop generation
  | { type: 'generation.intent_brief'; sessionId: string; userRequest: string; requirements: string[]; missingDetails: string[]; questions: string[]; willClarify: boolean }
  | { type: 'generation.clarification_needed'; sessionId: string; questions: string[]; reason: string }
  | { type: 'generation.reasoning_trace'; sessionId: string; phase: string; thought: string; model?: string; detail?: string; source?: 'harness' | 'generator' | 'evaluator' }
  | { type: 'generation.route.selected'; sessionId: string; domain: string; domains: string[]; startedAt?: string; timeoutMinutes?: number; candidateCount?: number; executionMode?: 'draft' | 'prove' }
  | { type: 'generation.domain_plan'; sessionId: string; domains: string[]; startedAt?: string; timeoutMinutes?: number; candidateCount?: number; executionMode?: 'draft' | 'prove' }
  | { type: 'generation.attempt.started'; sessionId: string; domain: string; attempt: number; attemptTotal: number; startedAt?: string; timeoutMinutes?: number; candidateCount?: number; executionMode?: 'draft' | 'prove' }
  | { type: 'generation.attempt.failed'; sessionId: string; domain: string; attempt: number; attemptTotal: number; error: string; duration?: number }
  | { type: 'generation.candidate.generated'; sessionId: string; domain: string; attempt: number; attemptTotal: number; iteration: number; candidateCount?: number; codeSize?: number; duration?: number }
  | { type: 'generation.iteration'; sessionId: string; iteration: number; score: number; code: string; stageTimings?: Array<{ label: 'Generate' | 'Evaluate'; durationMs: number }> }
  | { type: 'generation.complete'; sessionId: string; iterations: number; finalScore: number; duration: number; model: string; reason: string; qualityState?: 'scored' | 'unscored'; executionMode?: 'draft' | 'prove' }
  | { type: 'generation.cancelled'; sessionId: string; reason: 'operator-stop' | 'stream-abort' | 'superseded'; cancelledAt: string; message?: string }
  | { type: 'generation.cognitive_receipt'; sessionId: string; loop: 'creative' | 'self-improvement' | 'model-assimilation'; receipts: Array<{ organ: string; status: 'observed' | 'pending' | 'unavailable'; detail: string }> }
  | { type: 'phase.changed'; sessionId: string; phase: string; stepCurrent?: number; stepTotal?: number; activeFile?: string; objective?: string }
  | { type: 'tool.started'; sessionId: string; toolName: string; thought?: string; displayLabel?: string; argsSummary?: string; stepNum?: number }
  | { type: 'tool.completed'; sessionId: string; toolName: string; resultSummary?: string; success?: boolean; stepNum?: number }
  | { type: 'files.changed'; sessionId: string; files: TuiFileChange[] }
  | { type: 'verification.started'; sessionId: string; command: string; jobId: string }
  | { type: 'verification.completed'; sessionId: string; command: string; success: boolean; outputTail?: string; jobId: string; duration?: number }
  | { type: 'artifact.found'; sessionId: string; artifactLabel: string; artifactPath: string }
  | ({ type: 'swarm.round'; sessionId: string } & SwarmRoundEvent)
  // Session turn: recorded after every agent routing decision
  | { type: 'session.turn'; sessionId: string; turnId: string; intent: string; delegatedTo: string; durationMs: number; artifactRefs?: string[]; taskRefs?: string[] }
  // Task lifecycle: engineering delegation events
  | { type: 'task.queued'; sessionId: string; taskId: string; description: string }
  | { type: 'task.started'; sessionId: string; taskId: string }
  | { type: 'task.completed'; sessionId: string; taskId: string; success: boolean; durationMs: number }
  // Product mode events: emitted when mode switches
  | { type: 'mode.product_changed'; sessionId: string; mode: string; label: string; description: string }
  | { type: 'mode.list'; sessionId: string; modes: Array<{ mode: string; label: string; description: string }> }
  // Skill events: emitted during skill execution
  | { type: 'skill.started'; sessionId: string; skillName: string }
  | { type: 'skill.completed'; sessionId: string; skillName: string; durationMs: number }
  | { type: 'skill.list'; sessionId: string; skills: Array<{ name: string; description: string; mode?: string }> }
  // Review events: candidate lifecycle
  | { type: 'review.candidate_added'; sessionId: string; candidateId: string; label: string; score: number }
  | { type: 'review.candidate_accepted'; sessionId: string; candidateId: string }
  | { type: 'review.candidate_rejected'; sessionId: string; candidateId: string }
  | { type: 'review.favorite_pinned'; sessionId: string; candidateId: string }
  | { type: 'review.diff_ready'; sessionId: string; candidateA: string; candidateB: string; diff: string }
  // Onboarding and diagnostics
  | { type: 'onboarding.step'; sessionId: string; stepId: string; title: string; stepStatus: string; value?: string }
  | { type: 'onboarding.complete'; sessionId: string; configWritten: boolean; configPath: string }
  | { type: 'diagnostics.result'; sessionId: string; checks: Array<{ name: string; status: string; message: string }>; allPassed: boolean }
  // Session resume
  | { type: 'session.list'; sessionId: string; sessions: Array<{ sessionId: string; turnCount: number; lastIntent?: string; updatedAt: string }> }
  // Workspace events: workspace CRUD and switching
  | { type: 'workspace.created'; sessionId: string; workspaceName: string }
  | { type: 'workspace.switched'; sessionId: string; workspaceName: string }
  | { type: 'workspace.list'; sessionId: string; workspaces: string[] }
  // Report events: generated session reports
  | { type: 'report.generated'; sessionId: string; format: string; content: string; turns: number; durationMs: number }
  // Autonomy events: level changes
  | { type: 'autonomy.changed'; sessionId: string; level: string; label: string; description: string }
  // Cortex events: background executive perception and decisions
  | { type: 'cortex.snapshot'; sessionId: string; snapshot: CortexSnapshot }
  // Cortex goal events: user goal CRUD
  | { type: 'cortex.goal_added'; sessionId: string; goal: CortexGoal }
  | { type: 'cortex.goal_list'; sessionId: string; goals: CortexGoal[] }
  | { type: 'cortex.goal_removed'; sessionId: string; goalId: string }
  | { type: 'cortex.goal_completed'; sessionId: string; goalId: string }
  // Cortex loop events: background executive decisions and actions
  | { type: 'cortex.loop_tick'; sessionId: string; tickNumber: number; data: Record<string, unknown> }
  | { type: 'cortex.decision'; sessionId: string; tickNumber: number; data: Record<string, unknown> }
  | { type: 'cortex.action_proposed'; sessionId: string; tickNumber: number; data: { proposal: ActionProposal } }
  // Cortex supervision events: stuck workers and expired leases
  | { type: 'cortex.stuck_detected'; sessionId: string; tickNumber: number; data: Record<string, unknown> }
  | { type: 'cortex.lease_expired'; sessionId: string; tickNumber: number; data: Record<string, unknown> }
  // Cortex dashboard: formatted explainability report from /cortex command
  | { type: 'cortex.dashboard'; sessionId: string; content: string }
  // Gardener events: autonomous taste/dream/emergence cycle results
  | { type: 'gardener.cycle'; sessionId: string; cycle: number; mode: string; actions: number; budgetRemaining: number; taskBreakdown?: { fresh: number; replay: number; dream: number }; health: unknown }
  // Video render events: emitted during video export lifecycle
  | { type: 'video:render:start'; sessionId: string; domain: string }
  | { type: 'video:render:complete'; sessionId: string; domain: string; videoPath: string }
  | { type: 'video:render:error'; sessionId: string; domain: string; error: string }
  | { type: 'error'; sessionId: string; message: string };
