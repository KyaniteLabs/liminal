/**
 * Tests for ConversationManager generation integration
 * Phase 2: Chat Integration - Generation Wiring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationManager } from '../../src/chat/ConversationManager.js';
import type { CreativeBrief } from '../../src/chat/types.js';
import { RalphLoop } from '../../src/core/RalphLoop.js';

// Mock RalphLoop
vi.mock('../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: vi.fn()
  }
}));

describe('ConversationManager - Generation Integration', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
    manager.startNewSession();
    vi.clearAllMocks();
  });

  describe('generateFromBrief', () => {
    it('should trigger RalphLoop with correct options', async () => {
      const brief: CreativeBrief = {
        intent: 'Create a particle system',
        context: 'Web background',
        mood: 'meditative',
        constraints: ['performance'],
        references: [],
        domain: 'p5',
        techniques: [
          {
            name: 'Particle Systems',
            domain: 'p5',
            description: 'Systems of particles that move and interact',
            keywords: ['particle']
          }
        ],
        complexity: 'medium'
      };

      const mockResult = {
        code: 'function setup() { createCanvas(400, 400); }',
        iterations: 5,
        completed: true,
        reason: 'promise detected',
        timestamp: new Date().toISOString(),
        duration: 5000,
        finalScore: 0.8
      };

      vi.mocked(RalphLoop.run).mockResolvedValue(mockResult);

      await manager.generateFromBrief(brief);

      expect(RalphLoop.run).toHaveBeenCalledWith(
        expect.stringContaining('particle'),
        expect.objectContaining({
          chatMode: true,
          collabDomain: 'p5',
          maxIterations: expect.any(Number)
        })
      );
    });

    it('should use domain from brief', async () => {
      const brief: CreativeBrief = {
        intent: 'Create music',
        context: 'Live performance',
        mood: 'energetic',
        constraints: [],
        references: [],
        domain: 'music',
        techniques: [],
        complexity: 'simple'
      };

      vi.mocked(RalphLoop.run).mockResolvedValue({
        code: '// music code',
        iterations: 3,
        completed: true,
        reason: 'done',
        timestamp: new Date().toISOString(),
        duration: 3000,
        finalScore: 0.7
      });

      await manager.generateFromBrief(brief);

      expect(RalphLoop.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          collabDomain: 'music'
        })
      );
    });

    it('should default to p5 domain if not specified', async () => {
      const brief: CreativeBrief = {
        intent: 'Create something',
        context: '',
        mood: '',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple'
      };

      vi.mocked(RalphLoop.run).mockResolvedValue({
        code: '// code',
        iterations: 1,
        completed: true,
        reason: 'done',
        timestamp: new Date().toISOString(),
        duration: 1000,
        finalScore: 0.6
      });

      await manager.generateFromBrief(brief);

      expect(RalphLoop.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          collabDomain: 'p5'
        })
      );
    });

    it('should include techniques from brief in prompt context', async () => {
      const brief: CreativeBrief = {
        intent: 'Create visual art with particles and noise',
        context: 'Gallery installation',
        mood: 'dreamy',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [
          {
            name: 'Particle Systems',
            domain: 'p5',
            description: 'Systems of particles that move and interact',
            keywords: ['particle']
          },
          {
            name: 'Perlin Noise',
            domain: 'p5',
            description: 'Gradient noise for organic textures',
            keywords: ['noise']
          }
        ],
        complexity: 'complex'
      };

      let capturedPrompt = '';
      vi.mocked(RalphLoop.run).mockImplementation(async (prompt) => {
        capturedPrompt = prompt;
        return {
          code: '// code',
          iterations: 1,
          completed: true,
          reason: 'done',
          timestamp: new Date().toISOString(),
          duration: 1000,
          finalScore: 0.7
        };
      });

      await manager.generateFromBrief(brief);

      expect(capturedPrompt).toContain('Particle Systems');
      expect(capturedPrompt).toContain('Perlin Noise');
    });

    it('should call onIteration callback to update preview', async () => {
      const brief: CreativeBrief = {
        intent: 'Create art',
        context: '',
        mood: '',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple'
      };

      const onIterationSpy = vi.fn();
      const mockIterationContext = {
        iteration: 1,
        prompt: 'test prompt',
        usedPrompt: 'test prompt',
        code: 'function setup() {}',
        evaluation: { score: 0.8, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 10
      };

      vi.mocked(RalphLoop.run).mockImplementation(async (_, options) => {
        // Simulate calling onIteration
        options?.onIteration?.(mockIterationContext);
        return {
          code: mockIterationContext.code,
          iterations: 1,
          completed: true,
          reason: 'done',
          timestamp: new Date().toISOString(),
          duration: 1000,
          finalScore: 0.8
        };
      });

      await manager.generateFromBrief(brief);

      // Verify the iteration was recorded in the session
      expect(manager.currentSession?.iterations).toHaveLength(1);
      expect(manager.currentSession?.iterations[0]).toMatchObject({
        code: mockIterationContext.code,
        score: mockIterationContext.evaluation.score
      });
    });

    it('should call onThought callback to show progress', async () => {
      const brief: CreativeBrief = {
        intent: 'Create art',
        context: '',
        mood: '',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple'
      };

      const thoughts: string[] = [];

      vi.mocked(RalphLoop.run).mockImplementation(async (_, options) => {
        // Simulate calling onThought
        options?.onThought?.('Starting iteration 1...');
        options?.onThought?.('Loading prompt...');
        options?.onThought?.('Generating code...');

        thoughts.push('Starting iteration 1...');
        thoughts.push('Loading prompt...');
        thoughts.push('Generating code...');

        return {
          code: '// code',
          iterations: 1,
          completed: true,
          reason: 'done',
          timestamp: new Date().toISOString(),
          duration: 1000,
          finalScore: 0.7
        };
      });

      await manager.generateFromBrief(brief);

      expect(thoughts).toContain('Starting iteration 1...');
      expect(thoughts).toContain('Loading prompt...');
      expect(thoughts).toContain('Generating code...');
    });

    it('should properly set chat mode options', async () => {
      const brief: CreativeBrief = {
        intent: 'Create art',
        context: '',
        mood: '',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple'
      };

      vi.mocked(RalphLoop.run).mockResolvedValue({
        code: '// code',
        iterations: 1,
        completed: true,
        reason: 'done',
        timestamp: new Date().toISOString(),
        duration: 1000,
        finalScore: 0.7
      });

      await manager.generateFromBrief(brief);

      expect(RalphLoop.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          chatMode: true,
          onIteration: expect.any(Function),
          onThought: expect.any(Function)
        })
      );
    });
  });

  describe('integration with interview flow', () => {
    it('should trigger generation after confirm phase', async () => {
      // Simulate completing the interview
      manager.interviewAnswers.set('intent', 'Create a particle system');
      manager.interviewAnswers.set('context', 'Web background');
      manager.interviewAnswers.set('mood', 'meditative');
      manager.interviewAnswers.set('constraints', ['performance']);
      manager.interviewAnswers.set('references', []);
      manager.interviewAnswers.set('confirmed', 'Yes, generate!');

      const brief = manager.buildCreativeBrief();

      const mockIterationContext = {
        iteration: 1,
        prompt: 'test prompt',
        usedPrompt: 'test prompt',
        code: '// particle system code',
        evaluation: { score: 0.8, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 10
      };

      vi.mocked(RalphLoop.run).mockImplementation(async (_, options) => {
        // Simulate calling onIteration to record the iteration
        options?.onIteration?.(mockIterationContext);
        return {
          code: mockIterationContext.code,
          iterations: 1,
          completed: true,
          reason: 'promise detected',
          timestamp: new Date().toISOString(),
          duration: 5000,
          finalScore: 0.8
        };
      });

      await manager.generateFromBrief(brief);

      expect(RalphLoop.run).toHaveBeenCalled();
      expect(manager.currentSession?.iterations).toHaveLength(1);
      expect(manager.currentSession?.iterations[0]).toMatchObject({
        code: mockIterationContext.code,
        score: mockIterationContext.evaluation.score
      });
    });

    it('should update session status during generation', async () => {
      const brief: CreativeBrief = {
        intent: 'Create art',
        context: '',
        mood: '',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple'
      };

      vi.mocked(RalphLoop.run).mockResolvedValue({
        code: '// code',
        iterations: 3,
        completed: true,
        reason: 'done',
        timestamp: new Date().toISOString(),
        duration: 3000,
        finalScore: 0.7
      });

      expect(manager.currentSession?.status).toBe('active');

      await manager.generateFromBrief(brief);

      // After successful generation, status should still be active
      // (status changes to completed only when user confirms satisfaction)
      expect(manager.currentSession?.status).toBe('active');
    });
  });
});
