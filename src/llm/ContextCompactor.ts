/**
 * ContextCompactor - Auto-summarize conversation history to prevent context overflow
 * 
 * Strategy:
 * 1. Keep system message (always first)
 * 2. Keep recent N messages (default 10)
 * 3. Summarize middle messages into a single "memory" message
 * 
 * This maintains context window while preserving important information.
 */

import type { LLMClient } from './LLMClient.js';

interface CompactorMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface CompactorOptions {
  maxMessages?: number;
  recentThreshold?: number;
  llmClient?: LLMClient;
}

export class ContextCompactor {
  private maxMessages: number;
  private recentThreshold: number;
  private llmClient?: LLMClient;

  constructor(options: CompactorOptions = {}) {
    this.maxMessages = options.maxMessages || 20;
    this.recentThreshold = options.recentThreshold || 10;
    this.llmClient = options.llmClient;
  }

  /**
   * Compact messages if they exceed maxMessages
   * Returns compacted array or original if under threshold
   */
  async compact(messages: CompactorMessage[]): Promise<CompactorMessage[]> {
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    // Extract system message (always keep it first)
    const systemMsgIndex = messages.findIndex(m => m.role === 'system');
    const systemMsg = systemMsgIndex >= 0 ? messages[systemMsgIndex] : null;
    
    // Get recent messages (always keep these)
    const recentMsgs = messages.slice(-this.recentThreshold);
    
    // Get middle messages (to be summarized)
    const startIdx = systemMsgIndex >= 0 ? systemMsgIndex + 1 : 0;
    const endIdx = messages.length - this.recentThreshold;
    const middleMsgs = messages.slice(startIdx, endIdx);

    if (middleMsgs.length === 0) {
      return systemMsg ? [systemMsg, ...recentMsgs] : recentMsgs;
    }

    // Generate summary
    const summary = await this.summarize(middleMsgs);

    // Build compacted array
    const result: CompactorMessage[] = [];
    
    if (systemMsg) {
      result.push(systemMsg);
    }

    if (summary) {
      result.push({
        role: 'system',
        content: `Previous conversation summary: ${summary}`,
        timestamp: new Date().toISOString(),
      });
    }

    result.push(...recentMsgs);

    return result;
  }

  /**
   * Summarize a list of messages into a brief summary
   * Uses LLM if available, falls back to extraction
   */
  private async summarize(messages: CompactorMessage[]): Promise<string> {
    // Simple extraction if no LLM
    if (!this.llmClient) {
      return this.extractiveSummary(messages);
    }

    // LLM-based summarization
    try {
      const conversation = messages
        .map(m => `${m.role}: ${m.content.slice(0, 300)}`)
        .join('\n\n');

      const prompt = `Summarize this conversation briefly (2-3 sentences). Focus on key topics, decisions, and context needed to continue:\n\n${conversation}`;

      const response = await this.llmClient.complete({
        prompt,
        maxTokens: 150,
        temperature: 0.3,
      });

      if (response.success && response.text) {
        return response.text.trim();
      }
    } catch {
      // Fall back to extractive
    }

    return this.extractiveSummary(messages);
  }

  /**
   * Extractive summary: key sentences from messages
   */
  private extractiveSummary(messages: CompactorMessage[]): string {
    const keyPoints: string[] = [];

    for (const msg of messages) {
      // Extract first sentence or key phrases
      const content = msg.content.slice(0, 200);
      const firstSentence = content.split(/[.!?]/)[0];
      
      if (firstSentence.length > 20) {
        keyPoints.push(`${msg.role} discussed: ${firstSentence.trim()}`);
      }

      // Limit points
      if (keyPoints.length >= 3) break;
    }

    return keyPoints.join('; ') || 'Previous conversation about creative coding';
  }

  /**
   * Check if compaction is needed
   */
  needsCompaction(messages: CompactorMessage[]): boolean {
    return messages.length > this.maxMessages;
  }

  /**
   * Get compaction stats
   */
  getStats(messages: CompactorMessage[], compacted: CompactorMessage[]) {
    return {
      originalCount: messages.length,
      compactedCount: compacted.length,
      reduction: messages.length - compacted.length,
      reductionPercent: Math.round(((messages.length - compacted.length) / messages.length) * 100),
    };
  }
}
