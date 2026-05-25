import { describe, expect, it } from 'vitest';
import {
  buildStudioComposerSubmission,
  routeStudioComposerMessage,
} from '../../../gui/src/gui/studioConversation';
import type { WorkbenchRunReceipt } from '../../../gui/src/gui/workbenchTelemetry';

const receipt: WorkbenchRunReceipt = {
  heading: 'Run receipt',
  phase: 'generation',
  outcome: 'completed',
  creativeDomain: 'p5',
  providerModel: 'minimax / MiniMax-M2.7',
  artifact: { label: 'p5 sketch', path: 'artifacts/p5.js' },
  preview: { type: 'code', inline: true, label: 'Inline preview' },
  details: [],
};

describe('Studio composer conversation routing', () => {
  it('treats a message after a preview as a revision of the current artifact', () => {
    expect(routeStudioComposerMessage('make it slower and more nocturnal', {
      hasCurrentArtifact: true,
    })).toEqual({ intent: 'revise', revisionKind: 'revise' });
  });

  it('does not trigger generation for receipt/detail requests', () => {
    expect(routeStudioComposerMessage('show me the receipt', {
      hasCurrentArtifact: true,
    })).toEqual({ intent: 'inspect' });
  });

  it('carries the prior run receipt when building a follow-up submission', () => {
    const submission = buildStudioComposerSubmission({
      message: 'make it slower',
      mode: 'p5',
      executionMode: 'draft',
      maxIterations: 5,
      timeoutMinutes: 30,
      hasCurrentArtifact: true,
      priorRunReceipt: receipt,
    });

    expect(submission.kind).toBe('submit');
    if (submission.kind !== 'submit') return;
    expect(submission.options.creativePreferences).toEqual({
      priorRunReceipt: receipt,
      revisionKind: 'revise',
    });
    expect(submission.prompt).toContain('User prompt: make it slower');
  });
});
