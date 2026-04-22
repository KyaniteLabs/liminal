/**
 * Live organism view state - tab selection and preview run result.
 * Used by GUI to show "Live organism" tab and iframe URL after Run in preview.
 */

export type GuiTab = 'config' | 'create' | 'cockpit' | 'live' | 'liveMusic' | 'curator' | 'activity' | 'compost';

export interface LiveOrganismState {
  activeTab: GuiTab;
  previewUrl: string | null;
  runError: string | null;
}

export const INITIAL_LIVE_ORGANISM_STATE: LiveOrganismState = {
  activeTab: 'create',
  previewUrl: null,
  runError: null,
};

export type LiveOrganismAction =
  | { type: 'SWITCH_VIEW'; tab: GuiTab }
  | { type: 'PREVIEW_RUN_RESULT'; url: string | null; error?: string | null }
  | { type: 'CLEAR_RUN_RESULT' };

export function liveOrganismReducer(
  state: LiveOrganismState,
  action: LiveOrganismAction
): LiveOrganismState {
  switch (action.type) {
    case 'SWITCH_VIEW':
      return { ...state, activeTab: action.tab };
    case 'PREVIEW_RUN_RESULT':
      return {
        ...state,
        previewUrl: action.url ?? null,
        runError: action.error ?? null,
      };
    case 'CLEAR_RUN_RESULT':
      return { ...state, previewUrl: null, runError: null };
    default:
      return state;
  }
}

/** Switch to Config or Live organism tab. */
export function switchToLiveOrganismView(tab: GuiTab): LiveOrganismAction {
  return { type: 'SWITCH_VIEW', tab };
}

/** Record result of "Run in preview" (url and optional error). */
export function setPreviewRunResult(url: string | null, error?: string | null): LiveOrganismAction {
  return { type: 'PREVIEW_RUN_RESULT', url, error };
}
