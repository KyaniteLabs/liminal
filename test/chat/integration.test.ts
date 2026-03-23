/**
 * Integration tests for chat input handling
 * Phase 2: Chat Integration - End-to-End Input Flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../../src/chat/ConversationManager.js';
import { ChatCLI } from '../../src/chat/ChatCLI.js';
import { RalphLoop } from '../../src/core/RalphLoop.js';

// Mock RalphLoop to avoid requiring LLM configuration in tests
vi.mock('../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: vi.fn().mockResolvedValue({
      code: '// mock code',
      iterations: 1,
      completed: true,
      reason: 'test',
      timestamp: new Date().toISOString(),
      duration: 100,
      finalScore: 0.7
    })
  }
}));

describe('Chat Input Integration', () => {
  describe('End-to-end interview flow', () => {
    it('should complete full interview from greeting to generating', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      // Start the conversation
      manager.startNewSession();

      // Greeting phase
      let response = await manager.processUserMessage('I want to create a p5.js sketch');
      expect(response.nextPhase).toBe('discovery');

      // Discovery phase - context
      response = await manager.processUserMessage('Web background for portfolio');
      expect(response.message).toContain('mood');

      // Discovery phase - mood
      response = await manager.processUserMessage('Meditative and calming');
      expect(response.message).toContain('references');

      // Discovery phase - references
      response = await manager.processUserMessage('Tyler Hobbs and similar generative artists');
      expect(response.message).toContain('constraints');

      // Discovery phase - constraints
      response = await manager.processUserMessage('Must run at 60fps, keep file size under 100KB');
      expect(response.nextPhase).toBe('confirm');

      // Confirm phase
      response = await manager.processUserMessage('Yes, generate!');
      expect(response.nextPhase).toBe('generating');
      expect(response.type).toBe('generating');

      // Verify all messages were stored
      const session = manager.sessionHistory[0];
      expect(session.messages).toHaveLength(13); // 6 user + 6 assistant + 1 system (generation complete)

      // Verify interview phase
      expect(manager.interviewPhase).toBe('generating');
    });

    it('should handle partial interview with some optional answers skipped', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      manager.startNewSession();

      // Answer only required questions
      await manager.processUserMessage('Create shader art');
      await manager.processUserMessage('Installation piece');
      await manager.processUserMessage('Dreamy');
      await manager.processUserMessage(''); // Skip references
      await manager.processUserMessage(''); // Skip constraints

      // Should still reach confirm phase
      expect(manager.interviewPhase).toBe('confirm');
    });

    it('should build creative brief from interview answers', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      manager.startNewSession();

      // Complete interview
      await manager.processUserMessage('I want to create three.js abstract art');
      await manager.processUserMessage('Interactive web experience');
      await manager.processUserMessage('Energetic and dynamic');
      await manager.processUserMessage('TeamLab, Refik Anadol');
      await manager.processUserMessage('Must support mobile devices');

      // Build brief
      const brief = manager.buildCreativeBrief();

      expect(brief.intent).toBe('I want to create three.js abstract art');
      expect(brief.context).toBe('Interactive web experience');
      expect(brief.mood).toBe('Energetic and dynamic');
      // References are stored as string in interview, not parsed yet
      expect(brief.constraints).toContain('Must support mobile devices');
    });
  });

  describe('ChatCLI integration', () => {
    it('should route input through to ConversationManager', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await cli.handleUserInput('I want to create art');

      // Verify manager received and processed the input
      expect(manager.sessionHistory).toHaveLength(1);
      expect(manager.sessionHistory[0].messages).toHaveLength(2);
    });

    it('should maintain conversation state across multiple inputs', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await cli.handleUserInput('First message');
      await cli.handleUserInput('Web background');
      await cli.handleUserInput('Meditative');

      expect(manager.sessionHistory[0].messages).toHaveLength(6);
      expect(manager.interviewPhase).toBe('discovery');
    });
  });

  describe('Message persistence', () => {
    it('should preserve all messages with correct roles', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await cli.handleUserInput('Test');
      await cli.handleUserInput('Another test');

      const messages = manager.sessionHistory[0].messages;

      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
      expect(messages[3].role).toBe('assistant');
    });

    it('should include unique IDs for all messages', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await cli.handleUserInput('Message 1');
      await cli.handleUserInput('Message 2');

      const messages = manager.sessionHistory[0].messages;
      const ids = new Set(messages.map(m => m.id));

      expect(ids.size).toBe(4); // All unique
    });

    it('should timestamp all messages', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await cli.handleUserInput('Timestamp test');

      const messages = manager.sessionHistory[0].messages;

      messages.forEach(msg => {
        expect(msg.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle empty input gracefully', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await expect(cli.handleUserInput('')).resolves.not.toThrow();
    });

    it('should handle whitespace input', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      await expect(cli.handleUserInput('   \n\t  ')).resolves.not.toThrow();
    });

    it('should handle very long input', async () => {
      const manager = new ConversationManager();
      const cli = new ChatCLI(manager);

      const longInput = 'a'.repeat(10000);

      await expect(cli.handleUserInput(longInput)).resolves.not.toThrow();
      expect(manager.sessionHistory[0].messages[0].content).toBe(longInput);
    });
  });
});
