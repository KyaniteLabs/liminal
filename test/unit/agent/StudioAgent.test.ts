/**
 * StudioAgent tests — behavioral assertions on the agent's routing and delegation.
 *
 * Tests real agent behavior with mock delegates.
 * Every assertion checks a specific expected value.
 */
import { describe, it, expect, vi } from 'vitest';
import { StudioAgent } from '../../../src/agent/StudioAgent.js';
import type { StudioResponse } from '../../../src/agent/types.js';

// ── Helpers ──

/** Creates a mock chat delegate that yields the given chunks */
function mockChatDelegate(chunks: string[]) {
  return vi.fn(async function* (_system: string, _user: string) {
    for (const chunk of chunks) {
      yield chunk;
    }
  });
}

/** Creates a mock creative delegate that returns a result */
function mockCreativeDelegate(content: string, artifactRefs: string[]) {
  return vi.fn(async (_prompt: string) => ({
    content,
    artifactRefs,
    model: 'test-model',
  }));
}

/** Creates a mock engineering delegate that returns a result */
function mockEngineeringDelegate(content: string, taskRefs: string[]) {
  return vi.fn(async (_desc: string) => ({
    content,
    taskRefs,
    model: 'test-model',
  }));
}

describe('StudioAgent', () => {
  // ── Classification Only ──

  describe('classify()', () => {
    const agent = new StudioAgent({});

    it('classifies creative input', () => {
      const result = agent.classify('generate a p5 sketch');
      expect(result.intent).toBe('creative');
    });

    it('classifies engineering input', () => {
      const result = agent.classify('fix the test coverage');
      expect(result.intent).toBe('engineering');
    });

    it('classifies direct input', () => {
      const result = agent.classify('hello');
      expect(result.intent).toBe('direct');
    });

    it('classifies hybrid input', () => {
      const result = agent.classify('improve the art quality');
      expect(result.intent).toBe('hybrid');
    });
  });

  // ── Direct Chat ──

  describe('direct chat', () => {
    it('calls chat delegate and returns composed response', async () => {
      const chat = mockChatDelegate(['Hello, ', 'artist!']);
      const agent = new StudioAgent({ chatDelegate: chat });

      const response = await agent.processInput('hello');

      expect(response.content).toBe('Hello, artist!');
      expect(response.metadata.intent).toBe('direct');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
      expect(response.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(chat).toHaveBeenCalledOnce();
    });

    it('passes system prompt to delegate', async () => {
      const chat = mockChatDelegate(['ok']);
      const agent = new StudioAgent({ chatDelegate: chat });

      await agent.processInput('hi');

      expect(chat).toHaveBeenCalledWith(
        agent.systemPrompt,
        'hi',
        undefined,
      );
    });
  });

  // ── Creative Delegation ──

  describe('creative delegation', () => {
    it('delegates to creative delegate and returns artifact refs', async () => {
      const creative = mockCreativeDelegate('Generated!', ['art-1']);
      const agent = new StudioAgent({ creativeDelegate: creative });

      const response = await agent.processInput('generate a p5 sketch');

      expect(response.content).toBe('Generated!');
      expect(response.metadata.intent).toBe('creative');
      expect(response.metadata.delegatedTo).toBe('ralph-loop');
      expect(response.metadata.artifactRefs).toEqual(['art-1']);
      expect(creative).toHaveBeenCalledOnce();
    });

    it('falls back to chat when no creative delegate available', async () => {
      const chat = mockChatDelegate(['fallback']);
      const agent = new StudioAgent({ chatDelegate: chat });

      const response = await agent.processInput('generate something');

      expect(response.metadata.delegatedTo).toBe('llm-chat');
      expect(response.content).toBe('fallback');
    });
  });

  // ── Engineering Delegation ──

  describe('engineering delegation', () => {
    it('delegates to engineering delegate and returns task refs', async () => {
      const engineering = mockEngineeringDelegate('Fixed!', ['L001']);
      const agent = new StudioAgent({ engineeringDelegate: engineering });

      const response = await agent.processInput('fix the test coverage');

      expect(response.content).toBe('Fixed!');
      expect(response.metadata.intent).toBe('engineering');
      expect(response.metadata.delegatedTo).toBe('conveyor');
      expect(response.metadata.taskRefs).toEqual(['L001']);
      expect(engineering).toHaveBeenCalledOnce();
    });

    it('falls back to chat when no engineering delegate available', async () => {
      const chat = mockChatDelegate(['fallback']);
      const agent = new StudioAgent({ chatDelegate: chat });

      const response = await agent.processInput('fix the build');

      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });
  });

  // ── No Delegates Available ──

  describe('no delegates', () => {
    it('returns "not connected" message when no chat delegate', async () => {
      const agent = new StudioAgent({});
      const response = await agent.processInput('hello');

      expect(response.content).toContain('not connected');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });

    it('returns fallback message for creative without delegate', async () => {
      const agent = new StudioAgent({});
      const response = await agent.processInput('generate art');

      // Falls back to llm-chat, which also has no delegate
      expect(response.content).toContain('not connected');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });

    it('returns fallback message for engineering without delegate', async () => {
      const agent = new StudioAgent({});
      const response = await agent.processInput('fix coverage');

      // Falls back to llm-chat, which also has no delegate
      expect(response.content).toContain('not connected');
      expect(response.metadata.delegatedTo).toBe('llm-chat');
    });
  });

  // ── Turn IDs ──

  describe('turn IDs', () => {
    it('generates unique turn IDs for sequential inputs', async () => {
      const chat = mockChatDelegate(['ok']);
      const agent = new StudioAgent({ chatDelegate: chat });

      const r1 = await agent.processInput('first');
      const r2 = await agent.processInput('second');

      expect(r1.metadata.turnId).not.toBe(r2.metadata.turnId);
      expect(r1.metadata.turnId).toMatch(/^turn-\d+-\d+$/);
    });
  });

  // ── Custom System Prompt ──

  describe('custom system prompt', () => {
    it('uses custom system prompt when configured', async () => {
      const chat = mockChatDelegate(['ok']);
      const agent = new StudioAgent({
        chatDelegate: chat,
        config: { systemPrompt: 'You are a test assistant.' },
      });

      expect(agent.systemPrompt).toBe('You are a test assistant.');

      await agent.processInput('hi');

      expect(chat).toHaveBeenCalledWith('You are a test assistant.', 'hi', undefined);
    });

    it('uses default system prompt when not configured', () => {
      const agent = new StudioAgent({});
      expect(agent.systemPrompt).toContain('creative guide');
    });
  });

  // ── Signal Cancellation ──

  describe('abort signal', () => {
    it('passes abort signal to delegates', async () => {
      const chat = mockChatDelegate(['ok']);
      const agent = new StudioAgent({ chatDelegate: chat });

      const controller = new AbortController();
      await agent.processInput('hi', controller.signal);

      expect(chat).toHaveBeenCalledWith(
        expect.any(String),
        'hi',
        controller.signal,
      );
    });
  });
});
