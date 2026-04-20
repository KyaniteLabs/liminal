import { describe, it, expect, vi } from 'vitest';
import { StudioAgent, STUDIO_SYSTEM_PROMPT } from '../../../src/agent/StudioAgent.js';
import type { CreativeResult, EngineeringResult } from '../../../src/agent/StudioAgent.js';

describe('StudioAgent', () => {
  describe('system prompt', () => {
    it('provides a creative-first personality', () => {
      expect(STUDIO_SYSTEM_PROMPT).toContain('Liminal Studio');
      expect(STUDIO_SYSTEM_PROMPT).toContain('creative');
    });
  });

  describe('classify', () => {
    it('classifies creative inputs', () => {
      const agent = new StudioAgent({});
      const result = agent.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
    });

    it('classifies engineering inputs', () => {
      const agent = new StudioAgent({});
      const result = agent.classify('fix the failing test');
      expect(result.intent).toBe('engineering');
    });

    it('classifies direct inputs', () => {
      const agent = new StudioAgent({});
      const result = agent.classify('hello there');
      expect(result.intent).toBe('direct');
    });
  });

  describe('processInput with chatDelegate', () => {
    it('streams direct chat via chatDelegate', async () => {
      async function* mockChat(_sys: string, _msg: string) {
        yield 'Hello ';
        yield 'world!';
      }

      const agent = new StudioAgent({ chatDelegate: mockChat });
      const response = await agent.processInput('hello');

      expect(response.content).toBe('Hello world!');
      expect(response.metadata.intent).toBe('direct');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });

    it('returns not-connected message when no chatDelegate', async () => {
      const agent = new StudioAgent({});
      const response = await agent.processInput('hello');

      expect(response.content).toContain('not connected');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });
  });

  describe('processInput with creativeDelegate', () => {
    it('delegates creative intents to RalphLoop', async () => {
      const mockCreative = vi.fn<[], [string, AbortSignal?], Promise<CreativeResult>>(
        async () => ({
          content: 'function setup() {}',
          artifactRefs: ['sketch.js'],
          model: 'glm-5.1',
        }),
      );

      const agent = new StudioAgent({ creativeDelegate: mockCreative });
      const response = await agent.processInput('generate a p5 sketch');

      expect(mockCreative).toHaveBeenCalledOnce();
      expect(response.metadata.intent).toBe('creative');
      expect(response.metadata.delegatedTo).toBe('ralph-loop');
      expect(response.metadata.artifactRefs).toEqual(['sketch.js']);
      expect(response.metadata.model).toBe('glm-5.1');
    });

    it('falls back to chat when creativeDelegate is missing', async () => {
      const agent = new StudioAgent({});
      const response = await agent.processInput('generate art');

      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });
  });

  describe('processInput with engineeringDelegate', () => {
    it('delegates engineering intents to ConveyorRunner', async () => {
      const mockEngineering = vi.fn<[], [string, AbortSignal?], Promise<EngineeringResult>>(
        async () => ({
          content: 'Fixed the test',
          taskRefs: ['T-001'],
          model: 'glm-5.1',
        }),
      );

      const agent = new StudioAgent({ engineeringDelegate: mockEngineering });
      const response = await agent.processInput('fix the failing test in BatchProcessor');

      expect(mockEngineering).toHaveBeenCalledOnce();
      expect(response.metadata.intent).toBe('engineering');
      expect(response.metadata.delegatedTo).toBe('conveyor');
      expect(response.metadata.taskRefs).toEqual(['T-001']);
    });

    it('falls back to chat when engineeringDelegate is missing', async () => {
      const agent = new StudioAgent({});
      const response = await agent.processInput('fix the bug');

      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });
  });

  describe('with ModeAwareRouter', () => {
    it('biases routing toward creative in make mode', async () => {
      const mockCreative = vi.fn<[], [string, AbortSignal?], Promise<CreativeResult>>(
        async () => ({ content: 'art', artifactRefs: [] }),
      );

      const agent = new StudioAgent({
        creativeDelegate: mockCreative,
        getActiveMode: () => ({ mode: 'make' }),
      });

      await agent.processInput('something nice');
      expect(mockCreative).toHaveBeenCalled();
    });

    it('biases routing toward engineering in ask mode', async () => {
      const mockEngineering = vi.fn<[], [string, AbortSignal?], Promise<EngineeringResult>>(
        async () => ({ content: 'info', taskRefs: [] }),
      );

      const agent = new StudioAgent({
        engineeringDelegate: mockEngineering,
        getActiveMode: () => ({ mode: 'ask' }),
      });

      await agent.processInput('something I want to know about');
      expect(mockEngineering).toHaveBeenCalled();
    });
  });

  describe('custom config', () => {
    it('uses custom system prompt when provided', () => {
      const agent = new StudioAgent({
        config: { systemPrompt: 'Custom prompt' },
      });
      expect(agent.systemPrompt).toBe('Custom prompt');
    });

    it('uses default system prompt when none provided', () => {
      const agent = new StudioAgent({});
      expect(agent.systemPrompt).toBe(STUDIO_SYSTEM_PROMPT);
    });
  });
});
