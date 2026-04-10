/**
 * GUI Live Organism State - Redux-style state management for live organism view
 */

export interface LiveOrganismState {
  activeTab: 'config' | 'live';
  sandboxUrl: string | null;
  runError: string | null;
}

export const INITIAL_LIVE_ORGANISM_STATE: LiveOrganismState = {
  activeTab: 'config',
  sandboxUrl: null,
  runError: null,
};

export interface SwitchViewAction {
  type: 'SWITCH_VIEW';
  tab: 'config' | 'live';
}

export interface SandboxRunResultAction {
  type: 'SANDBOX_RUN_RESULT';
  url: string;
}

export type LiveOrganismAction = SwitchViewAction | SandboxRunResultAction;

export function liveOrganismReducer(
  state: LiveOrganismState = INITIAL_LIVE_ORGANISM_STATE,
  action: LiveOrganismAction
): LiveOrganismState {
  switch (action.type) {
    case 'SWITCH_VIEW':
      return {
        ...state,
        activeTab: action.tab,
      };
    case 'SANDBOX_RUN_RESULT':
      return {
        ...state,
        sandboxUrl: action.url,
      };
    default:
      return state;
  }
}

export function switchToLiveOrganismView(tab: 'config' | 'live'): SwitchViewAction {
  return {
    type: 'SWITCH_VIEW',
    tab,
  };
}

export function setSandboxRunResult(url: string): SandboxRunResultAction {
  return {
    type: 'SANDBOX_RUN_RESULT',
    url,
  };
}
