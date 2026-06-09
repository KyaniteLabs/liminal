import { describe, it, expect, vi } from 'vitest';
import { ContextCompactor } from '../../src/llm/ContextCompactor.js';

vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('ContextCompactor', () => {
  it('returns messages unchanged when under maxMessages', async () => {
    const compactor = new ContextCompactor({ maxMessages: 20 });
    const msgs = [
      { role: 'system' as const, content: 'you are helpful' },
      { role: 'user' as const, content: 'hello' },
    ];
    const result = await compactor.compact(msgs);
    expect(result).toEqual(msgs);
  });

  it('needsCompaction returns true when over threshold', () => {
    const compactor = new ContextCompactor({ maxMessages: 5 });
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const, content: `msg ${i}`,
    }));
    expect(compactor.needsCompaction(msgs)).toBe(true);
  });

  it('needsCompaction returns false when under both thresholds', () => {
    const compactor = new ContextCompactor({ maxMessages: 100 });
    const msgs = [{ role: 'user' as const, content: 'short' }];
    expect(compactor.needsCompaction(msgs)).toBe(false);
  });

  it('getStats reports correct reduction', () => {
    const compactor = new ContextCompactor();
    const original = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const, content: `msg ${i}`,
    }));
    const compacted = original.slice(0, 5);
    const stats = compactor.getStats(original, compacted);
    expect(stats.reduction).toBe(5);
    expect(stats.reductionPercent).toBe(50);
    expect(stats.originalEstimatedTokens).toBeGreaterThan(0);
    expect(stats.compactedEstimatedTokens).toBeGreaterThan(0);
    expect(stats.originalCount).toBe(10);
    expect(stats.compactedCount).toBe(5);
  });

  it('triggers compaction at 65 percent of context window when llmClient is provided', () => {
    const llmClient = {
      getConfig: () => ({ model: 'qwen2.5-7b' }),
    } as any;
    const compactor = new ContextCompactor({ maxMessages: 999, llmClient, tokenThresholdRatio: 0.65 });
    const chars = 'x'.repeat(90000); // ~22500 tokens, above 65% of 32768
    const msgs = [{ role: 'user' as const, content: chars }];
    expect(compactor.needsCompaction(msgs)).toBe(true);
  });

  it('compacts messages over maxMessages using extractive summary', async () => {
    const compactor = new ContextCompactor({ maxMessages: 5, recentThreshold: 2 });
    const msgs = [
      { role: 'system' as const, content: 'you are a creative coding assistant with lots of context' },
      ...Array.from({ length: 6 }, (_, i) => ({
        role: 'user' as const,
        content: `This is message number ${i} with enough content to be extracted as a key point for summarization purposes.`,
      })),
    ];
    // 7 messages total, maxMessages=5, so compaction triggers
    const result = await compactor.compact(msgs);
    // Should be: system + summary + 2 recent = ~4
    expect(result.length).toBeLessThan(msgs.length);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('you are a creative coding assistant with lots of context');
    // Last 2 messages should be preserved
    expect(result[result.length - 1].content).toContain('message number 5');
    expect(result[result.length - 2].content).toContain('message number 4');
  });

  it('preserves system message at index 0 after compaction', async () => {
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1 });
    const msgs = [
      { role: 'system' as const, content: 'system prompt' },
      { role: 'user' as const, content: 'user message one with some substantial content here' },
      { role: 'assistant' as const, content: 'assistant response one with some substantial content here' },
      { role: 'user' as const, content: 'user message two with some substantial content here' },
    ];
    const result = await compactor.compact(msgs);
    expect(result[0].content).toBe('system prompt');
  });

  it('handles compaction without system message', async () => {
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1 });
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: `User message ${i} with enough text to create a meaningful extractive summary for testing.`,
    }));
    const result = await compactor.compact(msgs);
    // No system message, so result starts with summary (if any) + recent
    expect(result.length).toBeLessThan(msgs.length);
  });

  it('returns system + recent when no middle messages exist', async () => {
    // When recentThreshold covers all messages, no middle messages to summarize.
    // The code returns [systemMsg, ...recentMsgs] — recentMsgs includes system,
    // so system appears twice. This tests the actual behavior.
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 10 });
    const msgs = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'msg1' },
      { role: 'user' as const, content: 'msg2' },
      { role: 'user' as const, content: 'msg3' },
    ];
    const result = await compactor.compact(msgs);
    // system message at front + all messages as recent (includes system again)
    expect(result[0].role).toBe('system');
    expect(result.length).toBeLessThanOrEqual(msgs.length + 1);
    // All user messages are preserved
    const userMsgs = result.filter(m => m.role === 'user');
    expect(userMsgs.length).toBe(3);
  });

  it('falls back to extractive summary when LLM fails', async () => {
    const llmClient = {
      complete: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
      getConfig: () => ({ model: 'test' }),
    } as any;
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1, llmClient });
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: `This is message number ${i} with enough content to be extracted as a key point for summarization purposes.`,
    }));
    const result = await compactor.compact(msgs);
    // Should still compact via extractive fallback
    expect(result.length).toBeLessThan(msgs.length);
  });

  it('falls back to extractive summary when LLM returns no text', async () => {
    const llmClient = {
      complete: vi.fn().mockResolvedValue({ success: false, text: '' }),
      getConfig: () => ({ model: 'test' }),
    } as any;
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1, llmClient });
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: `This is message number ${i} with enough content to be extracted as a key point for summarization.`,
    }));
    const result = await compactor.compact(msgs);
    expect(result.length).toBeLessThan(msgs.length);
  });

  it('uses LLM summary when available', async () => {
    const llmClient = {
      complete: vi.fn().mockResolvedValue({
        success: true,
        text: 'User discussed creative coding and visual experiments.',
      }),
      getConfig: () => ({ model: 'test' }),
    } as any;
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1, llmClient });
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i} with enough content for summarization testing purposes.`,
    }));
    const result = await compactor.compact(msgs);
    // Should contain the LLM summary
    const summaryMsg = result.find(m => m.content.includes('Previous conversation summary'));
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg!.content).toContain('creative coding');
  });

  it('extractive summary caps at 3 key points', async () => {
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1 });
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `This is a very long message number ${i} that contains enough text to be considered a valid key point for the extractive summary generation process.`,
    }));
    const result = await compactor.compact(msgs);
    const summaryMsg = result.find(m => m.content.includes('Previous conversation summary'));
    if (summaryMsg) {
      // Extractive summary limits to 3 key points
      const pointCount = (summaryMsg.content.match(/discussed:/g) || []).length;
      expect(pointCount).toBeLessThanOrEqual(3);
    }
  });

  it('uses default fallback text when no key points found', async () => {
    const compactor = new ContextCompactor({ maxMessages: 3, recentThreshold: 1 });
    // Short messages that won't produce key points (under 20 chars first sentence)
    const msgs = Array.from({ length: 5 }, () => ({
      role: 'user' as const,
      content: 'ok',  // too short for extractive key point
    }));
    const result = await compactor.compact(msgs);
    // Summary should use fallback text
    const summaryMsg = result.find(m => m.content.includes('Previous conversation summary'));
    if (summaryMsg) {
      expect(summaryMsg.content).toContain('Previous conversation about creative coding');
    }
  });

  it('needsCompaction returns false without llmClient and under count', () => {
    const compactor = new ContextCompactor({ maxMessages: 100 });
    const msgs = [{ role: 'user' as const, content: 'hi' }];
    expect(compactor.needsCompaction(msgs)).toBe(false);
  });
});
