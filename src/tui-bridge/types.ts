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

export type TuiBridgeEvent =
  | { type: 'response.started'; sessionId: string }
  | { type: 'response.delta'; sessionId: string; delta: string }
  | { type: 'response.completed'; sessionId: string; content: string }
  | { type: 'response.committed'; sessionId: string; content: string }
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
  | { type: 'error'; sessionId: string; message: string };
