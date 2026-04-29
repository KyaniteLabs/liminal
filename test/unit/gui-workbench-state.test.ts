import { describe, expect, it } from 'vitest';
import { getWorkbenchMode, shouldRenderLegacyPanel, WORKBENCH_MODES } from '../../gui/src/gui/workbenchState';

describe('workbenchState', () => {
  it('maps old tabs into unified workbench modes', () => {
    expect(getWorkbenchMode('create').id).toBe('generate');
    expect(getWorkbenchMode('cockpit').id).toBe('generate');
    expect(getWorkbenchMode('liveMusic').id).toBe('generate');
    expect(getWorkbenchMode('improve').id).toBe('improve');
    expect(getWorkbenchMode('live').id).toBe('review');
    expect(getWorkbenchMode('curator').id).toBe('review');
    expect(getWorkbenchMode('compost').id).toBe('evolve');
    expect(getWorkbenchMode('activity').id).toBe('observe');
    expect(getWorkbenchMode('config').id).toBe('settings');
    expect(WORKBENCH_MODES.map((mode) => mode.id)).toEqual([
      'generate',
      'improve',
      'review',
      'evolve',
      'observe',
      'settings',
    ]);
  });

  it('keeps Generate as the front door and Settings as a secondary destination', () => {
    expect(WORKBENCH_MODES[0]).toMatchObject({ id: 'generate', label: 'Generate' });
    expect(WORKBENCH_MODES.at(-1)).toMatchObject({ id: 'settings', label: 'Settings' });
    expect(getWorkbenchMode('unknown-tab')).toMatchObject({ id: 'generate' });
  });

  it('keeps primary generate out of the legacy panel while preserving migration panels', () => {
    expect(shouldRenderLegacyPanel('create')).toBe(false);
    expect(shouldRenderLegacyPanel('cockpit')).toBe(true);
    expect(shouldRenderLegacyPanel('liveMusic')).toBe(true);
    expect(shouldRenderLegacyPanel('improve')).toBe(false);
    expect(shouldRenderLegacyPanel('curator')).toBe(true);
    expect(shouldRenderLegacyPanel('config')).toBe(true);
  });
});
