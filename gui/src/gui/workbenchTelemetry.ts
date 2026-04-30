import { deriveCockpit } from './cockpitDerivation';

export type WorkbenchBridgeEvent = {
  type: string;
  [key: string]: unknown;
};

export interface WorkbenchBridgeSummary {
  active: boolean;
  phase: string;
  stageTitle: string;
  stageSubtitle: string;
  timelineStatus: string;
  timelinePrimary: string;
  timelineSecondary: string;
  progressPercent: number;
  processSteps: WorkbenchProcessStep[];
  recentActivity: Array<{ label: string; detail: string; status?: string }>;
  stageTimings: Array<{ label: string; durationLabel: string }>;
  humanReview: {
    status: 'waiting' | 'ready' | 'blocked';
    heading: string;
    summary: string;
    checks: Array<{ label: string; status: string; detail: string }>;
    issueReport: string;
  };
}

export type WorkbenchProcessStatus = 'pending' | 'active' | 'done' | 'needs-input' | 'failed';

export interface WorkbenchProcessStep {
  id: string;
  label: string;
  detail: string;
  status: WorkbenchProcessStatus;
}

export interface WorkbenchPreview {
  type: 'image' | 'code' | 'html' | 'music';
  src?: string;
  code?: string;
  content?: string;
  label: string;
}

export interface WorkbenchClarificationRequest {
  question: string;
  reason: string;
}

export interface WorkbenchCognitiveReceipt {
  heading: 'What Liminal learned';
  loop: string;
  items: Array<{ organ: string; status: string; detail: string }>;
}

export interface ImproveLaneProposal {
  id: string;
  title: string;
  category: string;
  score: number;
  confidence: string;
  risk: string;
  measurableTarget: string;
  expectedVerification: string[];
}

export interface ImproveLaneSummary {
  heading: 'Improve';
  proposals: ImproveLaneProposal[];
}

export function summarizeWorkbenchBridge(
  events: WorkbenchBridgeEvent[],
  now = Date.now(),
): WorkbenchBridgeSummary {
  const derived = deriveCockpit(events as any, now);
  const phase = String(derived.phase || 'idle');
  const processSteps = summarizeProcessSteps(events, phase);
  const readyDone = processSteps.some((step) => step.id === 'ready' && step.status === 'done');
  const terminalPhases = ['idle', 'complete', 'previewed', 'verified preview', 'preview missing', 'stopped', 'disconnected'];
  const active = !readyDone && !terminalPhases.includes(phase);

  return {
    active,
    phase,
    stageTitle: active ? phase : phase === 'complete' ? 'complete' : terminalPhases.includes(phase) && phase !== 'idle' ? phase : 'ready',
    stageSubtitle: derived.latestMessage || derived.activeWork || 'No active generation',
    timelineStatus: phase,
    timelinePrimary: derived.activeDomain || derived.plan[0] || 'Generate',
    timelineSecondary: derived.latestMessage || `${derived.elapsedLabel} elapsed · ${derived.etaLabel}`,
    progressPercent: derived.progressPercent,
    processSteps,
    recentActivity: summarizeRecentActivity(events),
    stageTimings: derived.stageTimings ?? [],
    humanReview: derived.humanReview,
  };
}


export function latestCognitiveReceipt(events: WorkbenchBridgeEvent[]): WorkbenchCognitiveReceipt | null {
  const receipt = [...events].reverse().find((event) => event.type === 'generation.cognitive_receipt');
  const rawItems = Array.isArray(receipt?.receipts) ? receipt.receipts : [];
  if (!receipt || rawItems.length === 0) return null;

  return {
    heading: 'What Liminal learned',
    loop: String(receipt.loop || 'creative'),
    items: rawItems.map((item) => {
      const record = item as { organ?: unknown; status?: unknown; detail?: unknown };
      return {
        organ: String(record.organ || 'organ'),
        status: String(record.status || 'unknown'),
        detail: String(record.detail || ''),
      };
    }),
  };
}

function routeDetail(selectedDomain: string, domains: string[]): string {
  if (!selectedDomain) return domains.length > 0 ? `planned domains: ${domains.join(' -> ')}` : 'waiting for route';
  const backups = domains.filter((domain) => domain !== selectedDomain);
  return backups.length > 0
    ? `selected ${selectedDomain}; backup domains if needed: ${backups.join(' -> ')}`
    : `selected ${selectedDomain}; no backup domain`;
}

function completedDraftRouteDetail(selectedDomain: string, backupWasUsed: boolean, failedDomains: string[]): string {
  if (!backupWasUsed) return `selected ${selectedDomain}; no backup domain used`;
  const failedSummary = failedDomains.length > 0 ? ` after ${failedDomains.join(' -> ')} did not complete` : '';
  return `selected ${selectedDomain}; backup domain used${failedSummary}`;
}

