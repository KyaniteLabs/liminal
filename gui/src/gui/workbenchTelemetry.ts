import { deriveCockpit } from './cockpitDerivation';
import type { BridgeEventByType, BridgeEventType, WorkbenchBridgeEvent } from './bridgeEvents';
export type { WorkbenchBridgeEvent } from './bridgeEvents';

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
  writeBackStatus: 'observed' | 'partial' | 'skipped' | 'missing';
  writeBackItems: Array<{ organ: string; status: string; detail: string }>;
  writeBackSummary: string;
}


export interface WorkbenchRunReceipt {
  heading: 'Run receipt';
  phase: string;
  outcome: 'running' | 'completed' | 'stopped' | 'failed';
  creativeDomain: string;
  provider?: string;
  model?: string;
  providerModel: string;
  artifact?: { label: string; path?: string };
  preview?: { type: WorkbenchPreview['type']; inline: boolean; path?: string; label: string };
  failure?: {
    message: string;
    provider?: string;
    model?: string;
    endpoint?: string;
    statusCode?: number;
    retryable?: boolean;
    responseBody?: string;
  };
  prior?: {
    revisionKind: string;
    phase: string;
    creativeDomain: string;
    artifact?: { label: string; path?: string };
    previewType?: string;
  };
  details: string[];
}

