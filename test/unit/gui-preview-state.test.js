/**
 * GUI preview state - selection change updates preview URL and code content (unit test state).
 */

import { getPreviewState } from '../../src/gui/previewState.js';

describe('GUI preview state', () => {
  const baseUrl = 'http://localhost:3456/preview';

  it('returns previewUrl and codeContent for selected index', () => {
    const iterations = [
      { id: 1, code: 'code1', timestamp: 1000 },
      { id: 2, code: 'code2', timestamp: 2000 },
      { id: 3, code: 'code3', timestamp: 3000 },
    ];
    const state = getPreviewState(iterations, 0, baseUrl);
    expect(state.previewUrl).toBe('http://localhost:3456/preview?version=1');
    expect(state.codeContent).toBe('code1');
  });

  it('updates when selectedIndex changes', () => {
    const iterations = [
      { id: 1, code: 'a', timestamp: 0 },
      { id: 2, code: 'b', timestamp: 0 },
    ];
    expect(getPreviewState(iterations, 0, baseUrl).codeContent).toBe('a');
    expect(getPreviewState(iterations, 0, baseUrl).previewUrl).toContain('version=1');
    expect(getPreviewState(iterations, 1, baseUrl).codeContent).toBe('b');
    expect(getPreviewState(iterations, 1, baseUrl).previewUrl).toContain('version=2');
  });

  it('uses version = selectedIndex + 1 in preview URL', () => {
    const iterations = [
      { id: 1, code: 'x', timestamp: 0 },
    ];
    const state = getPreviewState(iterations, 0, 'http://localhost:3456/preview');
    expect(state.previewUrl).toBe('http://localhost:3456/preview?version=1');
  });

  it('returns empty codeContent when no iterations', () => {
    const state = getPreviewState([], 0, baseUrl);
    expect(state.codeContent).toBe('');
    expect(state.previewUrl).toContain('version=1');
  });

  it('returns empty codeContent when selectedIndex out of range', () => {
    const iterations = [{ id: 1, code: 'only', timestamp: 0 }];
    const state = getPreviewState(iterations, 5, baseUrl);
    expect(state.codeContent).toBe('');
  });
});
