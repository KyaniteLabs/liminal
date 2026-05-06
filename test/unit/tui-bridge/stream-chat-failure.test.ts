import { afterEach, describe, expect, it } from 'vitest';

import { ConversationManager } from '../../../src/chat/ConversationManager.js';
import { TuiBridgeService } from '../../../src/tui-bridge/TuiBridgeService.js';

const services: TuiBridgeService[] = [];

function makeService(): TuiBridgeService {
  const service = new TuiBridgeService();
  services.push(service);
  return service;
}

describe('TuiBridgeService stream chat failure handling', () => {
  afterEach(() => {
    while (services.length > 0) {
      services.pop()?.destroy();
    }
  });

  it('emits an error instead of an empty completed response when LLM streaming fails', async () => {
    const service = makeService();
    const session = service.createSession();
    const conversation = new ConversationManager();
    conversation.startNewSession();
    (conversation as any).recordMessage('user', 'hello');

    const llm = {
      getConfig: () => ({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
      async *stream() {
        throw new Error('fallback stream failed');
      },
    };

    await expect((service as any).streamChatResponse(
      session.sessionId,
      'hello',
      conversation,
      llm,
    )).rejects.toThrow('fallback stream failed');

    const events = service.getEvents(session.sessionId);
    expect(events.some((event) => event.type === 'error' && event.message.includes('fallback stream failed'))).toBe(true);
    expect(events.some((event) => event.type === 'response.completed' && event.content === '')).toBe(false);
    expect((conversation as any).sessionHistory[0].messages.map((message: { role: string }) => message.role))
      .toEqual(['user']);
  });
});
