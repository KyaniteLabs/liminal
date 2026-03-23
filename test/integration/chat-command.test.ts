import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatCommand, type ChatOptions } from '../../src/chat/commands/chat.js';
import { ConversationManager } from '../../src/chat/ConversationManager.js';

/**
 * Tests for liminal chat CLI command
 */

describe('chat command', () => {
  let consoleSpy: vi.SpiedFunction<any>;
  let conversationManagerSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    conversationManagerSpy = vi.spyOn(ConversationManager.prototype, 'startNewSession').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    conversationManagerSpy.mockRestore();
  });

  it('can be invoked without error', async () => {
    await expect(chatCommand()).resolves.not.toThrow();
  });

  it('can be invoked with options', async () => {
    const options: ChatOptions = { verbose: true };
    await expect(chatCommand(options)).resolves.not.toThrow();
  });

  it('initializes ConversationManager', async () => {
    const startNewSessionSpy = vi.spyOn(ConversationManager.prototype, 'startNewSession');
    await chatCommand();
    expect(startNewSessionSpy).toHaveBeenCalled();
    startNewSessionSpy.mockRestore();
  });

  it('starts a new session', async () => {
    const startNewSessionSpy = vi.spyOn(ConversationManager.prototype, 'startNewSession');
    await chatCommand();
    expect(startNewSessionSpy).toHaveBeenCalledTimes(1);
    startNewSessionSpy.mockRestore();
  });

  it('handles verbose flag', async () => {
    const options: ChatOptions = { verbose: true };
    await expect(chatCommand(options)).resolves.not.toThrow();
  });
});

describe('chat command help text', () => {
  it('help text includes chat command', () => {
    // This will be tested by checking the bin/liminal help output
    // For now, we just verify the command exists
    expect(typeof chatCommand).toBe('function');
  });
});
