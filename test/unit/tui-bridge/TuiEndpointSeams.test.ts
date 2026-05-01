import { describe, expect, it, vi } from 'vitest';
import { TuiControlEndpoints } from '../../../src/tui-bridge/endpoints/TuiControlEndpoints.js';
import { TuiMicPreviewEndpoints } from '../../../src/tui-bridge/endpoints/TuiMicPreviewEndpoints.js';

describe('TUI bridge endpoint seams', () => {
  it('keeps control actions behind a focused endpoint seam', async () => {
    const bridge = {
      confirmAction: vi.fn(async () => undefined),
      cancelAction: vi.fn(),
      cancelRun: vi.fn(),
    };
    const llm = { getConfig: () => ({ model: 'local' }) } as never;
    const controls = new TuiControlEndpoints(bridge, () => llm);

    await expect(controls.confirmAction('s1', 'a1')).resolves.toEqual({ ok: true });
    expect(bridge.confirmAction).toHaveBeenCalledWith('s1', 'a1', llm);
    expect(controls.cancelAction('s1', 'a1')).toEqual({ ok: true });
    expect(controls.cancelRun('s1')).toEqual({ ok: true });
  });

  it('prepares mic preview command receipts without opening a browser', () => {
    const events: Array<{ sessionId: string; event: any }> = [];
    const responses: string[] = [];
    const mic = new TuiMicPreviewEndpoints({
      getStatus: vi.fn(() => ({ sessionId: 's1' } as never)),
      publishEvent: vi.fn((sessionId: string, event: any) => events.push({ sessionId, event })),
      emitCommandResponse: vi.fn((_sessionId: string, message: string) => responses.push(message)),
    }, () => 'http://127.0.0.1:3333');

    expect(mic.handleCommand('s1', { mode: 'chat', text: '/mic' })).toBe(true);
    expect(events.map((item) => item.event.type)).toEqual(['preview.started', 'preview.content', 'activity.updated']);
    expect(events[1].event.content).toContain('Mic preview controls');
    expect(events[2].event.message).toContain('browser auto-open');
    expect(responses[0]).toContain('open this URL manually');
  });

  it('maps mic preview updates to image or music preview events with honest content', () => {
    const events: any[] = [];
    const mic = new TuiMicPreviewEndpoints({
      getStatus: vi.fn(() => ({ sessionId: 's1' } as never)),
      publishEvent: vi.fn((_sessionId: string, event: any) => events.push(event)),
      emitCommandResponse: vi.fn(),
    }, () => 'http://127.0.0.1:3333');

    mic.applyUpdate('s1', { imageBase64: 'abc', done: false });
    mic.applyUpdate('s1', { content: 'RMS: 0.42', done: true });

    expect(events).toEqual([
      { type: 'preview.content', content: 'abc', previewType: 'image' },
      { type: 'preview.completed', content: 'RMS: 0.42', previewType: 'music' },
    ]);
  });
});
