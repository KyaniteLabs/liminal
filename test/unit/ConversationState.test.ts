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
});
