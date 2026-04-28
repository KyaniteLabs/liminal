import { describe, expect, it } from 'vitest';
import { buildCognitiveRunReceipt } from '../../../src/runtime-core/CognitiveRunReceipt.js';

describe('buildCognitiveRunReceipt', () => {
  it('turns a run outcome into memory compost dreaming and intuition signals', () => {
    const receipt = buildCognitiveRunReceipt({
      prompt: 'Improve Strudel repair after invalid rhythm output',
      lane: 'self-improvement',
      status: 'failed',
      artifactPaths: [],
      failures: ['Strudel validator rejected rhythm syntax'],
      mutatedFiles: ['src/generators/strudel/StrudelGenerator.ts'],
    });

    expect(receipt.loop).toBe('self-improvement');
    expect(receipt.organs.memory.status).toBe('observed');
    expect(receipt.organs.compost.status).toBe('observed');
    expect(receipt.organs.dreaming.status).toBe('pending');
    expect(receipt.organs.intuition.status).toBe('observed');
    expect(receipt.organs.compost.detail).toContain('Strudel validator rejected rhythm syntax');
    expect(receipt.nextAction.kind).toBe('repair');
    expect(receipt.nextAction.reason).toContain('failed');
  });
});
