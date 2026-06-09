import { describe, it, expect } from 'vitest';
import { getPreviewState } from '../../../src/gui/previewState.js';
import type { GuiIteration } from '../../../src/gui/previewState.js';

describe('getPreviewState', () => {
  const iterations: GuiIteration[] = [
    { id: 1, code: 'osc().out()', timestamp: 1000 },
    { id: 2, code: 'noise().out()', timestamp: 2000 },
    { id: 3, code: 'solid().out()', timestamp: 3000 },
  ];

  it('returns preview URL with version parameter', () => {
    const state = getPreviewState(iterations, 0, '/preview');
    expect(state.previewUrl).toBe('/preview?version=1');
    expect(state.codeContent).toBe('osc().out()');
  });

  it('uses & separator when baseUrl already has query params', () => {
    const state = getPreviewState(iterations, 1, '/preview?domain=hydra');
    expect(state.previewUrl).toBe('/preview?domain=hydra&version=2');
  });

  it('uses ? separator when baseUrl has no query params', () => {
    const state = getPreviewState(iterations, 2, '/preview');
    expect(state.previewUrl).toBe('/preview?version=3');
  });

  it('returns correct code for each index', () => {
    expect(getPreviewState(iterations, 0, '/p').codeContent).toBe('osc().out()');
    expect(getPreviewState(iterations, 1, '/p').codeContent).toBe('noise().out()');
    expect(getPreviewState(iterations, 2, '/p').codeContent).toBe('solid().out()');
  });

  it('returns empty code for out-of-bounds index', () => {
    const state = getPreviewState(iterations, 99, '/preview');
    expect(state.codeContent).toBe('');
    expect(state.previewUrl).toBe('/preview?version=100');
  });

  it('returns empty code for negative index', () => {
    const state = getPreviewState(iterations, -1, '/preview');
    expect(state.codeContent).toBe('');
  });

  it('handles empty iterations array', () => {
    const state = getPreviewState([], 0, '/preview');
    expect(state.codeContent).toBe('');
    expect(state.previewUrl).toBe('/preview?version=1');
  });
});
