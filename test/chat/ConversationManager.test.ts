/**
 * Tests for ConversationManager input handling
 * Phase 2: Chat Integration - User Input Handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../../src/chat/ConversationManager.js';
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

describe('ConversationManager - Input Handling', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  describe('processUserMessage', () => {
    it('should capture and return agent response for user input', async () => {
      manager.startNewSession();

      const response = await manager.processUserMessage('I want to create a p5 sketch');

      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
      expect(response.type).toBeDefined();
    });

    it('should store user messages in session', async () => {
      manager.startNewSession();

      await manager.processUserMessage('I want to create art');

      const session = manager.sessionHistory[0];
      expect(session.messages).toHaveLength(2); // user + assistant
      expect(session.messages[0].role).toBe('user');
      expect(session.messages[0].content).toBe('I want to create art');
    });

    it('should store assistant responses in session', async () => {
      manager.startNewSession();

      const response = await manager.processUserMessage('hello');

      const session = manager.sessionHistory[0];
      expect(session.messages).toHaveLength(2);
      expect(session.messages[1].role).toBe('assistant');
      expect(session.messages[1].content).toBe(response.message);
    });
  });

  describe('Interview flow transitions', () => {
    it('should start in greeting phase', () => {
      manager.startNewSession();

      expect(manager.interviewPhase).toBe('greeting');
    });

    it('should transition from greeting to discovery after intent', async () => {
      manager.startNewSession();

      await manager.processUserMessage('I want to create a shader');

      expect(manager.interviewPhase).toBe('discovery');
    });

    it('should transition from discovery to confirm after all questions', async () => {
      manager.startNewSession();

      // Answer greeting
      await manager.processUserMessage('I want to create p5 art');

      // Answer discovery questions
      await manager.processUserMessage('Web background');
      await manager.processUserMessage('Meditative');
      await manager.processUserMessage('None');
      await manager.processUserMessage('No constraints');
      await manager.processUserMessage('No audio needed');
      await manager.processUserMessage('Vibrant');

      expect(manager.interviewPhase).toBe('confirm');
    });

    it('should transition from confirm to generating on confirmation', async () => {
      manager.startNewSession();

      // Complete all previous phases
      await manager.processUserMessage('I want to create art');
      await manager.processUserMessage('Web');
      await manager.processUserMessage('Dreamy');
      await manager.processUserMessage('None');
      await manager.processUserMessage('No, text only');
      await manager.processUserMessage('No audio');
      await manager.processUserMessage('Minimalist');
      const response = await manager.processUserMessage('Yes, generate!');

      // Phase advances to generating when confirm answer is given
      expect(manager.interviewPhase).toBe('generating');
      expect(response.type).toBe('generating');
    });

    it('should ask context question in discovery phase', async () => {
      manager.startNewSession();

      const response = await manager.processUserMessage('I want to create a shader');

      expect(response.message).toContain('context');
    });

    it('should ask mood question after context', async () => {
      manager.startNewSession();

      await manager.processUserMessage('I want to create art');

      const response = await manager.processUserMessage('Web background');

      expect(response.message).toContain('mood');
    });
  });

  describe('Session message storage', () => {
    it('should preserve message order in session', async () => {
      manager.startNewSession();

      await manager.processUserMessage('First message');
      await manager.processUserMessage('Second message');

      const session = manager.sessionHistory[0];
      expect(session.messages[0].content).toBe('First message');
      expect(session.messages[2].content).toBe('Second message');
    });

    it('should include timestamps on all messages', async () => {
      manager.startNewSession();

      await manager.processUserMessage('Test message');

      const session = manager.sessionHistory[0];
      expect(session.messages[0].timestamp).toBeInstanceOf(Date);
      expect(session.messages[1].timestamp).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for all messages', async () => {
      manager.startNewSession();

      await manager.processUserMessage('Message 1');
      await manager.processUserMessage('Message 2');

      const session = manager.sessionHistory[0];
      const ids = new Set(session.messages.map(m => m.id));
      expect(ids.size).toBe(4); // 2 user + 2 assistant messages
    });
  });

  describe('Agent response types', () => {
    it('should return question type during interview', async () => {
      manager.startNewSession();

      const response = await manager.processUserMessage('I want to create art');

      expect(response.type).toBe('question');
    });

    it('should return info type when generating', async () => {
      manager.startNewSession();

      // Complete interview: greeting + 6 discovery + confirm
      await manager.processUserMessage('Create art');       // greeting → discovery
      await manager.processUserMessage('Web');              // context
      await manager.processUserMessage('Calm');             // mood
      await manager.processUserMessage('None');             // references
      await manager.processUserMessage('None');             // constraints
      await manager.processUserMessage('No audio');         // audioPreference
      await manager.processUserMessage('Surprise me');      // aestheticPreset → confirm
      const response = await manager.processUserMessage('Yes, generate!'); // confirm → generating

      expect(response.type).toBe('generating');
      expect(response.nextPhase).toBe('generating');
    });

    it('should include nextPhase in response when phase changes', async () => {
      manager.startNewSession();

      const response = await manager.processUserMessage('I want to create art');

      expect(response.nextPhase).toBe('discovery');
    });
  });
});