function completedDraftAttemptDetail(selectedDomain: string, backupWasUsed: boolean): string {
  return `preview ready: selected ${selectedDomain}; ${backupWasUsed ? 'backup used' : 'no backup used'}`;
}

function summarizeCognitiveReceipt(events: WorkbenchBridgeEvent[]): string {
  const receipt = [...events].reverse().find((event) => event.type === 'generation.cognitive_receipt');
  const receipts = Array.isArray(receipt?.receipts) ? receipt.receipts : [];
  if (receipts.length === 0) return 'waiting for organism receipts';
  return receipts
    .map((item) => {
      const record = item as { organ?: unknown; status?: unknown };
      return `${String(record.organ || 'organ')}:${String(record.status || 'unknown')}`;
    })
    .join(', ');
}

function summarizeProcessSteps(events: WorkbenchBridgeEvent[], phase: string): WorkbenchProcessStep[] {
  const hasIntent = events.some((event) => event.type === 'generation.intent_brief');
  const hasClarification = latestClarificationRequest(events) !== null;
  const hasRoute = events.some((event) => event.type === 'generation.route.selected');
  const hasPlan = events.some((event) => event.type === 'generation.domain_plan');
  const hasAttempt = events.some((event) => event.type === 'generation.attempt.started');
  const hasCandidate = events.some((event) => event.type === 'generation.candidate.generated' || event.type === 'generation.iteration');
  const hasPreview = events.some((event) => event.type === 'preview.completed');
  const hasVerifiedPreview = events.some((event) => event.type === 'preview.verified');
  const missingPreviewEvent = [...events].reverse().find((event) => event.type === 'preview.missing');
  const hasMissingPreview = Boolean(missingPreviewEvent);
  const hasCancelled = events.some((event) => event.type === 'generation.cancelled');
  const latestDisconnectedIndex = events.reduce((latest, event, index) => event.type === 'stream.disconnected' ? index : latest, -1);
  const hasDisconnected = events.length > 0 && latestDisconnectedIndex === events.length - 1;
  const hasComplete = events.some((event) => event.type === 'generation.complete');
  const hasCognitiveReceipt = events.some((event) => event.type === 'generation.cognitive_receipt');
  const failedAttemptEvents = events.filter((event) => event.type === 'generation.attempt.failed');
  const hasError = events.some((event) => event.type === 'error' || event.type === 'generation.attempt.failed');
  const routeEvent = [...events].reverse().find((event) => event.type === 'generation.route.selected');
  const planEvent = [...events].reverse().find((event) => event.type === 'generation.domain_plan');
  const attemptEvent = [...events].reverse().find((event) => event.type === 'generation.attempt.started');
  const routeDomains = Array.isArray(routeEvent?.domains) ? routeEvent.domains.map(String) : [];
  const rawDomains = Array.isArray(planEvent?.domains) ? planEvent.domains.map(String) : routeDomains;
  const selectedRoute = String(routeEvent?.domain || rawDomains[0] || '');
  const routeSummary = routeDetail(selectedRoute, rawDomains);
  const completeEvent = [...events].reverse().find((event) => event.type === 'generation.complete');
  const artifactEvent = [...events].reverse().find((event) => event.type === 'artifact.found');
  const verifiedEvent = [...events].reverse().find((event) => event.type === 'preview.verified');
  const selectedDomain = String((artifactEvent?.artifactLabel || '').split(' ')[0] || attemptEvent?.domain || rawDomains[0] || 'unknown').toLowerCase();
  const failedDomains = failedAttemptEvents.map((event) => String(event.domain || 'unknown'));
  const backupWasUsed = failedAttemptEvents.length > 0;
  const attemptLabel = completeEvent
    ? completeEvent.executionMode === 'draft'
      ? completedDraftAttemptDetail(selectedDomain, backupWasUsed)
      : `complete: selected ${selectedDomain}`
    : attemptEvent ? `attempt ${attemptEvent.attempt || 1}/${attemptEvent.attemptTotal || 1}` : 'waiting for model';
  const cognitiveDetail = summarizeCognitiveReceipt(events);

  return [
    {
      id: 'intent',
      label: 'Brief',
      detail: hasClarification ? 'needs answer' : hasIntent ? 'brief captured' : 'waiting for prompt',
      status: hasClarification ? 'needs-input' : hasIntent || hasPlan || hasAttempt || hasComplete ? 'done' : phase === 'idle' ? 'pending' : 'active',
    },
    {
      id: 'route',
      label: 'Medium',
      detail: hasComplete && completeEvent?.executionMode === 'draft' ? completedDraftRouteDetail(selectedDomain, backupWasUsed, failedDomains) : routeSummary,
      status: hasRoute || hasPlan || hasAttempt || hasComplete ? 'done' : hasIntent && !hasClarification ? 'active' : 'pending',
    },
    {
      id: 'draft',
      label: 'Generate',
      detail: hasAttempt ? attemptLabel : 'model not called yet',
      status: (hasError && !hasComplete) || hasCancelled || hasDisconnected ? 'failed' : hasCandidate || hasPreview || hasComplete ? 'done' : hasAttempt ? 'active' : 'pending',
    },
    {
      id: 'preview',
      label: 'Preview',
      detail: hasMissingPreview
        ? `missing ${String(missingPreviewEvent?.previewType || 'preview')} preview: ${String(missingPreviewEvent?.reason || 'preview unavailable')}`
        : hasVerifiedPreview
        ? `verified ${String(verifiedEvent?.previewType || 'preview')} preview${selectedDomain !== 'unknown' ? ` (${selectedDomain})` : ''}`
        : hasPreview ? `artifact mounted${selectedDomain !== 'unknown' ? ` (${selectedDomain})` : ''}` : hasCandidate || hasComplete ? 'rendering receipt' : 'waiting for artifact',
      status: hasMissingPreview || hasDisconnected ? 'failed' : hasVerifiedPreview || hasPreview ? 'done' : hasCandidate || hasComplete ? 'active' : 'pending',
    },
    ...(hasCognitiveReceipt ? [{
      id: 'cognition',
      label: 'Reflection',
      detail: cognitiveDetail,
      status: hasComplete ? 'done' : hasError ? 'failed' : 'active',
    } as WorkbenchProcessStep] : []),
    {
      id: 'ready',
      label: 'Ready',
      detail: hasCancelled ? 'stopped by operator' : hasDisconnected ? 'event stream disconnected' : hasComplete && completeEvent?.executionMode === 'draft' ? 'preview ready; waiting for your revise/new variation/polish choice' : hasComplete ? 'run completed' : 'not ready yet',
      status: hasComplete ? 'done' : hasError || hasCancelled || hasDisconnected ? 'failed' : 'pending',
    },
  ];
}

