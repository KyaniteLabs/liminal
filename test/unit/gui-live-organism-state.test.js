import { describe, it, expect } from 'vitest';
/**
 * GUI live organism state - switch to "Live organism" view and sandbox run updates display (unit tests).
 */

import {
  liveOrganismReducer,
  INITIAL_LIVE_ORGANISM_STATE,
  switchToLiveOrganismView,
  setPreviewRunResult,
} from '../../gui/src/gui/liveOrganismState.js';

describe('GUI live organism state', () => {
  it('initial state has activeTab config and no sandboxUrl', () => {
    expect(INITIAL_LIVE_ORGANISM_STATE.activeTab).toBe('create');
    expect(INITIAL_LIVE_ORGANISM_STATE.previewUrl).toBeNull();
    expect(INITIAL_LIVE_ORGANISM_STATE.runError).toBeNull();
  });

  it('SWITCH_VIEW to live sets activeTab to live', () => {
    const action = switchToLiveOrganismView('live');
    expect(action.type).toBe('SWITCH_VIEW');
    expect(action.tab).toBe('live');
    const next = liveOrganismReducer(INITIAL_LIVE_ORGANISM_STATE, action);
    expect(next.activeTab).toBe('live');
    expect(next.previewUrl).toBeNull();
  });

  it('SWITCH_VIEW to config keeps config tab', () => {
    const state = { ...INITIAL_LIVE_ORGANISM_STATE, activeTab: 'live' };
    const action = switchToLiveOrganismView('config');
    const next = liveOrganismReducer(state, action);
    expect(next.activeTab).toBe('config');
  });

  it('SANDBOX_RUN_RESULT sets sandboxUrl and triggers display update', () => {
    const action = setPreviewRunResult('/preview?version=2');
    expect(action.type).toBe('PREVIEW_RUN_RESULT');
    expect(action.url).toBe('/preview?version=2');
    const next = liveOrganismReducer(INITIAL_LIVE_ORGANISM_STATE, action);
    expect(next.previewUrl).toBe('/preview?version=2');
    expect(next.runError).toBeNull();
  });

  it('SANDBOX_RUN_RESULT with error sets runError', () => {
    const action = setPreviewRunResult(null, 'Network error');
    const next = liveOrganismReducer(INITIAL_LIVE_ORGANISM_STATE, action);
    expect(next.previewUrl).toBeNull();
    expect(next.runError).toBe('Network error');
  });

  it('CLEAR_RUN_RESULT resets sandboxUrl and runError', () => {
    const state = liveOrganismReducer(
      INITIAL_LIVE_ORGANISM_STATE,
      setPreviewRunResult('/preview?version=1')
    );
    const next = liveOrganismReducer(state, { type: 'CLEAR_RUN_RESULT' });
    expect(next.previewUrl).toBeNull();
    expect(next.runError).toBeNull();
  });
});
