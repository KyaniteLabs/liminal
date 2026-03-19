/**
 * Live organism view state - tab selection and sandbox run result.
 * Used by GUI to show "Live organism" tab and iframe URL after Run in sandbox.
 */

export type GuiTab = 'config' | 'create' | 'live' | 'liveMusic';

export interface LiveOrganismState {
  activeTab: GuiTab;
  sandboxUrl: string | null;
  runError: string | null;
}

export const INITIAL_LIVE_ORGANISM_STATE: LiveOrganismState = {
  activeTab: 'config',
  sandboxUrl: null,
  runError: null,
};

export type LiveOrganismAction =
  | { type: 'SWITCH_VIEW'; tab: GuiTab }
  | { type: 'SANDBOX_RUN_RESULT'; url: string | null; error?: string | null }
  | { type: 'CLEAR_RUN_RESULT' };

export function liveOrganismReducer(
  state: LiveOrganismState,
  action: LiveOrganismAction
): LiveOrganismState {
  switch (action.type) {
    case 'SWITCH_VIEW':
      return { ...state, activeTab: action.tab };
    case 'SANDBOX_RUN_RESULT':
      return {
        ...state,
        sandboxUrl: action.url ?? null,
        runError: action.error ?? null,
      };
    case 'CLEAR_RUN_RESULT':
      return { ...state, sandboxUrl: null, runError: null };
    default:
      return state;
  }
}

/** Switch to Config or Live organism tab. */
export function switchToLiveOrganismView(tab: GuiTab): LiveOrganismAction {
  return { type: 'SWITCH_VIEW', tab };
}

/** Record result of "Run in sandbox" (url and optional error). */
export function setSandboxRunResult(url: string | null, error?: string | null): LiveOrganismAction {
  return { type: 'SANDBOX_RUN_RESULT', url, error };
}
