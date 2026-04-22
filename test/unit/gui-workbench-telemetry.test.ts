import { describe, expect, it } from 'vitest';
import { latestBridgePreview, summarizeWorkbenchBridge } from '../../gui/src/gui/workbenchTelemetry';

describe('workbenchTelemetry', () => {
  it('summarizes bridge generation progress for the workbench shell', () => {
    const now = Date.parse('2026-04-22T12:02:00.000Z');
    const startedAt = '2026-04-22T12:00:00.000Z';

    const summary = summarizeWorkbenchBridge([
      { type: 'generation.domain_plan', domains: ['three', 'p5'], startedAt, timeoutMinutes: 5, candidateCount: 3 },
      { type: 'generation.attempt.started', domain: 'three', attempt: 1, attemptTotal: 2, startedAt, timeoutMinutes: 5, candidateCount: 3 },
    ], now);

    expect(summary.active).toBe(true);
    expect(summary.phase).toBe('waiting on model');
    expect(summary.stageTitle).toBe('waiting on model');
    expect(summary.timelinePrimary).toBe('three');
    expect(summary.timelineSecondary).toContain('up to');
  });

  it('extracts the latest image preview as a browser-renderable data URL', () => {
    const preview = latestBridgePreview([
      { type: 'preview.completed', previewType: 'code', content: 'function setup() {}' },
      { type: 'preview.completed', previewType: 'image', content: 'ZmFrZS1wbmc=', imageUrl: '/tmp/render.png' },
    ]);

    expect(preview?.type).toBe('image');
    expect(preview?.src).toBe('data:image/png;base64,ZmFrZS1wbmc=');
    expect(preview?.label).toBe('/tmp/render.png');
  });

  it('uses the newest preview event instead of an older image preview', () => {
    const preview = latestBridgePreview([
      { type: 'preview.completed', previewType: 'image', content: 'b2xkLWltYWdl', imageUrl: '/tmp/old.png' },
      { type: 'preview.completed', previewType: 'code', content: 'function setup() {}' },
    ]);

    expect(preview?.type).toBe('code');
    expect(preview?.code).toContain('function setup');
  });
});
