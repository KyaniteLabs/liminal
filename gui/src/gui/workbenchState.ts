export type WorkbenchModeId = 'generate' | 'review' | 'evolve' | 'observe' | 'settings';

export interface WorkbenchMode {
  id: WorkbenchModeId;
  label: string;
  legacyTabs: string[];
}

export const WORKBENCH_MODES: WorkbenchMode[] = [
  { id: 'generate', label: 'Generate', legacyTabs: ['create', 'cockpit', 'liveMusic'] },
  { id: 'review', label: 'Review', legacyTabs: ['live', 'curator'] },
  { id: 'evolve', label: 'Evolve', legacyTabs: ['compost'] },
  { id: 'observe', label: 'Observe', legacyTabs: ['activity'] },
  { id: 'settings', label: 'Settings', legacyTabs: ['config'] },
];

export function getWorkbenchMode(tab: string): WorkbenchMode {
  return WORKBENCH_MODES.find((mode) => mode.legacyTabs.includes(tab)) ?? WORKBENCH_MODES[0];
}

export function shouldRenderLegacyPanel(tab: string): boolean {
  return tab !== 'create';
}
