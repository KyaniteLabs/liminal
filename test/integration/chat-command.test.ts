import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatCommand, type ChatOptions } from '../../src/chat/commands/chat.js';
import { ConversationManager } from '../../src/chat/ConversationManager.js';
import { ChatCLI } from '../../src/chat/ChatCLI.js';

/**
 * Tests for liminal chat CLI command
 */

describe('chat command', () => {
  let conversationManagerSpy: any;
  let chatCLIRenderSpy: any;

  beforeEach(() => {
    conversationManagerSpy = vi.spyOn(ConversationManager.prototype, 'startNewSession').mockImplementation(() => {});
    chatCLIRenderSpy = vi.spyOn(ChatCLI.prototype, 'render').mockImplementation(() => {});
  });

  afterEach(() => {
    conversationManagerSpy.mockRestore();
    chatCLIRenderSpy.mockRestore();
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

  it('calls ChatCLI.render()', async () => {
    await chatCommand();
    expect(chatCLIRenderSpy).toHaveBeenCalledTimes(1);
  });
});

describe('chat command help text', () => {
  it('help text includes chat command', () => {
    // This will be tested by checking the bin/sinter help output
    // For now, we just verify the command exists
    expect(typeof chatCommand).toBe('function');
  });
});
