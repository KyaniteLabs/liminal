import { deriveCockpit } from '../components/OperatorCockpit';

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
  type: 'image' | 'code';
  src?: string;
  code?: string;
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
  const active = !readyDone && !['idle', 'complete', 'previewed'].includes(phase);

  return {
    active,
    phase,
    stageTitle: active ? phase : phase === 'complete' ? 'complete' : 'ready',
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
  const hasPlan = events.some((event) => event.type === 'generation.domain_plan');
  const hasAttempt = events.some((event) => event.type === 'generation.attempt.started');
  const hasCandidate = events.some((event) => event.type === 'generation.candidate.generated' || event.type === 'generation.iteration');
  const hasPreview = events.some((event) => event.type === 'preview.completed');
  const hasComplete = events.some((event) => event.type === 'generation.complete');
  const hasCognitiveReceipt = events.some((event) => event.type === 'generation.cognitive_receipt');
  const hasError = events.some((event) => event.type === 'error' || event.type === 'generation.attempt.failed');
  const planEvent = [...events].reverse().find((event) => event.type === 'generation.domain_plan');
  const attemptEvent = [...events].reverse().find((event) => event.type === 'generation.attempt.started');
  const domains = Array.isArray(planEvent?.domains) ? planEvent.domains.map(String).join(' -> ') : 'waiting for route';
  const attemptLabel = attemptEvent ? `attempt ${attemptEvent.attempt || 1}/${attemptEvent.attemptTotal || 1}` : 'waiting for model';
  const cognitiveDetail = summarizeCognitiveReceipt(events);

  return [
    {
      id: 'intent',
      label: 'Intent',
      detail: hasClarification ? 'needs answer' : hasIntent ? 'brief captured' : 'waiting for prompt',
      status: hasClarification ? 'needs-input' : hasIntent || hasPlan || hasAttempt || hasComplete ? 'done' : phase === 'idle' ? 'pending' : 'active',
    },
    {
      id: 'route',
      label: 'Route',
      detail: domains,
      status: hasPlan || hasAttempt || hasComplete ? 'done' : hasIntent && !hasClarification ? 'active' : 'pending',
    },
    {
      id: 'draft',
      label: 'Draft',
      detail: hasAttempt ? attemptLabel : 'model not called yet',
      status: hasError ? 'failed' : hasCandidate || hasPreview || hasComplete ? 'done' : hasAttempt ? 'active' : 'pending',
    },
    {
      id: 'preview',
      label: 'Preview',
      detail: hasPreview ? 'artifact mounted' : hasCandidate || hasComplete ? 'rendering receipt' : 'waiting for artifact',
      status: hasPreview ? 'done' : hasCandidate || hasComplete ? 'active' : 'pending',
    },
    ...(hasCognitiveReceipt ? [{
      id: 'cognition',
      label: 'Cognition',
      detail: cognitiveDetail,
      status: hasComplete ? 'done' : hasError ? 'failed' : 'active',
    } as WorkbenchProcessStep] : []),
    {
      id: 'ready',
      label: 'Ready',
      detail: hasComplete ? 'run completed' : 'not ready yet',
      status: hasComplete ? 'done' : hasError ? 'failed' : 'pending',
    },
  ];
}

function summarizeRecentActivity(events: WorkbenchBridgeEvent[]): Array<{ label: string; detail: string; status?: string }> {
  return events
    .filter((event) => [
      'generation.intent_brief',
      'generation.clarification_needed',
      'generation.reasoning_trace',
      'generation.domain_plan',
      'generation.attempt.started',
      'generation.candidate.generated',
      'generation.attempt.failed',
      'tool.started',
      'tool.completed',
      'activity.updated',
      'preview.completed',
      'generation.complete',
      'generation.cognitive_receipt',
      'error',
    ].includes(String(event.type)))
    .slice(-6)
    .map((event) => {
      if (event.type === 'generation.intent_brief') {
        const requirements = Array.isArray(event.requirements) ? event.requirements : [];
        return { label: 'Intent brief', detail: String(requirements[0] || event.userRequest || 'requirements extracted') };
      }
      if (event.type === 'generation.clarification_needed') {
        const questions = Array.isArray(event.questions) ? event.questions : [];
        return { label: 'Clarification needed', detail: String(questions[0] || event.reason || 'more detail needed'), status: 'needs-input' };
      }
      if (event.type === 'generation.reasoning_trace') {
        const source = event.source ? `${event.source} ` : '';
        return { label: `${source}Reasoning: ${String(event.phase || 'trace')}`, detail: String(event.thought || event.detail || 'thinking') };
      }
      if (event.type === 'generation.domain_plan') {
        const domains = Array.isArray(event.domains) ? event.domains.join(' -> ') : 'unknown';
        return { label: 'Domain plan', detail: domains };
      }
      if (event.type === 'generation.attempt.started') {
        return { label: 'Model call', detail: `Attempt ${event.attempt}/${event.attemptTotal}: ${event.domain}` };
      }
      if (event.type === 'generation.candidate.generated') {
        return { label: 'Candidate', detail: `Iteration ${event.iteration}, ${event.codeSize || 0} bytes` };
      }
      if (event.type === 'generation.attempt.failed') {
        return { label: 'Fallback', detail: String(event.error || 'attempt failed'), status: 'failed' };
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
      if (event.type === 'generation.cognitive_receipt') {
        return { label: 'Cognitive receipt', detail: summarizeCognitiveReceipt([event]), status: 'ok' };
      }
      if (event.type === 'generation.complete') {
        if (event.qualityState === 'unscored') {
          return { label: 'Draft ready', detail: String(event.reason || 'Preview ready without scoring'), status: 'ok' };
        }
        return { label: 'Complete', detail: `Score ${event.finalScore ?? 'n/a'} in ${event.duration ?? 0}ms`, status: 'ok' };
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
      'generation.domain_plan',
      'generation.attempt.started',
      'generation.candidate.generated',
      'preview.completed',
      'generation.complete',
      'generation.cognitive_receipt',
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
