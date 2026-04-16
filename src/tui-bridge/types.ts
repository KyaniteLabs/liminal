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
  kind: 'structured' | 'llm';
  requiresConfirmation: true;
  createdAt: string;
}

export interface TuiSessionStatus {
  sessionId: string;
  mode: TuiMode;
  provider?: string;
  model?: string;
  trust: TuiTrustState;
  activeTask?: string;
  pendingAction?: TuiPendingAction;
}

export interface TuiInputRequest {
  mode: TuiMode;
  text: string;
  clientIntent?: 'chat' | 'inspect' | 'action';
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
  | { type: 'preview.started'; sessionId: string; previewType: 'code' | 'image' | 'html' | 'music' }
  | { type: 'preview.content'; sessionId: string; content: string; previewType: 'code' | 'image' | 'html' | 'music' }
  | { type: 'preview.completed'; sessionId: string; content: string; previewType: 'code' | 'image' | 'html' | 'music'; imageUrl?: string }
  // Generation telemetry: emitted during RalphLoop generation
  | { type: 'generation.iteration'; sessionId: string; iteration: number; score: number; code: string }
  | { type: 'generation.complete'; sessionId: string; iterations: number; finalScore: number; duration: number; model: string; reason: string }
  | { type: 'phase.changed'; sessionId: string; phase: string; stepCurrent?: number; stepTotal?: number; activeFile?: string; objective?: string }
  | { type: 'tool.started'; sessionId: string; toolName: string; thought?: string; argsSummary?: string; stepNum?: number }
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
  | { type: 'error'; sessionId: string; message: string };
