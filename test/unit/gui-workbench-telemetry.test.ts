import { describe, expect, it } from 'vitest';
import { latestBridgePreview, latestClarificationRequest, latestCognitiveReceipt, summarizeImproveLane, summarizeWorkbenchBridge } from '../../gui/src/gui/workbenchTelemetry';

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
    expect(summary.processSteps.map((step) => [step.id, step.status])).toEqual([
      ['intent', 'done'],
      ['route', 'done'],
      ['draft', 'active'],
      ['preview', 'pending'],
      ['ready', 'pending'],
    ]);
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
    expect(summary.processSteps[0]).toMatchObject({
      id: 'intent',
      status: 'needs-input',
      detail: 'needs answer',
    });
  });

  it('keeps the latest unresolved clarification available for the workbench form', () => {
    const request = latestClarificationRequest([
      {
        type: 'generation.intent_brief',
        userRequest: 'icebergs',
        requirements: ['Primary request: icebergs'],
        missingDetails: ['subject'],
        questions: ['What is the main subject?'],
        willClarify: true,
      },
      {
        type: 'generation.clarification_needed',
        questions: ['What is the main subject?'],
        reason: 'Prompt is vague.',
      },
    ]);

    expect(request).toEqual({
      question: 'What is the main subject?',
      reason: 'Prompt is vague.',
    });
  });

  it('clears clarification once generation has moved on', () => {
    const request = latestClarificationRequest([
      {
        type: 'generation.clarification_needed',
        questions: ['What is the main subject?'],
        reason: 'Prompt is vague.',
      },
      { type: 'generation.domain_plan', domains: ['three'] },
    ]);

    expect(request).toBeNull();
  });

  it('surfaces stage timing receipts after a draft run completes', () => {
    const summary = summarizeWorkbenchBridge([
      { type: 'generation.domain_plan', domains: ['three'], startedAt: '2026-04-22T12:00:00.000Z', timeoutMinutes: 1, candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.attempt.started', domain: 'three', attempt: 1, attemptTotal: 1, startedAt: '2026-04-22T12:00:05.000Z', timeoutMinutes: 1, candidateCount: 1, executionMode: 'draft' },
      { type: 'preview.completed', previewType: 'code', content: 'function setup() {}', receivedAt: Date.parse('2026-04-22T12:00:09.000Z') },
      { type: 'generation.complete', finalScore: 0, duration: 9000, model: 'qwen', reason: 'draft artifact ready (unscored)', qualityState: 'unscored', executionMode: 'draft', receivedAt: Date.parse('2026-04-22T12:00:09.000Z') },
    ]);

    expect(summary.recentActivity.at(-1)?.label).toBe('Draft ready');
    expect(summary.active).toBe(false);
    expect(summary.stageTimings).toEqual([
      { label: 'Plan', durationLabel: '5s' },
      { label: 'Generate', durationLabel: '4s' },
    ]);
    expect(summary.processSteps.map((step) => step.status)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('surfaces prove-mode generation, evaluation, and render timings separately', () => {
    const summary = summarizeWorkbenchBridge([
      { type: 'generation.domain_plan', domains: ['three'], startedAt: '2026-04-22T12:00:00.000Z', timeoutMinutes: 3, candidateCount: 1, executionMode: 'prove' },
      { type: 'generation.attempt.started', domain: 'three', attempt: 1, attemptTotal: 1, startedAt: '2026-04-22T12:00:02.000Z', timeoutMinutes: 3, candidateCount: 1, executionMode: 'prove' },
      {
        type: 'generation.iteration',
        iteration: 1,
        score: 0.84,
        code: 'function setup() {}',
        stageTimings: [
          { label: 'Generate', durationMs: 1800 },
          { label: 'Evaluate', durationMs: 700 },
        ],
      },
      { type: 'generation.complete', finalScore: 0.84, duration: 2500, model: 'qwen', reason: 'accepted', qualityState: 'scored', executionMode: 'prove', receivedAt: Date.parse('2026-04-22T12:00:05.000Z') },
      { type: 'preview.completed', previewType: 'image', content: 'ZmFrZQ==', imageUrl: '/tmp/render.png', receivedAt: Date.parse('2026-04-22T12:00:06.200Z') },
    ]);

    expect(summary.stageTimings).toEqual([
      { label: 'Plan', durationLabel: '2s' },
      { label: 'Generate', durationLabel: '1.8s' },
      { label: 'Evaluate', durationLabel: '700ms' },
      { label: 'Render', durationLabel: '1.2s' },
    ]);
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

  it('summarizes self-healing improvement proposal events for the Improve lane', () => {
    const lane = summarizeImproveLane([
      {
        type: 'self_healing.proposal',
        runType: 'improve',
        proposalId: 'improve-preview-latency',
        title: 'Reduce preview time',
        category: 'performance optimization',
        score: 88,
        confidence: 'high',
        risk: 'low',
        measurableTarget: 'Reduce time to preview below 10s',
        expectedVerification: ['pnpm test -- gui-workbench-telemetry'],
      },
    ]);

    expect(lane.heading).toBe('Improve');
    expect(lane.proposals).toHaveLength(1);
    expect(lane.proposals[0]).toEqual(expect.objectContaining({
      id: 'improve-preview-latency',
      category: 'performance optimization',
      score: 88,
      measurableTarget: 'Reduce time to preview below 10s',
    }));
  });

  it('extracts detailed cognitive receipt cards for what Liminal learned', () => {
    const receipt = latestCognitiveReceipt([
      {
        type: 'generation.cognitive_receipt',
        loop: 'creative',
        receipts: [
          { organ: 'memory', status: 'observed', detail: 'Stored generation episode ep-123 for future retrieval.' },
          { organ: 'compost', status: 'observed', detail: 'Added generated artifact to compost heap.' },
          { organ: 'dreaming', status: 'pending', detail: 'Dream queue is full; no recombination task was queued.' },
        ],
      },
    ]);

    expect(receipt?.heading).toBe('What Liminal learned');
    expect(receipt?.items).toEqual([
      { organ: 'memory', status: 'observed', detail: 'Stored generation episode ep-123 for future retrieval.' },
      { organ: 'compost', status: 'observed', detail: 'Added generated artifact to compost heap.' },
      { organ: 'dreaming', status: 'pending', detail: 'Dream queue is full; no recombination task was queued.' },
    ]);
  });

});
