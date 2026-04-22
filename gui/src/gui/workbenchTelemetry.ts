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
    stageSubtitle: derived.activeWork || 'No active generation',
    timelineStatus: phase,
    timelinePrimary: derived.activeDomain || derived.plan[0] || 'Generate',
    timelineSecondary: `${derived.elapsedLabel} elapsed · ${derived.etaLabel}`,
    progressPercent: derived.progressPercent,
  };
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
