import { describe, expect, it } from 'vitest';
import { buildGuiBridgeInput } from '../../gui/bridgeInput.js';

describe('gui bridge input forwarding', () => {
  it('forwards optional creative generation controls and preference answers', () => {
    const input = buildGuiBridgeInput({
      mode: 'chat',
      text: 'make a kinetic aurora sketch',
      clientIntent: 'creative',
      executionMode: 'draft',
      maxIterations: 1,
      candidateCount: 2,
      timeoutMinutes: 3,
      creativePreferences: { color: 'cool blue-green', motion: 'slow orbit' },
      guidanceAnswers: { contrast: 'high contrast' },
      internalOnly: 'do not forward',
    });

    expect(input).toEqual({
      mode: 'chat',
      text: 'make a kinetic aurora sketch',
      clientIntent: 'creative',
      executionMode: 'draft',
      maxIterations: 1,
      candidateCount: 2,
      timeoutMinutes: 3,
      creativePreferences: { color: 'cool blue-green', motion: 'slow orbit' },
      guidanceAnswers: { contrast: 'high contrast' },
    });
  });

  it('keeps the existing chat defaults when optional fields are absent', () => {
    expect(buildGuiBridgeInput(null)).toEqual({
      mode: 'chat',
      text: '',
      clientIntent: undefined,
    });
  });

  it('treats array bodies as empty input instead of forwarding indexed values', () => {
    const body = [];
    body.mode = 'action';
    body.text = 'array payload';
    body.creativePreferences = { color: 'red' };

    expect(buildGuiBridgeInput(body)).toEqual({
      mode: 'chat',
      text: '',
      clientIntent: undefined,
    });
  });

});
