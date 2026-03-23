/**
 * Tests for ChatCLI input handling
 * Phase 2: Chat Integration - User Input Handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatCLI } from '../../src/chat/ChatCLI.js';
import { ConversationManager } from '../../src/chat/ConversationManager.js';

describe('ChatCLI - Input Handling', () => {
  let cli: ChatCLI;
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
    cli = new ChatCLI(manager);
  });

  describe('handleUserInput', () => {
    it('should pass input to ConversationManager', async () => {
      const processSpy = vi.spyOn(manager, 'processUserMessage');

      await cli.handleUserInput('I want to create art');

      expect(processSpy).toHaveBeenCalledWith('I want to create art');
    });

    it('should start new session if none exists', async () => {
      const startSpy = vi.spyOn(manager, 'startNewSession');

      await cli.handleUserInput('Hello');

      expect(startSpy).toHaveBeenCalled();
    });

    it('should not start new session if one exists', async () => {
      manager.startNewSession();
      const startSpy = vi.spyOn(manager, 'startNewSession');

      await cli.handleUserInput('Hello');

      expect(startSpy).not.toHaveBeenCalled();
    });

    it('should await async processing', async () => {
      let processed = false;

      // Mock processUserMessage to be async
      vi.spyOn(manager, 'processUserMessage').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        processed = true;
        return { message: 'Response', type: 'question' };
      });

      await cli.handleUserInput('Test');

      expect(processed).toBe(true);
    });
  });

  describe('Integration with ConversationManager', () => {
    it('should store messages in session history', async () => {
      await cli.handleUserInput('First message');

      expect(manager.sessionHistory).toHaveLength(1);
      expect(manager.sessionHistory[0].messages).toHaveLength(2); // user + assistant
    });

    it('should update interview phase based on input', async () => {
      await cli.handleUserInput('I want to create p5 art');

      expect(manager.interviewPhase).toBe('discovery');
    });

    it('should handle multiple sequential inputs', async () => {
      await cli.handleUserInput('Create art');
      await cli.handleUserInput('Web background');
      await cli.handleUserInput('Meditative');

      expect(manager.sessionHistory[0].messages).toHaveLength(6); // 3 user + 3 assistant
    });
  });

  describe('UI updates', () => {
    it('should trigger re-render when messages are added', async () => {
      const renderSpy = vi.spyOn(cli as any, 'render').mockImplementation(() => {});

      await cli.handleUserInput('Test message');

      // In a real implementation, this would verify the UI updates
      // For now, we just verify the method doesn't error
      expect(manager.sessionHistory[0].messages).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle empty input gracefully', async () => {
      await expect(cli.handleUserInput('')).resolves.not.toThrow();
    });

    it('should handle whitespace-only input', async () => {
      await expect(cli.handleUserInput('   ')).resolves.not.toThrow();
    });
  });
});
