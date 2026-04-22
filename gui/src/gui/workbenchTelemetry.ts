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
