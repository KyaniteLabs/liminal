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

  it('surfaces intent brief and tool activity in the default timeline summary', () => {
    const summary = summarizeWorkbenchBridge([
      {
        type: 'generation.intent_brief',
        userRequest: 'make a purple alien dancing on a 4d flower',
        requirements: ['Primary request: make a purple alien dancing on a 4d flower'],
        missingDetails: [],
        questions: [],
        willClarify: false,
      },
      {
        type: 'tool.started',
        toolName: 'generator',
        displayLabel: 'Generating 3 svg candidates',
      },
      {
        type: 'generation.reasoning_trace',
        source: 'generator',
        phase: 'generator-thinking',
        thought: 'The selected generator focused on the flower form.',
      },
    ]);

    expect(summary.recentActivity.map((item) => item.label)).toEqual(['Intent brief', 'generator', 'generator Reasoning: generator-thinking']);
    expect(summary.recentActivity[0].detail).toContain('purple alien');
    expect(summary.timelineSecondary).toContain('The selected generator focused');
  });

  it('marks clarification requests as active work instead of silently generating', () => {
    const summary = summarizeWorkbenchBridge([
      {
        type: 'generation.intent_brief',
        userRequest: 'make it cooler',
        requirements: ['Primary request: make it cooler'],
        missingDetails: ['subject'],
        questions: ['What should be cooler?'],
        willClarify: true,
      },
      {
        type: 'generation.clarification_needed',
        questions: ['What should be cooler?'],
        reason: 'Prompt is vague.',
      },
    ]);

    expect(summary.recentActivity.at(-1)?.status).toBe('needs-input');
    expect(summary.recentActivity.at(-1)?.detail).toContain('What should be cooler');
    expect(summary.phase).toBe('clarifying intent');
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