function summarizeRecentActivity(events: WorkbenchBridgeEvent[]): Array<{ label: string; detail: string; status?: string }> {
  return events
    .filter((event) => [
      'generation.intent_brief',
      'generation.clarification_needed',
      'generation.reasoning_trace',
      'generation.route.selected',
      'generation.domain_plan',
      'generation.attempt.started',
      'generation.candidate.generated',
      'generation.attempt.failed',
      'tool.started',
      'tool.completed',
      'activity.updated',
      'preview.completed',
      'preview.verified',
      'preview.missing',
      'generation.cancelled',
      'generation.complete',
      'generation.cognitive_receipt',
      'stream.disconnected',
      'error',
    ].includes(String(event.type)))
    .slice(-6)
    .map((event) => {
      if (event.type === 'generation.intent_brief') {
        const requirements = Array.isArray(event.requirements) ? event.requirements : [];
        return { label: 'Creative brief', detail: String(requirements[0] || event.userRequest || 'requirements extracted') };
      }
      if (event.type === 'generation.clarification_needed') {
        const questions = Array.isArray(event.questions) ? event.questions : [];
        return { label: 'Clarification needed', detail: String(questions[0] || event.reason || 'more detail needed'), status: 'needs-input' };
      }
      if (event.type === 'generation.reasoning_trace') {
        const source = event.source ? `${event.source} ` : '';
        return { label: `${source}Notes: ${String(event.phase || 'trace')}`, detail: String(event.thought || event.detail || 'thinking') };
      }
      if (event.type === 'generation.route.selected') {
        const domains = Array.isArray(event.domains) ? event.domains.join(' -> ') : 'unknown';
        return { label: 'Medium chosen', detail: `${String(event.domain || 'domain')} (${domains})`, status: 'ok' };
      }
      if (event.type === 'generation.domain_plan') {
        const domains = Array.isArray(event.domains) ? event.domains.join(' -> ') : 'unknown';
        return { label: 'Possible media', detail: domains };
      }
      if (event.type === 'generation.attempt.started') {
        return { label: 'Generating', detail: `Attempt ${event.attempt}/${event.attemptTotal}: ${event.domain}` };
      }
      if (event.type === 'generation.candidate.generated') {
        return { label: 'Draft', detail: `Iteration ${event.iteration}, ${event.codeSize || 0} bytes` };
      }
      if (event.type === 'generation.attempt.failed') {
        return { label: 'Retrying', detail: String(event.error || 'attempt failed'), status: 'failed' };
      }
      if (event.type === 'tool.started') {
        return { label: String(event.toolName || 'tool'), detail: String(event.displayLabel || event.argsSummary || 'started'), status: 'running' };
      }
      if (event.type === 'tool.completed') {
        return { label: String(event.toolName || 'tool'), detail: String(event.resultSummary || 'completed'), status: event.success === false ? 'failed' : 'ok' };
      }
      if (event.type === 'activity.updated') {
        return { label: 'Activity', detail: String(event.message || '') };
      }
      if (event.type === 'preview.completed') {
        return { label: 'Preview', detail: event.previewType === 'image' ? String(event.imageUrl || 'inline image rendered') : `${event.previewType} ready`, status: 'ok' };
      }
      if (event.type === 'preview.verified') {
        const checks = Array.isArray(event.checks) ? event.checks.join(', ') : 'verified';
        return { label: 'Preview verified', detail: `${String(event.previewType || 'preview')}: ${checks}`, status: 'ok' };
      }
      if (event.type === 'preview.missing') {
        return { label: 'Preview missing', detail: `${String(event.previewType || 'preview')}: ${String(event.reason || 'preview unavailable')}`, status: 'failed' };
      }
      if (event.type === 'generation.cancelled') {
        return { label: 'Stopped', detail: String(event.reason || 'operator stopped generation'), status: 'failed' };
      }
      if (event.type === 'generation.cognitive_receipt') {
        return { label: 'Reflection receipt', detail: summarizeCognitiveReceipt([event]), status: 'ok' };
      }
      if (event.type === 'generation.complete') {
        if (event.qualityState === 'unscored') {
          return { label: 'Preview ready', detail: String(event.reason || 'Preview ready without scoring'), status: 'ok' };
        }
        return { label: 'Complete', detail: `Score ${event.finalScore ?? 'n/a'} in ${event.duration ?? 0}ms`, status: 'ok' };
      }
      if (event.type === 'stream.disconnected') {
        return { label: 'Disconnected', detail: String(event.message || 'event stream disconnected'), status: 'failed' };
      }
      return { label: 'Error', detail: String(event.message || 'unknown error'), status: 'failed' };
    });
}

