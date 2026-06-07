import { describe, expect, it, vi } from 'vitest';
import { writeCliCognitiveReceipt } from '../../../src/cli/CognitiveReceiptReporter.js';

describe('writeCliCognitiveReceipt', () => {
  it('writes generation results into cognitive organs and returns CLI lines', async () => {
    const writer = {
      writeBackGeneration: vi.fn().mockResolvedValue({
        artifactPath: '/tmp/liminal/cog/p5.js',
        episodeId: 'ep-cli-1',
        receipts: [
          { organ: 'memory', status: 'observed', detail: 'Stored generation episode ep-cli-1 for future retrieval.' },
          { organ: 'compost', status: 'observed', detail: 'Added generated artifact to compost heap.' },
          { organ: 'dreaming', status: 'observed', detail: 'Queued dream recombination task dream-1 from episode ep-cli-1.' },
        ],
      }),
    };

    const lines = await writeCliCognitiveReceipt({
      prompt: 'icebergs dancing in the sky',
      result: {
        code: 'function setup() { createCanvas(100, 100); }',
        finalScore: 0.82,
        iterations: 2,
        model: 'gpt-test',
        reason: 'accepted',
      },
      writer,
      sessionId: 'cli-test',
    });

    expect(writer.writeBackGeneration).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'cli-test',
      userText: 'icebergs dancing in the sky',
      domain: 'p5',
      finalScore: 0.82,
      executionMode: 'prove',
    }));
    expect(lines).toEqual([
      '🧠 What Sinter learned:',
      '  memory: observed — Stored generation episode ep-cli-1 for future retrieval.',
      '  compost: observed — Added generated artifact to compost heap.',
      '  dreaming: observed — Queued dream recombination task dream-1 from episode ep-cli-1.',
      '  artifact: /tmp/liminal/cog/p5.js',
    ]);
  });
});
