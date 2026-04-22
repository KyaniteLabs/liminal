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
  recentActivity: Array<{ label: string; detail: string; status?: string }>;
}

export interface WorkbenchPreview {
  type: 'image' | 'code';
  src?: string;
  code?: string;
  label: string;
}

export function summarizeWorkbenchBridge(
  events: WorkbenchBridgeEvent[],
  now = Date.now(),
): WorkbenchBridgeSummary {
  const derived = deriveCockpit(events as any, now);
  const phase = String(derived.phase || 'idle');
  const active = !['idle', 'complete', 'previewed'].includes(phase);

  return {
    active,
    phase,
    stageTitle: active ? phase : phase === 'complete' ? 'complete' : 'ready',
    stageSubtitle: derived.latestMessage || derived.activeWork || 'No active generation',
    timelineStatus: phase,
    timelinePrimary: derived.activeDomain || derived.plan[0] || 'Generate',
    timelineSecondary: derived.latestMessage || `${derived.elapsedLabel} elapsed · ${derived.etaLabel}`,
    progressPercent: derived.progressPercent,
    recentActivity: summarizeRecentActivity(events),
  };
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
      if (event.type === 'generation.complete') {
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
