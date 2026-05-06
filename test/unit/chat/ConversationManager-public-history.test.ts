import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ConversationManager } from '../../../src/chat/ConversationManager.js';

describe('ConversationManager public history API', () => {
  it('records and returns current-session messages without exposing mutable history', () => {
    const manager = new ConversationManager();
    manager.startNewSession();

    manager.appendMessage('user', 'build a quiet shader');
    manager.appendMessage('assistant', 'I can do that.');

    const messages = manager.getCurrentSessionMessages();
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);

    messages.push({
      id: 'external-mutation',
      role: 'system',
      content: 'this should not leak back',
      timestamp: new Date(),
    });

    expect(manager.getCurrentSessionMessages().map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('formats prompt context from public history while excluding the latest user turn', () => {
    const manager = new ConversationManager();
    manager.startNewSession();

    manager.appendMessage('user', 'first prompt');
    manager.appendMessage('assistant', 'first response');
    manager.appendMessage('user', 'current prompt');

    expect(manager.getConversationContext({ excludeLatest: true })).toBe('user: first prompt\n\nassistant: first response\n\n');
  });

  it('keeps TuiBridgeService on public conversation APIs', () => {
    const source = readFileSync(join(process.cwd(), 'src/tui-bridge/TuiBridgeService.ts'), 'utf8');

    expect(source).not.toContain("conversation['recordMessage']");
    expect(source).not.toContain("conversation['sessionHistory']");
    expect(source).not.toContain("conversation['currentSession']");
  });
});