export interface WorkbenchSessionTruth {
  provider?: string;
  model?: string;
  roles?: Record<string, { provider?: string; model?: string }>;
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
  const derived = deriveCockpit(events, now);
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


function latestEvent<T extends BridgeEventType>(
  events: WorkbenchBridgeEvent[],
  type: T,
): BridgeEventByType<T> | undefined {
  return [...events].reverse().find((event): event is BridgeEventByType<T> => event.type === type);
}


function latestReceiptRunEvents(events: WorkbenchBridgeEvent[]): WorkbenchBridgeEvent[] {
  const terminalTypes = new Set(['generation.complete', 'generation.cancelled', 'generation.attempt.failed', 'preview.missing', 'error']);
  let latestTerminalIndex = -1;
  for (let index = events.length - 1; index >= 0; index--) {
    if (terminalTypes.has(String(events[index].type))) {
      latestTerminalIndex = index;
      break;
    }
  }

  const searchEnd = latestTerminalIndex >= 0 ? latestTerminalIndex : events.length - 1;
  let startIndex = -1;
  for (let index = searchEnd; index >= 0; index--) {
    const type = String(events[index].type);
    if (type === 'generation.route.selected' || type === 'generation.intent_brief') {
      startIndex = index;
      break;
    }
  }
  if (startIndex < 0 && latestTerminalIndex >= 0) startIndex = latestTerminalIndex;
  if (startIndex < 0) return events;

  const previousTerminal = events.slice(0, startIndex).reduce((latest, event, index) => terminalTypes.has(String(event.type)) ? index : latest, -1);
  for (let index = startIndex - 1; index > previousTerminal; index--) {
    if (events[index].type === 'generation.receipt.linked') {
      startIndex = index;
    }
  }
  return events.slice(startIndex);
}

function latestStatusTruth(events: WorkbenchBridgeEvent[]): WorkbenchSessionTruth | undefined {
  const statusEvent = latestEvent(events, 'status.updated');
  const rawStatus = statusEvent?.status;
  return rawStatus && typeof rawStatus === 'object' ? rawStatus as WorkbenchSessionTruth : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function latestCreativeDomain(events: WorkbenchBridgeEvent[]): string | undefined {
  const domainTruth = latestEvent(events, 'generation.domain_truth');
  const preview = latestEvent(events, 'preview.completed');
  const artifact = latestEvent(events, 'artifact.found');
  const route = latestEvent(events, 'generation.route.selected');
  const attempt = latestEvent(events, 'generation.attempt.started');
  const domainFromArtifact = typeof artifact?.artifactLabel === 'string'
    ? artifact.artifactLabel.split(' ')[0]?.toLowerCase()
    : undefined;
  return firstText(
    preview?.previewDomain,
    preview?.generatedDomain,
    domainTruth?.previewDomain,
    domainTruth?.generatedDomain,
    domainTruth?.selectedDomain,
    artifact?.previewDomain,
    domainFromArtifact,
    route?.selectedDomain,
    route?.domain,
    attempt?.domain,
  );
}

function latestProviderModelTruth(
  events: WorkbenchBridgeEvent[],
  session?: WorkbenchSessionTruth | null,
): { provider?: string; model?: string } {
  const status = latestStatusTruth(events);
  const generatorRole = status?.roles?.generator || session?.roles?.generator;
  const providerEvent = [...events].reverse().find((event) => typeof event.provider === 'string' || typeof event.model === 'string');
  const completion = latestEvent(events, 'generation.complete');
  return {
    provider: firstText(generatorRole?.provider, providerEvent?.provider, status?.provider, session?.provider),
    model: firstText(generatorRole?.model, providerEvent?.model, completion?.model, status?.model, session?.model),
  };
}


function receiptOutcome(events: WorkbenchBridgeEvent[], phase: string): WorkbenchRunReceipt['outcome'] {
  if (events.some((event) => event.type === 'generation.cancelled')) return 'stopped';
  if (events.some((event) => event.type === 'generation.attempt.failed' || event.type === 'error' || event.type === 'preview.missing')) return 'failed';
  if (events.some((event) => event.type === 'generation.complete')) return 'completed';
  return phase === 'stopped' ? 'stopped' : phase === 'complete' ? 'completed' : 'running';
}

function latestFailureReceipt(events: WorkbenchBridgeEvent[]): WorkbenchRunReceipt['failure'] | undefined {
  const event = [...events].reverse().find((item) => item.type === 'generation.attempt.failed' || item.type === 'error' || item.type === 'preview.missing');
  if (!event) return undefined;
  const message = String(event.error || event.message || event.reason || 'run failed');
  const statusCode = typeof event.statusCode === 'number' ? event.statusCode : undefined;
  const retryable = typeof event.retryable === 'boolean' ? event.retryable : undefined;
  return {
    message,
    provider: firstText(event.provider),
    model: firstText(event.model),
    endpoint: firstText(event.endpoint),
    statusCode,
    retryable,
    responseBody: firstText(event.responseBody),
  };
}

function latestPriorReceipt(events: WorkbenchBridgeEvent[]): WorkbenchRunReceipt['prior'] | undefined {
  const event = latestEvent(events, 'generation.receipt.linked');
  if (!event) return undefined;
  const artifactLabel = firstText(event.priorArtifactLabel);
  const artifactPath = firstText(event.priorArtifactPath);
  return {
    revisionKind: firstText(event.revisionKind) || 'revision',
    phase: firstText(event.priorPhase) || 'unknown',
    creativeDomain: firstText(event.priorDomain) || 'unknown',
    artifact: artifactLabel || artifactPath ? { label: artifactLabel || 'prior artifact', path: artifactPath } : undefined,
    previewType: firstText(event.priorPreviewType),
  };
}

function failureDetailText(failure: NonNullable<WorkbenchRunReceipt['failure']>): string {
  const status = failure.statusCode ? `HTTP ${failure.statusCode}` : '';
  const retry = failure.retryable === true ? 'retryable' : failure.retryable === false ? 'not retryable' : '';
  const provenance = [failure.provider && failure.model ? `${failure.provider} / ${failure.model}` : failure.provider || failure.model, failure.endpoint, status, retry]
    .filter(Boolean)
    .join(' · ');
  return provenance ? `${failure.message} · ${provenance}` : failure.message;
}

export function latestRunReceipt(
  events: WorkbenchBridgeEvent[],
  session?: WorkbenchSessionTruth | null,
): WorkbenchRunReceipt | null {
  const runEvents = latestReceiptRunEvents(events);
  const status = latestStatusTruth(events);
  const sessionTruth = {
    provider: status?.provider || session?.provider,
    model: status?.model || session?.model,
    roles: status?.roles || session?.roles,
  };
  const artifactEvent = latestEvent(runEvents, 'artifact.found');
  const previewEvent = latestEvent(runEvents, 'preview.completed');
  const completionEvent = latestEvent(runEvents, 'generation.complete');
  const hasGenerationRoute = runEvents.some((event) => String(event.type).startsWith('generation.'));
  if (!hasGenerationRoute && !artifactEvent && !previewEvent) return null;

  const summary = summarizeWorkbenchBridge(runEvents);
  const creativeDomain = latestCreativeDomain(runEvents) || 'unknown';
  const { provider, model } = latestProviderModelTruth(runEvents, sessionTruth);
  const preview = latestBridgePreview(runEvents);
  const previewPath = firstText(previewEvent?.artifactPath, previewEvent?.imageUrl, artifactEvent?.artifactPath, preview?.label);
  const artifactPath = firstText(artifactEvent?.artifactPath, previewEvent?.artifactPath, previewEvent?.imageUrl);
  const artifactLabel = firstText(artifactEvent?.artifactLabel, artifactPath ? `${creativeDomain} artifact` : undefined);
  const providerModel = [provider, model].filter(Boolean).join(' / ') || 'unknown provider/model';
  const previewType = preview?.type || (typeof previewEvent?.previewType === 'string' ? previewEvent.previewType as WorkbenchPreview['type'] : undefined);
  const inlinePreview = Boolean(preview && (preview.src || preview.content || preview.code));
  const outcome = receiptOutcome(runEvents, summary.phase);
  const failure = latestFailureReceipt(runEvents);
  const prior = latestPriorReceipt(runEvents);
  const cancelledEvent = latestEvent(runEvents, 'generation.cancelled');
  const details = [
    `phase: ${summary.phase}`,
    `outcome: ${outcome}`,
    `creative domain: ${creativeDomain}`,
    `provider/model: ${providerModel}`,
    artifactLabel ? `artifact: ${artifactLabel}${artifactPath ? ` ${artifactPath}` : ''}` : 'artifact: waiting',
    previewType ? `preview: ${previewType}${inlinePreview ? ' inline' : ' pending'}${previewPath ? ` ${previewPath}` : ''}` : 'preview: waiting',
    failure ? `failure: ${failureDetailText(failure)}` : '',
    cancelledEvent ? `stopped: ${String(cancelledEvent.message || cancelledEvent.reason || 'Generation stopped')}` : '',
    prior?.artifact ? `prior ${prior.revisionKind}: ${prior.artifact.label}${prior.artifact.path ? ` ${prior.artifact.path}` : ''}` : '',
    completionEvent?.reason ? `completion: ${String(completionEvent.reason)}` : '',
  ].filter(Boolean);

  return {
    heading: 'Run receipt',
    phase: summary.phase,
    outcome,
    creativeDomain,
    provider,
    model,
    providerModel,
    artifact: artifactLabel ? { label: artifactLabel, path: artifactPath } : undefined,
    preview: previewType ? {
      type: previewType,
      inline: inlinePreview,
      path: previewPath,
      label: preview?.label || previewPath || `${previewType} preview`,
    } : undefined,
    failure,
    prior,
    details,
  };
}

export function latestCognitiveReceipt(events: WorkbenchBridgeEvent[]): WorkbenchCognitiveReceipt | null {
  const receipt = [...events].reverse().find((event) => event.type === 'generation.cognitive_receipt');
  const rawItems = Array.isArray(receipt?.receipts) ? receipt.receipts : [];
  if (!receipt || rawItems.length === 0) return null;
  const items = rawItems.map((item) => {
    const record = item as { organ?: unknown; status?: unknown; detail?: unknown };
    return {
      organ: String(record.organ || 'organ'),
      status: String(record.status || 'unknown'),
      detail: String(record.detail || ''),
    };
  });
  const writeBackItems = cognitiveWriteBackItems(items);

  return {
    heading: 'What Liminal learned',
    loop: String(receipt.loop || 'creative'),
    items,
    writeBackStatus: cognitiveWriteBackStatus(writeBackItems),
    writeBackItems,
    writeBackSummary: summarizeCognitiveWriteBack(writeBackItems),
  };
}

const cognitiveWriteBackOrgans = ['memory', 'compost', 'dreaming'] as const;

function cognitiveWriteBackItems(items: WorkbenchCognitiveReceipt['items']): WorkbenchCognitiveReceipt['writeBackItems'] {
  return cognitiveWriteBackOrgans.map((organ) => (
    items.find((item) => item.organ === organ) || {
      organ,
      status: 'unavailable',
      detail: `${organ} write-back receipt was not emitted for this generation.`,
    }
  ));
}

function cognitiveWriteBackStatus(items: WorkbenchCognitiveReceipt['writeBackItems']): WorkbenchCognitiveReceipt['writeBackStatus'] {
  const observedCount = items.filter((item) => item.status === 'observed').length;
  if (observedCount === items.length) return 'observed';
  if (observedCount === 0) return items.length > 0 ? 'skipped' : 'missing';
  return 'partial';
}

function summarizeCognitiveWriteBack(items: WorkbenchCognitiveReceipt['writeBackItems']): string {
  return items.map((item) => `${item.organ} ${item.status}: ${item.detail}`).join(' | ');
}

function formatFailureProvenance(event: WorkbenchBridgeEvent): string {
  const providerModel = [event.provider, event.model].filter(Boolean).map(String).join(' / ');
  const endpoint = event.endpoint ? String(event.endpoint) : '';
  const status = event.statusCode ? `HTTP ${String(event.statusCode)}` : '';
  const retry = event.retryable === true ? 'retryable' : event.retryable === false ? 'not retryable' : '';
  return [providerModel, endpoint, status, retry].filter(Boolean).join(' · ');
}

function formatFailureDetail(event: WorkbenchBridgeEvent, fallback: string): string {
  const message = String(event.error || event.message || fallback);
  const provenance = formatFailureProvenance(event);
  const body = event.responseBody ? ` · body: ${String(event.responseBody)}` : '';
  return provenance ? `${message} · ${provenance}${body}` : message;
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
        return { label: 'Provider failure', detail: formatFailureDetail(event, 'attempt failed'), status: 'failed' };
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
      return { label: 'Provider error', detail: formatFailureDetail(event, 'unknown error'), status: 'failed' };
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