export function latestBridgePreview(events: WorkbenchBridgeEvent[]): WorkbenchPreview | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type !== 'preview.completed') continue;
    if (event.previewType === 'image' && typeof event.content === 'string') {
      return {
        type: 'image',
        src: `data:image/png;base64,${event.content}`,
        label: typeof event.imageUrl === 'string' ? event.imageUrl : 'Generated preview image',
      };
    }
    if ((event.previewType === 'html' || event.previewType === 'music') && typeof event.content === 'string') {
      const type = event.previewType === 'music' ? 'music' : 'html';
      return {
        type,
        content: String(event.content),
        label: typeof event.artifactPath === 'string'
          ? event.artifactPath
          : type === 'music' ? 'Generated music preview' : 'Generated HTML preview',
      };
    }
    if (event.previewType === 'code' && typeof event.content === 'string') {
      return {
        type: 'code',
        code: String(event.content),
        label: 'Generated code preview',
      };
    }
  }

  return null;
}

export function latestBridgeCodePreview(events: WorkbenchBridgeEvent[]): WorkbenchPreview | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type === 'preview.completed' && event.previewType === 'code' && typeof event.content === 'string') {
      return {
        type: 'code',
        code: String(event.content),
        label: 'Generated live code',
      };
    }
  }

  return null;
}

export function latestClarificationRequest(events: WorkbenchBridgeEvent[]): WorkbenchClarificationRequest | null {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if ([
      'generation.route.selected',
      'generation.domain_plan',
      'generation.attempt.started',
      'generation.candidate.generated',
      'preview.completed',
      'preview.verified',
      'preview.missing',
      'generation.cancelled',
      'generation.complete',
      'generation.cognitive_receipt',
      'stream.disconnected',
      'error',
    ].includes(String(event.type))) {
      return null;
    }

    if (event.type === 'generation.clarification_needed') {
      const questions = Array.isArray(event.questions) ? event.questions : [];
      return {
        question: String(questions[0] || event.reason || 'What should Liminal generate?'),
        reason: String(event.reason || 'More detail is needed before generation.'),
      };
    }
  }

  return null;
}

export function summarizeImproveLane(events: WorkbenchBridgeEvent[]): ImproveLaneSummary {
  const proposals = events
    .filter((event) => event.type === 'self_healing.proposal')
    .map((event) => ({
      id: String(event.proposalId || event.id || ''),
      title: String(event.title || 'Improvement proposal'),
      category: String(event.category || 'reliability hardening'),
      score: Number(event.score || 0),
      confidence: String(event.confidence || 'medium'),
      risk: String(event.risk || 'medium'),
      measurableTarget: String(event.measurableTarget || ''),
      expectedVerification: Array.isArray(event.expectedVerification)
        ? event.expectedVerification.map(String)
        : [],
    }))
    .filter((proposal) => proposal.id.length > 0)
    .sort((a, b) => b.score - a.score);

  return {
    heading: 'Improve',
    proposals,
  };
}
