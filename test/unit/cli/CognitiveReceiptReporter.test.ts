import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CognitiveWriterLike } from '../../../src/cli/CognitiveReceiptReporter.js';

const { mockWriteBackGeneration } = vi.hoisted(() => ({
  mockWriteBackGeneration: vi.fn(),
}));

vi.mock('../../../src/core/CodeValidator.js', () => ({
  CodeValidator: { detectDomain: vi.fn().mockReturnValue('hydra') },
}));

vi.mock('../../../src/tui-bridge/PostGenerationCognitiveWriter.js', () => ({
  PostGenerationCognitiveWriter: vi.fn(),
}));

import { writeCliCognitiveReceipt } from '../../../src/cli/CognitiveReceiptReporter.js';

describe('writeCliCognitiveReceipt', () => {
  const mockWriter: CognitiveWriterLike = {
    writeBackGeneration: mockWriteBackGeneration,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteBackGeneration.mockResolvedValue({
      artifactPath: '/path/to/artifact.md',
      episodeId: 'ep-123',
      receipts: [
        { organ: 'cortex', status: 'observed' as const, detail: 'learned pattern' },
        { organ: 'dream', status: 'pending' as const, detail: 'queued for dreaming' },
      ],
    });
  });

  it('formats cognitive receipts from write-back', async () => {
    const lines = await writeCliCognitiveReceipt({
      prompt: 'make a sunset',
      result: { code: 'osc().out()', finalScore: 0.85, iterations: 3, model: 'glm-4', reason: 'good' },
      writer: mockWriter,
      sessionId: 'test-session',
    });

    expect(lines[0]).toBe('🧠 What Sinter learned:');
    expect(lines).toContain('  artifact: /path/to/artifact.md');
    expect(lines.some(l => l.includes('cortex') && l.includes('observed'))).toBe(true);
    expect(lines.some(l => l.includes('dream') && l.includes('pending'))).toBe(true);
  });

  it('passes sessionId to writer', async () => {
    await writeCliCognitiveReceipt({
      prompt: 'test',
      result: { code: 'osc().out()', finalScore: 0.9, iterations: 1, model: 'glm', reason: 'ok' },
      writer: mockWriter,
      sessionId: 'custom-session-42',
    });

    expect(mockWriteBackGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'custom-session-42' }),
    );
  });

  it('generates sessionId when not provided', async () => {
    await writeCliCognitiveReceipt({
      prompt: 'test',
      result: { code: 'osc().out()', finalScore: 0.9, iterations: 1, reason: 'ok' },
      writer: mockWriter,
    });

    const call = mockWriteBackGeneration.mock.calls[0][0];
    expect(call.sessionId).toMatch(/^cli-\d+$/);
  });

  it('defaults model to "unknown" when not in result', async () => {
    await writeCliCognitiveReceipt({
      prompt: 'test',
      result: { code: 'osc().out()', finalScore: 0.9, iterations: 1, reason: 'ok' },
      writer: mockWriter,
    });

    expect(mockWriteBackGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'unknown' }),
    );
  });

  it('passes provided model through', async () => {
    await writeCliCognitiveReceipt({
      prompt: 'test',
      result: { code: 'osc().out()', finalScore: 0.9, iterations: 1, model: 'glm-5', reason: 'ok' },
      writer: mockWriter,
    });

    expect(mockWriteBackGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'glm-5' }),
    );
  });

  it('passes executionMode as "prove"', async () => {
    await writeCliCognitiveReceipt({
      prompt: 'test',
      result: { code: 'x', finalScore: 0.5, iterations: 1, reason: 'ok' },
      writer: mockWriter,
      sessionId: 's1',
    });

    expect(mockWriteBackGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ executionMode: 'prove' }),
    );
  });
});
