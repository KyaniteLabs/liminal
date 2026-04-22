import { describe, expect, it } from 'vitest';
import { summarizeReasoningTrace } from '../../../src/tui-bridge/TraceSummarizer';

describe('TraceSummarizer', () => {
  it('extracts concrete generator decisions instead of generic thinking text', () => {
    const summary = summarizeReasoningTrace(
      'I will use Three.js because the user asked for a glass flower with depth. The flower must breathe slowly, so I will animate petal scale with a sine wave. I am not sure about palette, so I will choose cool luminous cyan and violet.',
      'generator',
    );

    expect(summary.summary).toContain('Three.js');
    expect(summary.summary).toContain('glass flower');
    expect(summary.details.join(' ')).toContain('breathe slowly');
    expect(summary.details.join(' ')).toContain('palette');
  });

  it('extracts evaluator repair causes and fixes', () => {
    const summary = summarizeReasoningTrace(
      'Score 0.42 because the render is visible but does not match the alien flower brief. Missing petal structure and the motion is weak. Fix by adding a clear flower silhouette and audio-reactive breathing.',
      'evaluator',
    );

    expect(summary.summary).toContain('Score 0.42');
    expect(summary.details.join(' ')).toContain('Missing petal');
    expect(summary.details.join(' ')).toContain('Fix by adding');
  });

  it('returns an explicit empty-state summary', () => {
    expect(summarizeReasoningTrace('', 'harness').summary).toBe('No usable reasoning was captured.');
  });
});
