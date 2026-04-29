import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationManager } from '../../../src/chat/ConversationManager.js';
import type { CreativeSession, Session, ConversationMessage, InterviewPhase } from '../../../src/chat/types.js';
import type { AgentResponse } from '../../../src/chat/ConversationManager.js';
import { RalphLoop } from '../../../src/core/RalphLoop.js';

// Mock RalphLoop to avoid "No LLM configured" errors in tests that trigger generation
vi.mock('../../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: vi.fn()
  }
}));

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  describe('constructor', () => {
    it('should initialize with null current session', () => {
      expect(manager.currentSession).toBeNull();
    });

    it('should initialize with empty session history', () => {
      expect(manager.sessionHistory).toEqual([]);
    });

    it('should initialize with greeting phase', () => {
      expect(manager.interviewPhase).toBe('greeting');
    });

    it('should initialize with empty interview answers', () => {
      expect(manager.interviewAnswers.size).toBe(0);
    });
  });

  describe('startNewSession', () => {
    it('should create a new session with unique ID', () => {
      manager.startNewSession();

      expect(manager.currentSession).not.toBeNull();
      expect(manager.currentSession?.id).not.toBeNull();
      expect(typeof manager.currentSession?.id).toBe('string');
    });

    it('should create sessions with different IDs', () => {
      manager.startNewSession();
      const firstId = manager.currentSession?.id;

      manager.startNewSession();
      const secondId = manager.currentSession?.id;

      expect(firstId).not.toBe(secondId);
    });

    it('should set session status to active', () => {
      manager.startNewSession();

      expect(manager.currentSession?.status).toBe('active');
    });

    it('should initialize with empty iterations', () => {
      manager.startNewSession();

      expect(manager.currentSession?.iterations).toEqual([]);
    });

    it('should set startedAt to current date', () => {
      const before = new Date();
      manager.startNewSession();
      const after = new Date();

      expect(manager.currentSession?.startedAt).toBeInstanceOf(Date);
      expect(manager.currentSession?.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(manager.currentSession?.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should reset interview phase to greeting', () => {
      manager.interviewPhase = 'discovery';
      manager.startNewSession();

      expect(manager.interviewPhase).toBe('greeting');
    });

    it('should clear interview answers', () => {
      manager.interviewAnswers.set('intent', 'test');
      manager.startNewSession();

      expect(manager.interviewAnswers.size).toBe(0);
    });
  });

  describe('continueSession', () => {
    it('should load existing session from history', () => {
      manager.startNewSession();
      const sessionId = manager.currentSession!.id;

      // Start a new session to push the first one to history
      manager.startNewSession();

      // Continue the first session
      manager.continueSession(sessionId);

      expect(manager.currentSession?.id).toBe(sessionId);
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        manager.continueSession('non-existent-id');
      }).toThrow();
    });
  });

  describe('processUserMessage', () => {
    beforeEach(() => {
      manager.startNewSession();
      // Set up RalphLoop mock for tests that may trigger generation
      vi.mocked(RalphLoop.run).mockResolvedValue({
        code: '// mock code',
        iterations: 1,
        completed: true,
        reason: 'done',
        timestamp: new Date().toISOString(),
        duration: 1000,
        finalScore: 0.7
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should record user message in session history', async () => {
      await manager.processUserMessage('I want to create art');

      expect(manager.sessionHistory).toHaveLength(1);
      expect(manager.sessionHistory[0].messages).toHaveLength(2); // user + assistant
    });

    it('should record user message with correct role', async () => {
      await manager.processUserMessage('test message');

      const session = manager.sessionHistory[0];
      const userMessage = session.messages.find(m => m.role === 'user');

      expect(userMessage?.content).toBe('test message');
    });

    it('should update interview answers for intent', async () => {
      const response = await manager.processUserMessage('Create a particle system');

      expect(manager.interviewAnswers.has('intent')).toBe(true);
      expect(manager.interviewAnswers.get('intent')).toBe('Create a particle system');
    });

    it('should update interview answers for context', async () => {
      manager.interviewPhase = 'discovery';
      await manager.processUserMessage('For a gallery installation');

      expect(manager.interviewAnswers.has('context')).toBe(true);
      expect(manager.interviewAnswers.get('context')).toBe('For a gallery installation');
    });

    it('should update interview answers for mood', async () => {
      manager.interviewPhase = 'discovery';
      manager.interviewAnswers.set('context', 'done');
      await manager.processUserMessage('Ethereal and dreamy');

      expect(manager.interviewAnswers.has('mood')).toBe(true);
      expect(manager.interviewAnswers.get('mood')).toBe('Ethereal and dreamy');
    });

    it('should advance phase from greeting to discovery', async () => {
      expect(manager.interviewPhase).toBe('greeting');

      const response = await manager.processUserMessage('Create something cool');

      expect(response.nextPhase).toBe('discovery');
      expect(manager.interviewPhase).toBe('discovery');
    });

    it('should advance phase from discovery to confirm', async () => {
      manager.interviewPhase = 'discovery';
      manager.interviewAnswers.set('intent', 'test');
      manager.interviewAnswers.set('context', 'test');
      manager.interviewAnswers.set('mood', 'test');
      manager.interviewAnswers.set('references', 'test');
      manager.interviewAnswers.set('constraints', 'test');
      manager.interviewAnswers.set('audioPreference', 'test');
      manager.interviewAnswers.set('aestheticPreset', 'test');

      const response = await manager.processUserMessage('Some answer');

      expect(response.nextPhase).toBe('confirm');
      expect(manager.interviewPhase).toBe('confirm');
    });

    it('should advance phase from confirm to generating', async () => {
      manager.interviewPhase = 'confirm';
      const response = await manager.processUserMessage('Yes, generate!');

      expect(response.nextPhase).toBe('generating');
      expect(manager.interviewPhase).toBe('generating');
    });

    it('should return agent response with question type', async () => {
      const response = await manager.processUserMessage('Create art');

      expect(response.type).toBe('question');
      expect(response.message).not.toBeNull();
    });

    it('should return agent response with generating type for confirmation', async () => {
      manager.interviewPhase = 'confirm';
      const response = await manager.processUserMessage('Yes, generate!');

      expect(response.type).toBe('generating');
    });
  });

  describe('creative preference prompt hints', () => {
    beforeEach(() => {
      manager.startNewSession();
      vi.mocked(RalphLoop.run).mockResolvedValue({
        code: '// mock code',
        iterations: 1,
        completed: true,
        reason: 'done',
        timestamp: new Date().toISOString(),
        duration: 1000,
        finalScore: 0.7
      });
    });

    it('threads optional creative vocabulary hints into generation prompts', async () => {
      await manager.generateFromBrief({
        intent: 'slow ambient chords with sparse instrumentation',
        context: '',
        mood: 'gentle and quiet',
        constraints: [],
        references: [],
        domain: 'strudel',
        techniques: [],
        complexity: 'simple'
      });

      const prompt = vi.mocked(RalphLoop.run).mock.calls[0][0] as string;
      expect(prompt).toContain('Creative preferences');
      expect(prompt).toContain('Prefer a slow tempo feel.');
      expect(prompt).toContain('Keep musical density sparse.');
      expect(prompt).not.toContain('guardrail');
    });
  });

  describe('getInterviewQuestion', () => {
    beforeEach(() => {
      manager.startNewSession();
    });

    it('should return greeting question initially', () => {
      const question = manager.getInterviewQuestion();

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('greeting');
      expect(question?.id).toBe('intent');
    });

    it('should return discovery questions after greeting', () => {
      manager.interviewPhase = 'discovery';

      const question = manager.getInterviewQuestion();

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('discovery');
    });

    it('should return confirm question after discovery', () => {
      manager.interviewPhase = 'confirm';

      const question = manager.getInterviewQuestion();

      expect(question).not.toBeNull();
      expect(question?.phase).toBe('confirm');
    });

    it('should return null after all phases complete', () => {
      manager.interviewPhase = 'generating';

      const question = manager.getInterviewQuestion();

      expect(question).toBeNull();
    });

    it('should return correct question for current phase', () => {
      manager.interviewPhase = 'discovery';
      manager.interviewAnswers.set('context', 'done');

      const question = manager.getInterviewQuestion();

      expect(question?.id).not.toBe('context');
      expect(question?.phase).toBe('discovery');
    });
  });

  describe('buildCreativeBrief', () => {
    beforeEach(() => {
      manager.startNewSession();
    });

    it('should build brief from interview answers', () => {
      manager.interviewAnswers.set('intent', 'Create a particle system');
      manager.interviewAnswers.set('context', 'For web');
      manager.interviewAnswers.set('mood', 'Ethereal');

      const brief = manager.buildCreativeBrief();

      expect(brief.intent).toBe('Create a particle system');
      expect(brief.context).toBe('For web');
      expect(brief.mood).toBe('Ethereal');
    });

    it('should infer techniques from intent', () => {
      manager.interviewAnswers.set('intent', 'Create a particle system with noise');

      const brief = manager.buildCreativeBrief();

      expect(brief.techniques.length).toBeGreaterThan(0);
    });

    it('should infer complexity from answers', () => {
      manager.interviewAnswers.set('intent', 'Create a particle system');
      manager.interviewAnswers.set('constraints', ['constraint1', 'constraint2']);

      const brief = manager.buildCreativeBrief();

      expect(brief.complexity).not.toBeNull();
    });

    it('should default to p5 domain', () => {
      manager.interviewAnswers.set('intent', 'Create something');

      const brief = manager.buildCreativeBrief();

      expect(brief.domain).toBe('p5');
    });

    it('should include constraints when provided', () => {
      manager.interviewAnswers.set('intent', 'test');
      manager.interviewAnswers.set('constraints', ['max 100 particles', 'use perlin noise']);

      const brief = manager.buildCreativeBrief();

      expect(brief.constraints).toEqual(['max 100 particles', 'use perlin noise']);
    });

    it('should include references when provided', () => {
      manager.interviewAnswers.set('intent', 'test');
      const refs = [
        { type: 'past-work' as const, id: 'work-1', description: 'Previous study' }
      ];
      manager.interviewAnswers.set('references', refs);

      const brief = manager.buildCreativeBrief();

      expect(brief.references).toEqual(refs);
    });
  });

  describe('session history management', () => {
    it('should store completed sessions in history', () => {
      manager.startNewSession();
      const firstId = manager.currentSession!.id;

      manager.startNewSession();
      const secondId = manager.currentSession!.id;

      expect(manager.sessionHistory).toHaveLength(1);
      expect(manager.sessionHistory[0].sessionId).toBe(firstId);

      manager.startNewSession();

      expect(manager.sessionHistory).toHaveLength(2);
    });
  });
});
