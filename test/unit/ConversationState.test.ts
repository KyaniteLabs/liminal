import { describe, it, expect } from 'vitest';
import { ConversationState } from '../../src/llm/ConversationState.js';

describe('ConversationState', () => {
  it('tracks turns and estimatedTokens', () => {
    const state = new ConversationState();
    state.setSystemPrompt('You are helpful');
    state.addUserMessage('hello');
    state.addAssistantResponse('hi there');
    expect(state.length).toBe(2);
    expect(state.estimatedTokens).toBeGreaterThan(0);
    expect(state.getSystemPrompt()).toBe('You are helpful');
  });

  it('formats OpenAI messages correctly', () => {
    const state = new ConversationState();
    state.addUserMessage('ping');
    const msgs = state.getOpenAIMessages();
    expect(msgs).toEqual([{ role: 'user', content: 'ping' }]);
  });

  it('clear resets state', () => {
    const state = new ConversationState();
    state.addUserMessage('hello');
    state.clear();
    expect(state.length).toBe(0);
    expect(state.getSystemPrompt()).toBeNull();
  });

  it('getPreviousResponseId returns last responseId', () => {
    const state = new ConversationState();
    state.addAssistantResponse('a', { responseId: 'r1' });
    state.addAssistantResponse('b', { responseId: 'r2' });
    expect(state.getPreviousResponseId()).toBe('r2');
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('handles empty string messages', () => {
    const state = new ConversationState();
    state.addUserMessage('');
    state.addAssistantResponse('');
    expect(state.length).toBe(2);
    expect(state.estimatedTokens).toBe(0);
    const msgs = state.getOpenAIMessages();
    expect(msgs[0].content).toBe('');
    expect(msgs[1].content).toBe('');
  });

  it('handles assistant response before user message', () => {
    const state = new ConversationState();
    state.addAssistantResponse('I spoke first');
    state.addUserMessage('hello');
    expect(state.length).toBe(2);
    const msgs = state.getOpenAIMessages();
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[1].role).toBe('user');
  });

  it('getAnthropicMessages formats thinking blocks as content blocks', () => {
    const state = new ConversationState();
    state.addUserMessage('think hard');
    state.addAssistantResponse('answer', {
      thinkingBlocks: [
        { type: 'thinking', thinking: 'deep thought', signature: 'sig123' },
      ],
    });
    const msgs = state.getAnthropicMessages();
    expect(msgs).toHaveLength(2);
    // User message stays plain
    expect(msgs[0]).toEqual({ role: 'user', content: 'think hard' });
    // Assistant message becomes content blocks array
    const assistantContent = msgs[1].content as unknown[];
    expect(assistantContent).toHaveLength(2);
    expect(assistantContent[0]).toEqual({ type: 'thinking', thinking: 'deep thought', signature: 'sig123' });
    expect(assistantContent[1]).toEqual({ type: 'text', text: 'answer' });
  });

  it('getAnthropicMessages omits signature when undefined', () => {
    const state = new ConversationState();
    state.addAssistantResponse('plain', {
      thinkingBlocks: [{ type: 'thinking', thinking: 'no sig' }],
    });
    const msgs = state.getAnthropicMessages();
    const block = (msgs[0].content as unknown[])[0] as Record<string, unknown>;
    expect(block.signature).toBeUndefined();
  });

  it('getPreviousResponseId returns null when no assistant responses exist', () => {
    const state = new ConversationState();
    state.addUserMessage('hello');
    expect(state.getPreviousResponseId()).toBeNull();
  });

  it('getPreviousResponseId returns null on empty state', () => {
    const state = new ConversationState();
    expect(state.getPreviousResponseId()).toBeNull();
  });

  it('estimatedTokens accounts for Unicode content', () => {
    const state = new ConversationState();
    // Unicode chars are multi-byte but chars/4 underestimates
    state.addUserMessage('日本語テスト');
    const tokens = state.estimatedTokens;
    // 6 chars / 4 = 1.5 → ceil = 2
    expect(tokens).toBe(2);
  });

  it('system prompt survives getOpenAIMessages', () => {
    const state = new ConversationState();
    state.setSystemPrompt('Be concise');
    state.addUserMessage('hi');
    // OpenAI messages don't include system prompt in the array
    const msgs = state.getOpenAIMessages();
    expect(msgs).toHaveLength(1);
    expect(state.getSystemPrompt()).toBe('Be concise');
  });

  it('clear resets estimatedTokens to 0', () => {
    const state = new ConversationState();
    state.addUserMessage('some content here');
    expect(state.estimatedTokens).toBeGreaterThan(0);
    state.clear();
    expect(state.estimatedTokens).toBe(0);
  });
});
